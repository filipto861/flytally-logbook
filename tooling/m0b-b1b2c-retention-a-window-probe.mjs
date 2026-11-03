#!/usr/bin/env node
// M0-B: option-A time/erasure contract in a disposable PG16 only.
// NOT a production migration, privacy authorization implementation or legal approval.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

export function runRetentionAWindowProbe(env=process.env) {
  const cfg=assertIsolatedTarget(env);
  const childEnv={...env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
  for(const k of Object.keys(childEnv))if(/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|USER|PASSFILE|PASSWORD|REQUIRESSL)$/i.test(k))delete childEnv[k];
  function sql(statement,allowFailure=false) {
    const r=spawnSync(String(env.FLYTALLY_PSQL||'psql'),['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d',cfg.url,'-c',statement],{encoding:'utf8',timeout:12000,env:childEnv});
    if(r.error)throw r.error;
    if(r.status!==0&&!allowFailure)throw Error('Disposable PG16 statement failed: '+r.stderr);
    return {status:r.status,out:String(r.stdout??'').trim(),err:String(r.stderr??'')};
  }
  const m=sql("SELECT current_database()||'|'||current_user||'|'||inet_server_addr()||'|'||inet_server_port()||'|'||current_setting('server_version_num')").out.split('|');
  assert.equal(m[0],cfg.databaseName);assert.equal(m[1],'flytally');assert.equal(Number(m[3]),cfg.port);assert.match(m[4],/^16\d{4}$/);
  const bridge=env.CI==='true'&&/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(m[2]||'');
  assert.ok(m[2]==='127.0.0.1'||bridge);
  const schema='"ft_m0b_window_'+randomUUID().replaceAll('-','')+'"';
  const uid='6d360cee-29dd-4cb3-bdcb-f5a3f829d8e7';
  const otherUid='3498a134-9b6b-42e6-b5b4-52f34b7d079b';
  const erasedUid='e7f0e5c6-d22a-4b07-b8d8-33cfc690a42c';
  const anchor="'2026-11-03T00:00:00Z'::timestamptz";
  let created=false;
  const tests=[];
  try {
    sql(`CREATE SCHEMA ${schema}`);created=true;
    sql(`
      CREATE TABLE ${schema}.registry(
        owner_id bigint NOT NULL,kind text NOT NULL CHECK(kind IN('flight','fstd')),
        uid uuid NOT NULL,state text NOT NULL CHECK(state IN('active','trash','purged','voided')),
        trash_cutoff timestamptz,marker_until timestamptz,
        PRIMARY KEY(owner_id,kind,uid),
        CHECK((state='purged' AND trash_cutoff IS NOT NULL AND marker_until IS NOT NULL)
          OR (state<>'purged' AND marker_until IS NULL)));
      CREATE TABLE ${schema}.trash(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id bigint NOT NULL,kind text NOT NULL DEFAULT 'flight' CHECK(kind='flight'),
        uid uuid,purge_after timestamptz NOT NULL,
        flight_data jsonb NOT NULL,tracks_data jsonb NOT NULL,expenses_data jsonb NOT NULL,
        FOREIGN KEY(owner_id,kind,uid) REFERENCES ${schema}.registry(owner_id,kind,uid));
      CREATE UNIQUE INDEX scoped_trash_uid ON ${schema}.trash(owner_id,kind,uid) WHERE uid IS NOT NULL;
      CREATE FUNCTION ${schema}.coherent() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE o bigint;k text;u uuid;s text;n int;
      BEGIN
        IF TG_TABLE_NAME='registry' THEN
          IF TG_OP='DELETE' THEN RETURN NULL; END IF;
          o:=NEW.owner_id;k:=NEW.kind;u:=NEW.uid;
        ELSE
          IF TG_OP='DELETE' THEN o:=OLD.owner_id;k:=OLD.kind;u:=OLD.uid;
          ELSE o:=NEW.owner_id;k:=NEW.kind;u:=NEW.uid; END IF;
        END IF;
        IF u IS NULL OR k<>'flight' THEN RETURN NULL; END IF;
        SELECT state INTO s FROM ${schema}.registry WHERE owner_id=o AND kind=k AND uid=u;
        SELECT count(*) INTO n FROM ${schema}.trash WHERE owner_id=o AND kind=k AND uid=u;
        IF s='trash' AND n<>1 THEN RAISE EXCEPTION 'Trash requires archive'; END IF;
        IF s='purged' AND n<>0 THEN RAISE EXCEPTION 'Purged requires no archive'; END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER check_registry AFTER INSERT OR UPDATE ON ${schema}.registry
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent();
      CREATE CONSTRAINT TRIGGER check_trash AFTER INSERT OR UPDATE OR DELETE ON ${schema}.trash
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent();
    `);
    tests.push('PASS isolated owner/kind/UID registry with deferred Trash coherence');

    sql(`BEGIN;
      INSERT INTO ${schema}.registry(owner_id,kind,uid,state,trash_cutoff)
        VALUES(1,'flight','${uid}','trash',${anchor});
      INSERT INTO ${schema}.trash(owner_id,kind,uid,purge_after,flight_data,tracks_data,expenses_data)
        VALUES(1,'flight','${uid}',${anchor},'{"flight":"synthetic"}','[{"gps":"synthetic"}]','[{"amount":"synthetic"}]');
      COMMIT;`);
    const before=`(${anchor}-INTERVAL '1 microsecond')`;
    assert.equal(sql(`DELETE FROM ${schema}.trash WHERE owner_id=1 AND purge_after<=${before} RETURNING id`).out,'');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}'`).out,'1');
    tests.push('PASS before 90-day logical deadline archive remains');

    const wrong=sql(`DELETE FROM ${schema}.trash WHERE owner_id=1 AND purge_after<=${anchor}`,true);
    assert.notEqual(wrong.status,0);assert.match(wrong.err,/Trash requires archive/);
    tests.push('PASS old direct purge cannot leave dangling registry state');

    sql(`BEGIN;
      UPDATE ${schema}.registry SET state='purged',marker_until=trash_cutoff+INTERVAL '12 months'
        WHERE owner_id=1 AND kind='flight' AND uid='${uid}' AND state='trash' AND trash_cutoff<=${anchor};
      DELETE FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}' AND purge_after<=${anchor};
      COMMIT;`);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}'`).out,'0');
    assert.equal(sql(`SELECT marker_until=(${anchor}+INTERVAL '12 months') FROM ${schema}.registry WHERE owner_id=1 AND uid='${uid}'`).out,'t');
    tests.push('PASS at 90 days payload GPS/expenses removed, finite marker starts from cutoff not job time');

    const dupe=sql(`INSERT INTO ${schema}.registry(owner_id,kind,uid,state) VALUES(1,'flight','${uid}','active')`,true);
    assert.notEqual(dupe.status,0);assert.match(dupe.err,/duplicate key/);
    const expiry=`(${anchor}+INTERVAL '12 months')`;
    assert.equal(sql(`DELETE FROM ${schema}.registry WHERE owner_id=1 AND state='purged'
      AND marker_until<=(${expiry}-INTERVAL '1 microsecond') RETURNING uid`).out,'');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.registry WHERE uid='${uid}' AND owner_id=1`).out,'1');
    tests.push('PASS duplicate blocked and marker retained until exact expiration boundary');

    assert.equal(sql(`DELETE FROM ${schema}.registry WHERE owner_id=1 AND state='purged'
      AND marker_until<=${expiry} RETURNING uid`).out,uid);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.registry WHERE uid='${uid}'`).out,'0');
    tests.push('PASS exactly 12 months after 90-day cutoff owner-linked marker is removed');

    sql(`BEGIN;
      INSERT INTO ${schema}.registry(owner_id,kind,uid,state,trash_cutoff,marker_until) VALUES
        (1,'flight','${erasedUid}','purged',${anchor},${expiry}),
        (2,'flight','${otherUid}','purged',${anchor},${expiry});
      COMMIT;`);
    sql(`BEGIN;
      DELETE FROM ${schema}.trash WHERE owner_id=1;
      DELETE FROM ${schema}.registry WHERE owner_id=1 AND state='purged';
      COMMIT;`);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.registry WHERE owner_id=1`).out,'0');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.registry WHERE owner_id=2`).out,'1');
    tests.push('PASS modeled erasure of one account does not remove unrelated owner marker');

    sql(`INSERT INTO ${schema}.trash(owner_id,kind,uid,purge_after,flight_data,tracks_data,expenses_data)
      VALUES (3,'flight',NULL,${anchor},'{"legacy":true}','[]','[]')`);
    sql(`DELETE FROM ${schema}.trash WHERE owner_id=3 AND uid IS NULL AND purge_after<=${anchor}`);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.trash WHERE owner_id=3`).out,'0');
    tests.push('PASS older NULL UID Trash expires without fabricated proof of identity');
    return {tests,pg:m[4]};
  } finally {
    if(created)sql(`DROP SCHEMA ${schema} CASCADE`);
  }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{const {tests,pg}=runRetentionAWindowProbe();tests.forEach(t=>console.log(t));console.log(`M0-B RETENTION-A WINDOW ${tests.length}/${tests.length} PASS (PG ${pg}; schema removed)`)}
  catch(e){console.error('M0-B RETENTION-A WINDOW FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1;}
}
