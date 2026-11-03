#!/usr/bin/env node
// M0-B: test-only schema candidate for reconciling TWO Trash expiry entrypoints.
// Explicitly owned disposable loopback PostgreSQL 16 ONLY. No real migrations,
// live application paths, production/remote SQL, or privacy authority inferred.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

export function runTrashWriterGateProbe(env=process.env) {
  const cfg=assertIsolatedTarget(env);
  const safeEnv={...env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
  for(const k of Object.keys(safeEnv))
    if(/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|USER|PASSFILE|PASSWORD|REQUIRESSL)$/i.test(k))delete safeEnv[k];
  const exe=String(env.FLYTALLY_PSQL||'psql');
  function sql(statement,failed=false) {
    const p=spawnSync(exe,['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d',cfg.url,'-c',statement],{
      env:safeEnv,encoding:'utf8',timeout:12000
    });
    if(p.error)throw p.error;
    if(p.status!==0&&!failed)throw new Error('Disposable PG16 diagnostic: '+p.stderr);
    return {status:p.status,out:String(p.stdout??'').trim(),err:String(p.stderr??'')};
  }
  const identity=sql("SELECT current_database()||'|'||current_user||'|'||inet_server_addr()||'|'||inet_server_port()||'|'||current_setting('server_version_num')").out.split('|');
  assert.equal(identity[0],cfg.databaseName);
  assert.equal(identity[1],'flytally');
  assert.equal(Number(identity[3]),cfg.port);
  assert.match(identity[4],/^16\d{4}$/);
  const ciBridge=env.CI==='true'&&/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(identity[2]||'');
  assert.ok(identity[2]==='127.0.0.1'||ciBridge);
  const schema='"ft_m0b_gate_'+randomUUID().replaceAll('-','')+'"';
  const uidA='9a693ae7-0c6e-4a3b-81bb-50943cce2971';
  const uidB='cd69d151-9174-4372-93b3-25b0ab6c7c22';
  const uidC='c2d3b598-24b8-4e25-8ac5-853b3d441b57';
  const uidD='25c13e24-bdd7-48b9-967e-9785c2d10b81';
  const cutoff="'2026-11-03T00:00:00Z'::timestamptz";
  const oneBefore=`(${cutoff}-INTERVAL '1 microsecond')`;
  const expect=[];
  let created=false;
  try{
    sql(`CREATE SCHEMA ${schema}`);created=true;
    sql(`
      CREATE TABLE ${schema}.owner_gate(owner_id bigint PRIMARY KEY);
      CREATE TABLE ${schema}.identity(
        owner_id bigint NOT NULL,
        kind text NOT NULL CHECK(kind='flight'),
        uid uuid NOT NULL,
        state text NOT NULL CHECK(state IN('active','trash','purged','voided')),
        trash_cutoff timestamptz,
        marker_until timestamptz,
        PRIMARY KEY(owner_id,kind,uid),
        CHECK ((state='purged' AND trash_cutoff IS NOT NULL AND marker_until IS NOT NULL)
           OR (state<>'purged' AND marker_until IS NULL))
      );
      CREATE TABLE ${schema}.deleted_flights(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id bigint NOT NULL,
        kind text NOT NULL DEFAULT 'flight' CHECK(kind='flight'),
        uid uuid,
        purge_after timestamptz NOT NULL,
        restored_at timestamptz,
        restored_flight_id bigint,
        flight_data jsonb NOT NULL,
        tracks_data jsonb NOT NULL DEFAULT '[]'::jsonb,
        expenses_data jsonb NOT NULL DEFAULT '[]'::jsonb,
        FOREIGN KEY(owner_id,kind,uid) REFERENCES ${schema}.identity(owner_id,kind,uid)
      );
      CREATE UNIQUE INDEX owned_deleted_uid ON ${schema}.deleted_flights(owner_id,kind,uid) WHERE uid IS NOT NULL;
      CREATE FUNCTION ${schema}.coherence() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE o bigint;k text;u uuid;s text;pending_count int;archive_count int;
      BEGIN
        IF TG_TABLE_NAME='identity' THEN
          IF TG_OP='DELETE' THEN RETURN NULL; END IF;
          o:=NEW.owner_id;k:=NEW.kind;u:=NEW.uid;
        ELSE
          IF TG_OP='DELETE' THEN o:=OLD.owner_id;k:=OLD.kind;u:=OLD.uid;
          ELSE o:=NEW.owner_id;k:=NEW.kind;u:=NEW.uid; END IF;
        END IF;
        IF u IS NULL THEN RETURN NULL; END IF;
        SELECT state INTO s FROM ${schema}.identity
         WHERE owner_id=o AND kind=k AND uid=u;
        SELECT count(*),count(*) FILTER(WHERE restored_at IS NULL)
          INTO archive_count,pending_count
          FROM ${schema}.deleted_flights WHERE owner_id=o AND kind=k AND uid=u;
        IF s='trash' AND (archive_count<>1 OR pending_count<>1)
          THEN RAISE EXCEPTION 'Trash state needs one un-restored archive'; END IF;
        IF s='active' AND pending_count<>0
          THEN RAISE EXCEPTION 'Active state cannot own un-restored Trash'; END IF;
        IF s='purged' AND archive_count<>0
          THEN RAISE EXCEPTION 'Purged marker cannot retain archive'; END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER check_state AFTER INSERT OR UPDATE ON ${schema}.identity
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherence();
      CREATE CONSTRAINT TRIGGER check_archive AFTER INSERT OR UPDATE OR DELETE ON ${schema}.deleted_flights
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherence();
      CREATE FUNCTION ${schema}.purge_owner(p_owner bigint,p_asof timestamptz) RETURNS int
      LANGUAGE plpgsql SECURITY INVOKER AS $$
      DECLARE rec record;v_state text;cleared int:=0;
      BEGIN
        IF p_owner IS NULL OR p_owner<=0 OR p_asof IS NULL THEN
          RAISE EXCEPTION 'Owner/time not supplied'; END IF;
        -- FIRST separate SQL inside this function: lock account gate.
        PERFORM 1 FROM ${schema}.owner_gate WHERE owner_id=p_owner FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Missing owner gate'; END IF;
        -- AFTER gate, get fresh post-lock eligible rows; bounded batch.
        FOR rec IN SELECT * FROM ${schema}.deleted_flights
          WHERE owner_id=p_owner AND purge_after<=p_asof ORDER BY id
          LIMIT 30 FOR UPDATE LOOP
          IF rec.uid IS NOT NULL THEN
            SELECT r.state INTO v_state FROM ${schema}.identity r
              WHERE r.owner_id=p_owner AND r.kind='flight' AND r.uid=rec.uid FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'Missing owner event registry'; END IF;
            IF rec.restored_at IS NULL THEN
              IF v_state<>'trash' THEN
                RAISE EXCEPTION 'Un-restored archive has wrong identity state'; END IF;
              UPDATE ${schema}.identity SET state='purged',
                trash_cutoff=rec.purge_after,
                marker_until=rec.purge_after+INTERVAL '12 months'
                WHERE owner_id=p_owner AND kind='flight' AND uid=rec.uid AND state='trash';
            ELSE
              IF v_state<>'active' THEN RAISE EXCEPTION 'Restored archive must have active identity'; END IF;
            END IF;
          END IF;
          DELETE FROM ${schema}.deleted_flights
            WHERE id=rec.id AND owner_id=p_owner AND purge_after<=p_asof;
          cleared:=cleared+1;
        END LOOP;
        RETURN cleared;
      END $$;
      CREATE FUNCTION ${schema}.expire_markers(p_owner bigint,p_asof timestamptz) RETURNS int
      LANGUAGE plpgsql SECURITY INVOKER AS $$
      DECLARE n int;
      BEGIN
        PERFORM 1 FROM ${schema}.owner_gate WHERE owner_id=p_owner FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Missing owner gate'; END IF;
        DELETE FROM ${schema}.identity WHERE owner_id=p_owner
          AND kind='flight' AND state='purged' AND marker_until<=p_asof;
        GET DIAGNOSTICS n=ROW_COUNT;
        RETURN n;
      END $$;
      INSERT INTO ${schema}.owner_gate(owner_id) VALUES(1),(2),(3);
    `);
    expect.push('PASS test-only owner-gate + deferred three-state shape initialized');

    sql(`BEGIN;
      INSERT INTO ${schema}.identity(owner_id,kind,uid,state) VALUES(1,'flight','${uidA}','active');
      INSERT INTO ${schema}.deleted_flights(owner_id,kind,uid,purge_after,restored_at,restored_flight_id,flight_data,tracks_data,expenses_data)
      VALUES(1,'flight','${uidA}',${cutoff},${oneBefore},987,'{"old":"copy"}','[{"gps":"synthetic"}]','[{"expense":"synthetic"}]');
      INSERT INTO ${schema}.identity(owner_id,kind,uid,state,trash_cutoff) VALUES
        (1,'flight','${uidB}','trash',${cutoff}),
        (2,'flight','${uidC}','trash',${cutoff});
      INSERT INTO ${schema}.deleted_flights(owner_id,kind,uid,purge_after,flight_data,tracks_data,expenses_data) VALUES
        (1,'flight','${uidB}',${cutoff},'{"unrestored":true}','[]','[{"cost":"synthetic"}]'),
        (2,'flight','${uidC}',${cutoff},'{"otherpilot":true}','[]','[]');
      COMMIT;`);
    const pre=sql(`SELECT ${schema}.purge_owner(1,${oneBefore})`).out;
    assert.equal(pre,'0');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.deleted_flights WHERE owner_id=1`).out,'2');
    expect.push('PASS before cutoff both pending and restored Trash archives remain');

    const mismatch=sql(`DELETE FROM ${schema}.deleted_flights WHERE owner_id=1 AND uid='${uidB}'`,true);
    assert.notEqual(mismatch.status,0);assert.match(mismatch.err,/Trash state needs one un-restored archive/);
    expect.push('PASS legacy direct deletion cannot leave un-restored Trash without identity');

    const list=sql(`SELECT ${schema}.purge_owner(1,${cutoff})`).out;
    assert.equal(list,'2');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.deleted_flights WHERE owner_id=1`).out,'0');
    assert.equal(sql(`SELECT state FROM ${schema}.identity WHERE owner_id=1 AND uid='${uidA}'`).out,'active');
    assert.equal(sql(`SELECT state FROM ${schema}.identity WHERE owner_id=1 AND uid='${uidB}'`).out,'purged');
    assert.equal(sql(`SELECT marker_until=(${cutoff}+INTERVAL '12 months') FROM ${schema}.identity WHERE owner_id=1 AND uid='${uidB}'`).out,'t');
    expect.push('PASS list-user path deletes both expired payloads but active restored UID remains active');

    assert.equal(sql(`SELECT count(*) FROM ${schema}.deleted_flights WHERE owner_id=2`).out,'1');
    const sweepOwners=sql(`SELECT DISTINCT owner_id FROM ${schema}.deleted_flights
      WHERE purge_after<=${cutoff} ORDER BY owner_id`).out.split('\n').filter(Boolean);
    assert.deepEqual(sweepOwners,['2']);
    const sweep=sweepOwners.map(x=>sql(`SELECT ${schema}.purge_owner(${Number(x)},${cutoff})`).out);
    assert.deepEqual(sweep,['1']);
    assert.equal(sql(`SELECT state FROM ${schema}.identity WHERE owner_id=2 AND uid='${uidC}'`).out,'purged');
    expect.push('PASS sweep caller uses same per-owner function, unrelated owner untouched until selected');

    const replay=sql(`INSERT INTO ${schema}.identity(owner_id,kind,uid,state)
      VALUES(1,'flight','${uidB}','active')`,true);
    assert.notEqual(replay.status,0);assert.match(replay.err,/duplicate key/);
    assert.equal(sql(`SELECT ${schema}.expire_markers(1,(${cutoff}+INTERVAL '12 months'-INTERVAL '1 microsecond'))`).out,'0');
    assert.equal(sql(`SELECT ${schema}.expire_markers(1,(${cutoff}+INTERVAL '12 months'))`).out,'1');
    assert.equal(sql(`SELECT state FROM ${schema}.identity WHERE owner_id=1 AND uid='${uidA}'`).out,'active');
    expect.push('PASS purged marker resists replay until deadline; active UID not expired');

    // Actual erasure authorization and retention exceptions are NOT modeled.
    sql(`BEGIN;
      INSERT INTO ${schema}.identity(owner_id,kind,uid,state,trash_cutoff,marker_until)
        VALUES(3,'flight','${uidD}','purged',${cutoff},(${cutoff}+INTERVAL '12 months'));
      COMMIT;`);
    sql(`BEGIN;
      SELECT 1 FROM ${schema}.owner_gate WHERE owner_id=3 FOR UPDATE;
      DELETE FROM ${schema}.identity WHERE owner_id=3 AND state='purged';
      COMMIT;`);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.identity WHERE owner_id=3`).out,'0');
    assert.equal(sql(`SELECT count(*) FROM ${schema}.identity WHERE owner_id=2`).out,'1');
    expect.push('PASS modeled erasure removes owner-3 marker without touching owner-2');

    sql(`INSERT INTO ${schema}.deleted_flights(owner_id,kind,uid,purge_after,flight_data)
      VALUES(4,'flight',NULL,${cutoff},'{"legacy":true}')`);
    const noGate=sql(`SELECT ${schema}.purge_owner(4,${cutoff})`,true);
    assert.notEqual(noGate.status,0);assert.match(noGate.err,/Missing owner gate/);
    assert.equal(sql(`SELECT count(*) FROM ${schema}.deleted_flights WHERE owner_id=4`).out,'1');
    sql(`INSERT INTO ${schema}.owner_gate(owner_id) VALUES(4)`);
    assert.equal(sql(`SELECT ${schema}.purge_owner(4,${cutoff})`).out,'1');
    expect.push('PASS missing gate fails closed, legacy NULL UID cleans only with existing owner gate');
    return {expect,pg:identity[4]};
  }finally{
    if(created)sql(`DROP SCHEMA ${schema} CASCADE`);
  }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{const {expect,pg}=runTrashWriterGateProbe();for(const m of expect)console.log(m);console.log(`M0-B TRASH-WRITER GATE ${expect.length}/${expect.length} PASS (PG ${pg}; disposable schema removed)`);}
  catch(e){console.error('M0-B TRASH-WRITER GATE FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1}
}
