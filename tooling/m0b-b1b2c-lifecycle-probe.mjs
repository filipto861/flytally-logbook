// M0-B test-only lifecycle/identity experiment. No runtime/schema migration.
// Creates/drops only a private schema in an explicitly owned disposable PG16.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

export function runLifecycleProbe(env=process.env){
  const target=assertIsolatedTarget(env);
  const cli={...env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
  for(const k of Object.keys(cli))if(/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|USER|PASSFILE|PASSWORD)$/i.test(k))delete cli[k];
  const psql=String(env.FLYTALLY_PSQL||'psql');
  function run(sql,mayFail=false){
    const r=spawnSync(psql,['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d',target.url,'-c',sql],{env:cli,encoding:'utf8',timeout:12000});
    if(r.error)throw r.error;
    if(r.status!==0&&!mayFail)throw Error('Disposable PG16 diagnostic SQL failed: '+r.stderr);
    return {code:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'')};
  }
  const meta=run("SELECT current_database()||'|'||current_user||'|'||inet_server_addr()||'|'||inet_server_port()||'|'||current_setting('server_version_num')").stdout.split('|');
  assert.equal(meta[0],target.databaseName);
  assert.equal(meta[1],'flytally');
  assert.equal(Number(meta[3]),target.port);
  assert.match(meta[4]||'',/^16\d{4}$/);
  const bridge=env.CI==='true'&&/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(meta[2]||'');
  assert.ok(meta[2]==='127.0.0.1'||bridge,'Postgres must be loopback/private CI bridge');
  const schema='"ft_m0b_lifecycle_'+randomUUID().replaceAll('-','')+'"';
  const uid='cc1be481-bce9-4f3e-978f-7f96a2011a5c';
  const uid2='f2e970a6-2944-4525-ae9d-8c21cae2ff35';
  let created=false;
  const results=[];
  try{
    run(`CREATE SCHEMA ${schema}`);created=true;
    run(`
      CREATE TABLE ${schema}.identity(owner_id bigint NOT NULL,kind text NOT NULL CHECK(kind IN ('flight','fstd')),
        uid uuid NOT NULL,state text NOT NULL CHECK(state IN ('active','trash','voided')),fingerprint text,
        PRIMARY KEY(owner_id,kind,uid));
      CREATE TABLE ${schema}.live(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id bigint NOT NULL,kind text NOT NULL,uid uuid NOT NULL,
        data text NOT NULL,UNIQUE(owner_id,kind,uid),
        FOREIGN KEY(owner_id,kind,uid) REFERENCES ${schema}.identity(owner_id,kind,uid));
      CREATE TABLE ${schema}.trash(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id bigint NOT NULL,kind text NOT NULL,uid uuid NOT NULL,
        archived text NOT NULL,UNIQUE(owner_id,kind,uid),
        FOREIGN KEY(owner_id,kind,uid) REFERENCES ${schema}.identity(owner_id,kind,uid));
      CREATE TABLE ${schema}.voided(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_id bigint NOT NULL,kind text NOT NULL,uid uuid NOT NULL,
        signed_hash text NOT NULL,UNIQUE(owner_id,kind,uid),
        FOREIGN KEY(owner_id,kind,uid) REFERENCES ${schema}.identity(owner_id,kind,uid));
      CREATE FUNCTION ${schema}.guard_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable identity registry'; END IF;
        IF (OLD.owner_id,OLD.kind,OLD.uid) IS DISTINCT FROM (NEW.owner_id,NEW.kind,NEW.uid)
          THEN RAISE EXCEPTION 'Identity or owner cannot change'; END IF;
        IF NOT ((OLD.state='active' AND NEW.state IN ('active','trash','voided'))
          OR (OLD.state='trash' AND NEW.state IN ('trash','active'))
          OR (OLD.state='voided' AND NEW.state='voided'))
          THEN RAISE EXCEPTION 'Illegal state transition'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_identity BEFORE UPDATE OR DELETE ON ${schema}.identity
        FOR EACH ROW EXECUTE FUNCTION ${schema}.guard_identity();
      CREATE FUNCTION ${schema}.protect_children() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME='voided' AND TG_OP IN ('UPDATE','DELETE')
          THEN RAISE EXCEPTION 'Voided evidence immutable'; END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        IF TG_OP='UPDATE' AND
          (OLD.owner_id,OLD.kind,OLD.uid) IS DISTINCT FROM (NEW.owner_id,NEW.kind,NEW.uid)
          THEN RAISE EXCEPTION 'Child owner or UID immutable'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER protect_live BEFORE UPDATE OR DELETE ON ${schema}.live
        FOR EACH ROW EXECUTE FUNCTION ${schema}.protect_children();
      CREATE TRIGGER protect_trash BEFORE UPDATE OR DELETE ON ${schema}.trash
        FOR EACH ROW EXECUTE FUNCTION ${schema}.protect_children();
      CREATE TRIGGER protect_void BEFORE UPDATE OR DELETE ON ${schema}.voided
        FOR EACH ROW EXECUTE FUNCTION ${schema}.protect_children();
      CREATE FUNCTION ${schema}.coherent_state() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE o bigint; k text; u uuid; s text; a int; t int; v int;
      BEGIN
        IF TG_OP='DELETE' THEN o:=OLD.owner_id;k:=OLD.kind;u:=OLD.uid;
        ELSE o:=NEW.owner_id;k:=NEW.kind;u:=NEW.uid; END IF;
        SELECT state INTO s FROM ${schema}.identity WHERE owner_id=o AND kind=k AND uid=u;
        SELECT count(*) INTO a FROM ${schema}.live WHERE owner_id=o AND kind=k AND uid=u;
        SELECT count(*) INTO t FROM ${schema}.trash WHERE owner_id=o AND kind=k AND uid=u;
        SELECT count(*) INTO v FROM ${schema}.voided WHERE owner_id=o AND kind=k AND uid=u;
        IF NOT ((s='active' AND a=1 AND t=0 AND v=0)
          OR (s='trash' AND a=0 AND t=1 AND v=0)
          OR (s='voided' AND a=0 AND t=0 AND v=1))
          THEN RAISE EXCEPTION 'Lifecycle mismatch'; END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER check_identity AFTER INSERT OR UPDATE ON ${schema}.identity
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent_state();
      CREATE CONSTRAINT TRIGGER check_live AFTER INSERT OR UPDATE OR DELETE ON ${schema}.live
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent_state();
      CREATE CONSTRAINT TRIGGER check_trash AFTER INSERT OR UPDATE OR DELETE ON ${schema}.trash
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent_state();
      CREATE CONSTRAINT TRIGGER check_void AFTER INSERT OR UPDATE OR DELETE ON ${schema}.voided
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${schema}.coherent_state();
    `);
    run(`BEGIN; INSERT INTO ${schema}.identity VALUES(1,'flight','${uid}','active','same');
      INSERT INTO ${schema}.live(owner_id,kind,uid,data) VALUES(1,'flight','${uid}','original'); COMMIT;`);
    const oldId=run(`SELECT id FROM ${schema}.live WHERE uid='${uid}'`).stdout;
    const incomplete=run(`BEGIN;UPDATE ${schema}.identity SET state='trash' WHERE owner_id=1 AND uid='${uid}';COMMIT;`,true);
    assert.notEqual(incomplete.code,0);
    assert.match(incomplete.stderr,/Lifecycle mismatch/);
    assert.equal(run(`SELECT state FROM ${schema}.identity WHERE uid='${uid}'`).stdout,'active');
    results.push('PASS incomplete lifecycle transition rolls back');
    run(`BEGIN;UPDATE ${schema}.identity SET state='trash' WHERE owner_id=1 AND uid='${uid}';
      INSERT INTO ${schema}.trash(owner_id,kind,uid,archived) SELECT owner_id,kind,uid,data
        FROM ${schema}.live WHERE owner_id=1 AND uid='${uid}';
      DELETE FROM ${schema}.live WHERE owner_id=1 AND uid='${uid}';COMMIT;`);
    assert.equal(run(`SELECT state FROM ${schema}.identity WHERE uid='${uid}'`).stdout,'trash');
    const unsafepurge=run(`DELETE FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}'`,true);
    assert.notEqual(unsafepurge.code,0);assert.match(unsafepurge.stderr,/Lifecycle mismatch/);
    results.push('PASS Trash transition and unsafe retention purge rejected');
    run(`BEGIN;UPDATE ${schema}.identity SET state='active' WHERE owner_id=1 AND uid='${uid}';
      INSERT INTO ${schema}.live(owner_id,kind,uid,data) SELECT owner_id,kind,uid,archived
        FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}';
      DELETE FROM ${schema}.trash WHERE owner_id=1 AND uid='${uid}';COMMIT;`);
    assert.notEqual(run(`SELECT id FROM ${schema}.live WHERE uid='${uid}'`).stdout,oldId);
    results.push('PASS Trash recovery preserves UID while row ID changes');
    run(`BEGIN;UPDATE ${schema}.identity SET state='voided' WHERE owner_id=1 AND uid='${uid}';
      INSERT INTO ${schema}.voided(owner_id,kind,uid,signed_hash) SELECT owner_id,kind,uid,'hash-example'
        FROM ${schema}.live WHERE owner_id=1 AND uid='${uid}';
      DELETE FROM ${schema}.live WHERE owner_id=1 AND uid='${uid}';COMMIT;`);
    const revive=run(`UPDATE ${schema}.identity SET state='active' WHERE owner_id=1 AND uid='${uid}'`,true);
    const rewrite=run(`UPDATE ${schema}.voided SET signed_hash='new' WHERE owner_id=1 AND uid='${uid}'`,true);
    assert.notEqual(revive.code,0);assert.match(revive.stderr,/Illegal state transition/);
    assert.notEqual(rewrite.code,0);assert.match(rewrite.stderr,/Voided evidence immutable/);
    results.push('PASS voided UID cannot resurrect or change signed evidence');
    const collision=run(`INSERT INTO ${schema}.identity VALUES(1,'flight','${uid}','active','same')`,true);
    const missing=run(`INSERT INTO ${schema}.identity VALUES(1,'flight',NULL,'active','same')`,true);
    const wrongOwner=run(`INSERT INTO ${schema}.live(owner_id,kind,uid,data) VALUES(2,'flight','${uid}','invalid')`,true);
    assert.notEqual(collision.code,0);assert.notEqual(missing.code,0);assert.notEqual(wrongOwner.code,0);
    results.push('PASS duplicate/missing UID and foreign owner rejected');
    run(`BEGIN;INSERT INTO ${schema}.identity VALUES
      (1,'flight','${uid2}','active','same'),(2,'flight','${uid}','active','same');
      INSERT INTO ${schema}.live(owner_id,kind,uid,data) VALUES
      (1,'flight','${uid2}','other flight'),(2,'flight','${uid}','another owner');COMMIT;`);
    assert.equal(run(`SELECT count(*) FROM ${schema}.identity WHERE fingerprint='same'`).stdout,'3');
    const changedOwner=run(`UPDATE ${schema}.live SET owner_id=9 WHERE owner_id=2 AND uid='${uid}'`,true);
    assert.notEqual(changedOwner.code,0);
    results.push('PASS same fingerprint across distinct owner/UID; owner immutability');
    const removed=run(`DELETE FROM ${schema}.identity WHERE owner_id=1 AND uid='${uid}'`,true);
    assert.notEqual(removed.code,0);
    results.push('PASS identity reservation cannot be deleted');
    return {results,version:meta[4]};
  }finally{
    if(created)run(`DROP SCHEMA ${schema} CASCADE`);
  }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const r=runLifecycleProbe();
    for(const line of r.results)console.log(line);
    console.log(`M0-B LIFECYCLE DIAGNOSTIC PASS ${r.results.length}/${r.results.length} (PG ${r.version}, test schema removed)`);
  }catch(e){console.error('M0-B LIFECYCLE DIAGNOSTIC FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1}
}
