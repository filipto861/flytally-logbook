#!/usr/bin/env node
// M0-B B1b.2c: test-only real-shaped source owner FKs and database role access.
// Runs ONLY against positively identified OWNED disposable localhost PG16.
// No actual app schema, remote Neon, production database, or runtime is touched.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertIsolatedTarget} from './m0b-b1b2c-concurrency-probe.mjs';

export function runRoleFkProbe(env=process.env) {
  const target=assertIsolatedTarget(env);
  const childEnv={...env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'};
  for(const name of Object.keys(childEnv)) {
    if(/^PG(?:HOST|PORT|DATABASE|SERVICE|SERVICEFILE|OPTIONS|USER|PASSFILE|PASSWORD|REQUIRESSL)$/i.test(name)) delete childEnv[name];
  }
  const cli=String(env.FLYTALLY_PSQL||'psql');
  function q(statement,permitError=false) {
    const result=spawnSync(cli,['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d',target.url,'-c',statement],{
      env:childEnv,encoding:'utf8',timeout:15000
    });
    if(result.error)throw result.error;
    if(result.status!==0&&!permitError)throw Error('Isolated PG16 failed: '+result.stderr);
    return {status:result.status,out:String(result.stdout??'').trim(),err:String(result.stderr??'')};
  }
  const server=q("SELECT current_database()||'|'||current_user||'|'||inet_server_addr()||'|'||inet_server_port()||'|'||current_setting('server_version_num')").out.split('|');
  assert.equal(server[0],target.databaseName);
  assert.equal(server[1],'flytally');
  assert.equal(Number(server[3]),target.port);
  assert.match(server[4]||'',/^16\d{4}$/);
  const dockerAddress=env.CI==='true'&&/^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(server[2]||'');
  assert.ok(server[2]==='127.0.0.1'||dockerAddress);
  const token=randomUUID().replaceAll('-','').slice(0,12);
  const s='"ft_m0b_roles_'+token+'"';
  const pilotA='"ft_m0b_pilota_'+token+'"';
  const pilotB='"ft_m0b_pilotb_'+token+'"';
  const sweeper='"ft_m0b_sweep_'+token+'"';
  const privacy='"ft_m0b_privacy_'+token+'"';
  const roles=[pilotA,pilotB,sweeper,privacy];
  const a='86dd9a0e-0ab1-4eaf-9fed-61f700f79a25';
  const b='7877c0f6-8956-4ed2-8601-9e2a18822837';
  const c='6c80931d-151a-4f36-b78e-4d7d5f832180';
  const d='29a73612-3830-4b2c-a6b3-6c5e35cd602b';
  const e='c749d644-3265-4e3b-8dea-9d6f8318a273';
  const cutoff="'2026-11-03T00:00:00Z'::timestamptz";
  const out=[];
  let schemaCreated=false;
  const createdRoles=[];
  const as=(role,statement,fail=false)=>q(`SET ROLE ${role}; ${statement}`,fail);
  try{
    q(`CREATE SCHEMA ${s}`);schemaCreated=true;
    for(const role of roles){q(`CREATE ROLE ${role} NOLOGIN`);createdRoles.push(role)}
    q(`
      CREATE TABLE ${s}.owner_gate(user_id bigint PRIMARY KEY);
      CREATE TABLE ${s}.test_clock(now_at timestamptz NOT NULL);
      INSERT INTO ${s}.test_clock(now_at) VALUES(${cutoff}-INTERVAL '1 microsecond');
      CREATE TABLE ${s}.flights(
        id bigint PRIMARY KEY,user_id bigint NOT NULL,event_uid uuid,
        certification_hash text NOT NULL DEFAULT '',
        UNIQUE(id,user_id));
      CREATE TABLE ${s}.flight_expenses(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,flight_id bigint NOT NULL,
        user_id bigint NOT NULL,
        CONSTRAINT flight_expenses_owner_flight_fk
        FOREIGN KEY(flight_id,user_id) REFERENCES ${s}.flights(id,user_id) ON DELETE CASCADE);
      CREATE TABLE ${s}.flight_connected_crew(
        source_flight_id bigint NOT NULL,source_user_id bigint NOT NULL,
        connected_user_id bigint NOT NULL,
        FOREIGN KEY(source_flight_id,source_user_id) REFERENCES ${s}.flights(id,user_id));
      CREATE TABLE ${s}.flight_participations(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        source_flight_id bigint NOT NULL REFERENCES ${s}.flights(id),
        source_user_id bigint NOT NULL,participant_user_id bigint NOT NULL,
        participant_flight_id bigint REFERENCES ${s}.flights(id));
      CREATE TABLE ${s}.flight_verifications(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        flight_id bigint NOT NULL REFERENCES ${s}.flights(id),
        flight_user_id bigint NOT NULL,signer_user_id bigint,
        status text NOT NULL, flight_hash text NOT NULL);
      CREATE TABLE ${s}.instructor_flight_approvals(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        flight_id bigint NOT NULL REFERENCES ${s}.flights(id),
        student_user_id bigint NOT NULL,instructor_user_id bigint NOT NULL);
      CREATE TABLE ${s}.fstd_sessions(
        id bigint PRIMARY KEY,user_id bigint NOT NULL,certified_at timestamptz);
      CREATE TABLE ${s}.flight_audit_log(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        flight_id bigint NOT NULL,user_id bigint NOT NULL,
        action text NOT NULL,snapshot jsonb NOT NULL);
      CREATE TABLE ${s}.identity(
        owner_id bigint NOT NULL,kind text NOT NULL CHECK(kind='flight'),
        event_uid uuid NOT NULL,state text NOT NULL CHECK(state IN('active','trash','purged','voided')),
        trash_cutoff timestamptz,marker_until timestamptz,
        PRIMARY KEY(owner_id,kind,event_uid));
      CREATE TABLE ${s}.deleted_flights(
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id bigint NOT NULL,kind text NOT NULL DEFAULT 'flight' CHECK(kind='flight'),
        event_uid uuid,purge_after timestamptz NOT NULL,
        restored_at timestamptz,restored_flight_id bigint,
        flight_data jsonb NOT NULL,
        tracks_data jsonb NOT NULL DEFAULT '[]'::jsonb,
        expenses_data jsonb NOT NULL DEFAULT '[]'::jsonb,
        FOREIGN KEY(user_id,kind,event_uid) REFERENCES ${s}.identity(owner_id,kind,event_uid));
      CREATE UNIQUE INDEX owned_archived_uid ON ${s}.deleted_flights(user_id,kind,event_uid) WHERE event_uid IS NOT NULL;
      CREATE FUNCTION ${s}.check_state() RETURNS trigger LANGUAGE plpgsql
      SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $
      DECLARE v_owner bigint;v_kind text;v_uid uuid;v_state text;v_unrestored int;v_archives int;
      BEGIN
        IF TG_TABLE_NAME='identity' THEN
          IF TG_OP='DELETE' THEN RETURN NULL;END IF;
          v_owner:=NEW.owner_id;v_kind:=NEW.kind;v_uid:=NEW.event_uid;
        ELSE
          IF TG_OP='DELETE' THEN v_owner:=OLD.user_id;v_kind:=OLD.kind;v_uid:=OLD.event_uid;
          ELSE v_owner:=NEW.user_id;v_kind:=NEW.kind;v_uid:=NEW.event_uid;END IF;
        END IF;
        IF v_uid IS NULL THEN RETURN NULL; END IF;
        SELECT i.state INTO v_state FROM ${s}.identity i
          WHERE i.owner_id=v_owner AND i.kind=v_kind AND i.event_uid=v_uid;
        SELECT count(*),count(*) FILTER(WHERE restored_at IS NULL)
          INTO v_archives,v_unrestored FROM ${s}.deleted_flights
          WHERE user_id=v_owner AND kind=v_kind AND event_uid=v_uid;
        IF v_state='trash' AND (v_archives<>1 OR v_unrestored<>1)
          THEN RAISE EXCEPTION 'Trash needs a pending archive';END IF;
        IF v_state='active' AND v_unrestored<>0
          THEN RAISE EXCEPTION 'Active event has pending Trash';END IF;
        IF v_state='purged' AND v_archives<>0
          THEN RAISE EXCEPTION 'Purged marker still has payload';END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER check_identity AFTER INSERT OR UPDATE ON ${s}.identity
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${s}.check_state();
      CREATE CONSTRAINT TRIGGER check_archives AFTER INSERT OR UPDATE OR DELETE ON ${s}.deleted_flights
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${s}.check_state();

      CREATE FUNCTION ${s}.cleanup_owner(p_owner bigint) RETURNS int
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
      DECLARE rec record;v_now timestamptz;v_state text;v_count int:=0;v_matches int;
      BEGIN
        -- The first real DB access locks this owner's guard.
        PERFORM 1 FROM ${s}.owner_gate g WHERE g.user_id=p_owner FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Missing account gate';END IF;
        -- Fresh post-lock read in a separate statement.
        SELECT now_at INTO v_now FROM ${s}.test_clock;
        FOR rec IN SELECT * FROM ${s}.deleted_flights d
          WHERE d.user_id=p_owner AND d.purge_after<=v_now ORDER BY d.id LIMIT 25 FOR UPDATE
        LOOP
          IF rec.event_uid IS NOT NULL THEN
            SELECT i.state INTO v_state FROM ${s}.identity i
              WHERE i.owner_id=p_owner AND i.kind='flight' AND i.event_uid=rec.event_uid FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'Missing event registry';END IF;
            IF rec.restored_at IS NULL THEN
              IF v_state<>'trash' THEN RAISE EXCEPTION 'Pending Trash state mismatch';END IF;
              UPDATE ${s}.identity i SET state='purged',trash_cutoff=rec.purge_after,
                marker_until=rec.purge_after+INTERVAL '12 months'
                WHERE i.owner_id=p_owner AND i.kind='flight' AND i.event_uid=rec.event_uid AND i.state='trash';
            ELSE
              IF v_state<>'active' THEN RAISE EXCEPTION 'Restored archive state mismatch';END IF;
              SELECT count(*) INTO v_matches FROM ${s}.flights f
                WHERE f.id=rec.restored_flight_id AND f.user_id=p_owner AND f.event_uid=rec.event_uid;
              IF v_matches<>1 THEN RAISE EXCEPTION 'Restored flight owner or UID mismatch';END IF;
            END IF;
          END IF;
          DELETE FROM ${s}.deleted_flights d WHERE d.id=rec.id AND d.user_id=p_owner;
          v_count:=v_count+1;
        END LOOP;
        RETURN v_count;
      END $$;
      CREATE FUNCTION ${s}.pilot_a_cleanup() RETURNS int
        LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS
        $$ SELECT ${s}.cleanup_owner(101) $$;
      CREATE FUNCTION ${s}.pilot_b_cleanup() RETURNS int
        LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS
        $$ SELECT ${s}.cleanup_owner(202) $$;
      CREATE FUNCTION ${s}.sweep_cleanup() RETURNS int
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
      DECLARE row record;total int:=0;
      BEGIN
        FOR row IN SELECT DISTINCT d.user_id FROM ${s}.deleted_flights d
          WHERE d.purge_after <= (SELECT now_at FROM ${s}.test_clock) ORDER BY d.user_id
        LOOP total:=total+${s}.cleanup_owner(row.user_id);END LOOP;
        RETURN total;
      END $$;
      CREATE FUNCTION ${s}.erase_purged(p_owner bigint) RETURNS int
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
      DECLARE deleted int;
      BEGIN
        PERFORM 1 FROM ${s}.owner_gate g WHERE g.user_id=p_owner FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Missing account gate';END IF;
        DELETE FROM ${s}.identity i WHERE i.owner_id=p_owner AND i.kind='flight' AND i.state='purged';
        GET DIAGNOSTICS deleted=ROW_COUNT;
        RETURN deleted;
      END $$;
      REVOKE ALL ON SCHEMA ${s} FROM PUBLIC;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA ${s} FROM PUBLIC;
      GRANT USAGE ON SCHEMA ${s} TO ${pilotA},${pilotB},${sweeper},${privacy};
      GRANT EXECUTE ON FUNCTION ${s}.pilot_a_cleanup() TO ${pilotA};
      GRANT EXECUTE ON FUNCTION ${s}.pilot_b_cleanup() TO ${pilotB};
      GRANT EXECUTE ON FUNCTION ${s}.sweep_cleanup() TO ${sweeper};
      GRANT EXECUTE ON FUNCTION ${s}.erase_purged(bigint) TO ${privacy};
      INSERT INTO ${s}.owner_gate(user_id) VALUES(101),(202),(303);
      INSERT INTO ${s}.flights(id,user_id,event_uid,certification_hash) VALUES
        (10,101,'${a}',''),
        (20,202,NULL,''),
        (30,202,'${d}','CERTIFIED-VOID-SYNTHETIC'),
        (40,101,'${e}','');
      INSERT INTO ${s}.fstd_sessions(id,user_id) VALUES(71,101),(72,202);
      INSERT INTO ${s}.flight_expenses(flight_id,user_id) VALUES(10,101);
      INSERT INTO ${s}.flight_connected_crew(source_flight_id,source_user_id,connected_user_id)
        VALUES(10,101,202);
      INSERT INTO ${s}.flight_audit_log(flight_id,user_id,action,snapshot)
        VALUES(30,202,'certified','{"synthetic":true}');
      INSERT INTO ${s}.flight_participations(source_flight_id,source_user_id,participant_user_id)
        VALUES(10,101,202);
      INSERT INTO ${s}.identity(owner_id,kind,event_uid,state,trash_cutoff) VALUES
        (101,'flight','${a}','active',NULL),
        (101,'flight','${b}','trash',${cutoff}),
        (202,'flight','${c}','trash',${cutoff}),
        (202,'flight','${d}','voided',NULL);
      INSERT INTO ${s}.deleted_flights(user_id,kind,event_uid,purge_after,restored_at,restored_flight_id,flight_data)
        VALUES (101,'flight','${a}',${cutoff},${cutoff}-INTERVAL '1 day',10,'{"restored":true}');
      INSERT INTO ${s}.deleted_flights(user_id,kind,event_uid,purge_after,flight_data)
        VALUES (101,'flight','${b}',${cutoff},'{"pending":true}'),
               (202,'flight','${c}',${cutoff},'{"other":true}');
    `);
    out.push('PASS real-declared owner FK shapes installed; independent roles and owner gate created');

    const badExpense=q(`INSERT INTO ${s}.flight_expenses(flight_id,user_id) VALUES(10,202)`,true);
    assert.notEqual(badExpense.status,0);assert.match(badExpense.err,/foreign key constraint/);
    const badCrew=q(`INSERT INTO ${s}.flight_connected_crew(source_flight_id,source_user_id,connected_user_id)
      VALUES(10,202,101)`,true);
    assert.notEqual(badCrew.status,0);assert.match(badCrew.err,/foreign key constraint/);
    out.push('PASS composite owner FKs reject foreign expenses and source connected crew');

    q(`INSERT INTO ${s}.flight_participations(source_flight_id,source_user_id,participant_user_id)
      VALUES(10,202,101)`);
    assert.equal(q(`SELECT count(*) FROM ${s}.flight_participations p
      JOIN ${s}.flights f ON f.id=p.source_flight_id
      WHERE p.source_user_id<>f.user_id`).out,'1');
    q(`DELETE FROM ${s}.flight_participations p WHERE p.source_user_id=202 AND p.source_flight_id=10`);
    out.push('PASS numeric-only participation FK admits mismatched owner; source must be separately validated');

    assert.notEqual(as(pilotA,`SELECT count(*) FROM ${s}.deleted_flights`,true).status,0);
    assert.notEqual(as(pilotA,`DELETE FROM ${s}.deleted_flights WHERE user_id=202`,true).status,0);
    assert.notEqual(as(pilotA,`SELECT ${s}.cleanup_owner(202)`,true).status,0);
    assert.notEqual(as(pilotA,`SELECT ${s}.pilot_b_cleanup()`,true).status,0);
    assert.notEqual(as(pilotA,`SELECT ${s}.sweep_cleanup()`,true).status,0);
    assert.notEqual(as(pilotB,`SELECT ${s}.pilot_a_cleanup()`,true).status,0);
    assert.notEqual(as(sweeper,`SELECT ${s}.pilot_a_cleanup()`,true).status,0);
    assert.notEqual(as(pilotA,`SELECT ${s}.erase_purged(202)`,true).status,0);
    out.push('PASS restricted DB roles reject raw tables, foreign-owner cleanup and privileged paths');

    assert.equal(as(pilotA,`SELECT ${s}.pilot_a_cleanup()`).out,'0');
    assert.equal(q(`SELECT count(*) FROM ${s}.deleted_flights WHERE user_id=101`).out,'2');
    q(`UPDATE ${s}.test_clock SET now_at=${cutoff}`);
    assert.equal(as(pilotA,`SELECT ${s}.pilot_a_cleanup()`).out,'2');
    assert.equal(q(`SELECT count(*) FROM ${s}.deleted_flights WHERE user_id=101`).out,'0');
    assert.equal(q(`SELECT state FROM ${s}.identity WHERE owner_id=101 AND event_uid='${a}'`).out,'active');
    assert.equal(q(`SELECT state FROM ${s}.identity WHERE owner_id=101 AND event_uid='${b}'`).out,'purged');
    assert.equal(q(`SELECT marker_until=${cutoff}+INTERVAL '12 months'
      FROM ${s}.identity WHERE owner_id=101 AND event_uid='${b}'`).out,'t');
    out.push('PASS pilot-101 cleanup handles pending and restored archives; live recovered UID stays active');

    assert.equal(q(`SELECT count(*) FROM ${s}.deleted_flights WHERE user_id=202`).out,'1');
    assert.equal(as(sweeper,`SELECT ${s}.sweep_cleanup()`).out,'1');
    assert.equal(q(`SELECT state FROM ${s}.identity WHERE owner_id=202 AND event_uid='${c}'`).out,'purged');
    assert.equal(q(`SELECT state FROM ${s}.identity WHERE owner_id=202 AND event_uid='${d}'`).out,'voided');
    assert.equal(q(`SELECT count(*) FROM ${s}.flight_audit_log WHERE flight_id=30 AND user_id=202`).out,'1');
    assert.equal(q(`SELECT count(*) FROM ${s}.fstd_sessions`).out,'2');
    out.push('PASS authorized sweep performs owner-bounded cleanup, preserves void/audit/FSTD');

    q(`BEGIN;
      INSERT INTO ${s}.identity(owner_id,kind,event_uid,state) VALUES(101,'flight','${e}','active');
      INSERT INTO ${s}.deleted_flights(user_id,kind,event_uid,purge_after,restored_at,restored_flight_id,flight_data)
        VALUES(101,'flight','${e}',${cutoff},${cutoff}-INTERVAL '1 day',20,'{"mismatch":true}');
      COMMIT;`);
    const unsafe=as(pilotA,`SELECT ${s}.pilot_a_cleanup()`,true);
    assert.notEqual(unsafe.status,0);assert.match(unsafe.err,/Restored flight owner or UID mismatch/);
    assert.equal(q(`SELECT count(*) FROM ${s}.deleted_flights WHERE user_id=101 AND event_uid='${e}'`).out,'1');
    q(`UPDATE ${s}.deleted_flights SET restored_flight_id=40
       WHERE user_id=101 AND event_uid='${e}'`);
    assert.equal(as(pilotA,`SELECT ${s}.pilot_a_cleanup()`).out,'1');
    assert.equal(q(`SELECT state FROM ${s}.identity WHERE owner_id=101 AND event_uid='${e}'`).out,'active');
    out.push('PASS spoofed restored_flight_id fails closed and rolls back; corrected owner/UID is accepted');

    assert.notEqual(as(pilotA,`SELECT ${s}.erase_purged(101)`,true).status,0);
    assert.equal(as(privacy,`SELECT ${s}.erase_purged(101)`).out,'1');
    assert.equal(q(`SELECT count(*) FROM ${s}.identity WHERE owner_id=101 AND state='active'`).out,'2');
    assert.equal(q(`SELECT count(*) FROM ${s}.identity WHERE owner_id=202 AND state='purged'`).out,'1');
    assert.equal(q(`SELECT count(*) FROM ${s}.flight_audit_log`).out,'1');
    out.push('PASS privacy-only scoped marker erasure leaves active identities and other-owner proof unchanged');

    q(`INSERT INTO ${s}.deleted_flights(user_id,kind,event_uid,purge_after,flight_data)
       VALUES(303,'flight',NULL,${cutoff},'{"legacy":true}')`);
    assert.equal(as(sweeper,`SELECT ${s}.sweep_cleanup()`).out,'1');
    assert.equal(q(`SELECT count(*) FROM ${s}.deleted_flights WHERE user_id=303`).out,'0');
    out.push('PASS legacy NULL-UID archive purged without manufacturing trusted identity');
    return {cases:out,pg:server[4]};
  }finally{
    if(schemaCreated)q(`DROP SCHEMA ${s} CASCADE`);
    for(const role of createdRoles.reverse())q(`DROP ROLE IF EXISTS ${role}`);
  }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const r=runRoleFkProbe();for(const message of r.cases)console.log(message);
    console.log(`M0-B ROLE-FK PG16 DIAGNOSTIC ${r.cases.length}/${r.cases.length} PASS (${r.pg}; disposable schema and roles removed)`);
  }catch(error){
    console.error('M0-B ROLE-FK PG16 DIAGNOSTIC FAIL:',error instanceof Error?error.message:String(error));
    process.exitCode=1;
  }
}
