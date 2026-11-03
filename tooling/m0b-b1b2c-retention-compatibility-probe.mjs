#!/usr/bin/env node
// M0-B B1b.2c test-only. Creates/drops a random schema in an explicitly owned
// disposable local PG16. This is NOT the application schema or a migration.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

export function runCompatibilityProbe(env=process.env){
  const target=assertIsolatedTarget(env);
  const cli={...env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
  for(const k of Object.keys(cli))if(/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|USER|PASSFILE|PASSWORD|REQUIRESSL)$/i.test(k))delete cli[k];
  const command=String(env.FLYTALLY_PSQL||'psql');
  function query(sql,allowError=false){
    const x=spawnSync(command,['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d',target.url,'-c',sql],{
      env:cli,encoding:'utf8',timeout:12000,
    });
    if(x.error)throw x.error;
    if(x.status!==0&&!allowError)throw Error('Disposable PG16 only: '+x.stderr);
    return {status:x.status,out:String(x.stdout??'').trim(),error:String(x.stderr??'')};
  }
  const meta=query("SELECT current_database()||'|'||current_user||'|'||inet_server_addr()||'|'||inet_server_port()||'|'||current_setting('server_version_num')").out.split('|');
  assert.equal(meta[0],target.databaseName);
  assert.equal(meta[1],'flytally');
  assert.equal(Number(meta[3]),target.port);
  assert.match(meta[4]||'',/^16\d{4}$/);
  const ciBridge=env.CI==='true'&&/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(meta[2]||'');
  assert.ok(meta[2]==='127.0.0.1'||ciBridge);
  const schema='"ft_m0b_retention_'+randomUUID().replaceAll('-','')+'"';
  const A='870fca46-c01f-4b47-aada-6c3d2c038b6a',B='90639a89-5ff6-42b4-b690-aeddd0d3cfe5';
  let created=false;
  const messages=[];
  try{
    query(`CREATE SCHEMA ${schema}`);created=true;
    query(`
      CREATE TABLE ${schema}.flights(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id bigint NOT NULL,
        event_uid uuid NULL,
        fingerprint text NOT NULL,
        note text NOT NULL DEFAULT '',
        UNIQUE(id,user_id));
      CREATE UNIQUE INDEX new_flight_uid ON ${schema}.flights(user_id,event_uid)
        WHERE event_uid IS NOT NULL;
      CREATE TABLE ${schema}.flight_expenses(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        flight_id bigint NOT NULL,user_id bigint NOT NULL,
        FOREIGN KEY(flight_id,user_id) REFERENCES ${schema}.flights(id,user_id) ON DELETE CASCADE);
      CREATE TABLE ${schema}.fstd_sessions(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id bigint NOT NULL,
        event_uid uuid NULL,certified_at timestamptz NULL,
        total_minutes integer NOT NULL CHECK(total_minutes>=0));
      CREATE UNIQUE INDEX new_fstd_uid ON ${schema}.fstd_sessions(user_id,event_uid)
        WHERE event_uid IS NOT NULL;
      CREATE TABLE ${schema}.fstd_certified_revisions(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        fstd_session_id bigint NOT NULL,user_id bigint NOT NULL,
        revision_number integer NOT NULL,snapshot jsonb NOT NULL,
        UNIQUE(user_id,fstd_session_id,revision_number));
      CREATE TABLE ${schema}.registry(
        owner_id bigint NOT NULL,kind text NOT NULL CHECK(kind IN('flight','fstd')),
        event_uid uuid NOT NULL,
        state text NOT NULL CHECK(state IN('active','trash','purged','voided')),
        PRIMARY KEY(owner_id,kind,event_uid));
      CREATE TABLE ${schema}.deleted_flights(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id bigint NOT NULL,
        event_uid uuid NULL,
        original_flight_id bigint NOT NULL,
        flight_data jsonb NOT NULL,
        purge_after timestamptz NOT NULL);
      CREATE FUNCTION ${schema}.archive_state() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE o bigint;u uuid;s text;n int;
      BEGIN
        IF TG_TABLE_NAME='registry' THEN
          o:=CASE WHEN TG_OP='DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
          u:=CASE WHEN TG_OP='DELETE' THEN OLD.event_uid ELSE NEW.event_uid END;
        ELSE
          o:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
          u:=CASE WHEN TG_OP='DELETE' THEN OLD.event_uid ELSE NEW.event_uid END;
        END IF;
        IF u IS NULL THEN RETURN NULL; END IF;
        SELECT state INTO s FROM ${schema}.registry WHERE owner_id=o AND kind='flight' AND event_uid=u;
        SELECT COUNT(*) INTO n FROM ${schema}.deleted_flights WHERE user_id=o AND event_uid=u;
        IF s='trash' AND n<>1 THEN RAISE EXCEPTION 'Trash registry requires archive'; END IF;
        IF s='purged' AND n<>0 THEN RAISE EXCEPTION 'Purged registry must not contain archive'; END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER check_registry
        AFTER INSERT OR UPDATE OR DELETE ON ${schema}.registry DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION ${schema}.archive_state();
      CREATE CONSTRAINT TRIGGER check_trash
        AFTER INSERT OR UPDATE OR DELETE ON ${schema}.deleted_flights DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION ${schema}.archive_state();
    `);
    const old=query(`INSERT INTO ${schema}.flights(user_id,fingerprint,note)
      VALUES(1,'LEGACY','pre-v22') RETURNING id`).out;
    const oldFstd=query(`INSERT INTO ${schema}.fstd_sessions(user_id,total_minutes)
      VALUES(1,50) RETURNING id`).out;
    query(`UPDATE ${schema}.flights SET note='still-editable' WHERE id=${old} AND user_id=1`);
    query(`UPDATE ${schema}.fstd_sessions SET total_minutes=55 WHERE id=${oldFstd} AND user_id=1`);
    assert.equal(query(`SELECT event_uid IS NULL FROM ${schema}.flights WHERE id=${old}`).out,'t');
    assert.equal(query(`SELECT event_uid IS NULL FROM ${schema}.fstd_sessions WHERE id=${oldFstd}`).out,'t');
    messages.push('PASS nullable new UID preserves legacy flight and FSTD edits');
    query(`INSERT INTO ${schema}.fstd_certified_revisions(fstd_session_id,user_id,revision_number,snapshot)
      VALUES(${oldFstd},1,1,'{"minutes":55}'::jsonb)`);
    assert.equal(query(`SELECT count(*) FROM ${schema}.fstd_certified_revisions WHERE fstd_session_id=${oldFstd}`).out,'1');
    const foreign=query(`INSERT INTO ${schema}.flight_expenses(flight_id,user_id) VALUES(${old},2)`,true);
    assert.notEqual(foreign.status,0);
    assert.match(foreign.error,/foreign key constraint/);
    messages.push('PASS existing expense composite FK rejects other account, FSTD snapshot remains separate');
    query(`INSERT INTO ${schema}.flights(user_id,event_uid,fingerprint,note)
      VALUES(1,'${A}','SAME','new-a'),(1,'${B}','SAME','new-b')`);
    assert.equal(query(`SELECT count(*) FROM ${schema}.flights WHERE user_id=1 AND fingerprint='SAME'`).out,'2');
    const dupe=query(`INSERT INTO ${schema}.flights(user_id,event_uid,fingerprint,note)
      VALUES(1,'${A}','DIFFERENT','duplicate')`,true);
    assert.notEqual(dupe.status,0);assert.match(dupe.error,/duplicate key/);
    messages.push('PASS new owner UID UNIQUE, but heuristic fingerprint remains non-unique');

    // Simulate an expired Trash record under a future lifecycle registry.
    query(`BEGIN;INSERT INTO ${schema}.registry VALUES(1,'flight','${A}','trash');
      INSERT INTO ${schema}.deleted_flights(user_id,event_uid,original_flight_id,flight_data,purge_after)
      VALUES(1,'${A}',${old},'{"synthetic":true}'::jsonb,NOW()-INTERVAL '1 day');COMMIT;`);
    // Existing two deletion paths issue this direct DELETE without registry state transition.
    const listing=query(`DELETE FROM ${schema}.deleted_flights WHERE user_id=1 AND purge_after<=NOW()`,true);
    assert.notEqual(listing.status,0);assert.match(listing.error,/Trash registry requires archive/);
    const sweep=query(`DELETE FROM ${schema}.deleted_flights WHERE purge_after<=NOW()`,true);
    assert.notEqual(sweep.status,0);assert.match(sweep.error,/Trash registry requires archive/);
    messages.push('PASS both old Trash purge SQL shapes become incompatible with strict registry');
    // Candidate A: remove payload but retain linkable identity marker. Policy NOT approved.
    query(`BEGIN;UPDATE ${schema}.registry SET state='purged' WHERE owner_id=1 AND kind='flight' AND event_uid='${A}';
      DELETE FROM ${schema}.deleted_flights WHERE user_id=1 AND event_uid='${A}';COMMIT;`);
    assert.equal(query(`SELECT state FROM ${schema}.registry WHERE owner_id=1 AND event_uid='${A}'`).out,'purged');
    assert.equal(query(`SELECT count(*) FROM ${schema}.deleted_flights WHERE event_uid='${A}'`).out,'0');
    const replayA=query(`INSERT INTO ${schema}.registry VALUES(1,'flight','${A}','active')`,true);
    assert.notEqual(replayA.status,0);assert.match(replayA.error,/duplicate key/);
    messages.push('PASS candidate A purge requires atomic state change; retained UID rejects replay');

    // Candidate B: delete archive + owner-linked marker together. No prior-state
    // evidence survives. Reusing that UID becomes possible: a deliberate risk.
    query(`BEGIN;INSERT INTO ${schema}.registry VALUES(1,'flight','${B}','trash');
      INSERT INTO ${schema}.deleted_flights(user_id,event_uid,original_flight_id,flight_data,purge_after)
      VALUES(1,'${B}',${old},'{"synthetic":true}'::jsonb,NOW()-INTERVAL '1 day');COMMIT;`);
    query(`BEGIN;DELETE FROM ${schema}.deleted_flights WHERE user_id=1 AND event_uid='${B}';
      DELETE FROM ${schema}.registry WHERE owner_id=1 AND event_uid='${B}';COMMIT;`);
    assert.equal(query(`SELECT count(*) FROM ${schema}.registry WHERE owner_id=1 AND event_uid='${B}'`).out,'0');
    // Avoid misrepresenting replay as safe: this is evidence of identity LOSS.
    query(`INSERT INTO ${schema}.registry VALUES(1,'flight','${B}','active')`);
    messages.push('PASS candidate B deletion loses replay reservation (explicit security trade-off)');
    query(`INSERT INTO ${schema}.deleted_flights(user_id,original_flight_id,flight_data,purge_after)
      VALUES(1,${old},'{"legacy":true}'::jsonb,NOW()-INTERVAL '1 day')`);
    query(`DELETE FROM ${schema}.deleted_flights WHERE event_uid IS NULL AND purge_after<=NOW()`);
    messages.push('PASS legacy NULL-UID Trash remains cleanable without inferred source trust');
    return {messages,version:meta[4]};
  }finally{
    if(created)query(`DROP SCHEMA ${schema} CASCADE`);
  }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{const r=runCompatibilityProbe();r.messages.forEach(x=>console.log(x));console.log(
    `M0-B REAL-SHAPE RETENTION DIAGNOSTIC ${r.messages.length}/${r.messages.length} PASS (PG ${r.version}; test schema removed)`);}
  catch(e){console.error('M0-B REAL-SHAPE RETENTION DIAGNOSTIC FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1;}
}
