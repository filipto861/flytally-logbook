import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schema=`ft_sp2_pic_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}

function connectedContext(target:number,manual:string){
  return `SELECT CASE WHEN ${target}>0 THEN u.id ELSE NULL END connected_user_id,
    CASE WHEN ${target}>0 THEN u.display_name ELSE '${manual.replaceAll("'","''")}' END commander
    FROM (SELECT 1) seed
    LEFT JOIN LATERAL (
      SELECT u.id,u.display_name FROM users u
      WHERE u.id=${target} AND u.id<>1 AND NULLIF(TRIM(u.display_name),'') IS NOT NULL
        AND EXISTS(
          SELECT 1 FROM pilot_connections pc
          WHERE pc.status='accepted'
            AND ((pc.requester_user_id=1 AND pc.recipient_user_id=u.id)
              OR (pc.recipient_user_id=1 AND pc.requester_user_id=u.id))
        )
      LIMIT 1
    ) u ON ${target}>0
    WHERE ${target}=0 OR u.id IS NOT NULL`;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for Safety Pilot/PIC SP2 PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL);
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id),
      recipient_user_id BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL
    );
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      commander TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'SAFETY PILOT',
      note TEXT NOT NULL DEFAULT '',
      locked_at TIMESTAMPTZ,
      certified_at TIMESTAMPTZ,
      UNIQUE(id,user_id)
    );
    CREATE TABLE flight_connected_crew(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL,
      source_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      intended_role TEXT NOT NULL CHECK(intended_role='PIC'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT flight_connected_crew_source_owner_fk FOREIGN KEY(source_flight_id,source_user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE,
      CONSTRAINT flight_connected_crew_distinct_users_check CHECK(source_user_id<>connected_user_id),
      CONSTRAINT flight_connected_crew_flight_role_uq UNIQUE(source_flight_id,intended_role)
    );
    INSERT INTO users(id,display_name) VALUES(1,'Source Pilot'),(2,'Connected PIC'),(3,'Other Pilot');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(1,2,'accepted');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("SP2 connected create canonicalizes commander and creates link atomically",{skip:!enabled},()=>{
  const id=run(`WITH pic_context AS (${connectedContext(2,"Spoofed Client Name")}),
    inserted AS (
      INSERT INTO flights(user_id,commander,role,note)
      SELECT 1,p.commander,'SAFETY PILOT','connected create' FROM pic_context p RETURNING id
    ),connected_link AS (
      INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
      SELECT inserted.id,1,p.connected_user_id,'PIC',NOW()
      FROM inserted CROSS JOIN pic_context p WHERE p.connected_user_id IS NOT NULL
      RETURNING id
    )
    SELECT id FROM inserted`);
  assert.ok(Number(id)>0);
  assert.equal(run(`SELECT commander FROM flights WHERE id=${Number(id)}`),"Connected PIC");
  assert.equal(run(`SELECT connected_user_id FROM flight_connected_crew WHERE source_flight_id=${Number(id)}`),"2");
});

test("SP2 unaccepted connected create inserts nothing",{skip:!enabled},()=>{
  const before=run("SELECT COUNT(*) FROM flights");
  const result=run(`WITH pic_context AS (${connectedContext(3,"Spoof")}),
    inserted AS (
      INSERT INTO flights(user_id,commander,role,note)
      SELECT 1,p.commander,'SAFETY PILOT','must not exist' FROM pic_context p RETURNING id
    )
    SELECT id FROM inserted`);
  assert.equal(result,"");
  assert.equal(run("SELECT COUNT(*) FROM flights"),before);
});

test("SP2 update replaces link, manual mode removes it, and revoked connection causes no partial mutation",{skip:!enabled},()=>{
  const flightId=Number(run(`INSERT INTO flights(user_id,commander,role,note) VALUES(1,'Connected PIC','SAFETY PILOT','baseline') RETURNING id`));
  run(`INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(${flightId},1,2,'PIC')`);
  run("INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(1,3,'accepted')");

  run(`WITH pic_context AS (${connectedContext(3,"ignored")}),
    updated AS (
      UPDATE flights f SET commander=p.commander,note='connected update'
      FROM pic_context p
      WHERE f.id=${flightId} AND f.user_id=1 AND f.locked_at IS NULL AND f.certified_at IS NULL
      RETURNING f.id
    ),connected_link AS (
      INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
      SELECT updated.id,1,p.connected_user_id,'PIC',NOW()
      FROM updated CROSS JOIN pic_context p WHERE p.connected_user_id IS NOT NULL
      ON CONFLICT(source_flight_id,intended_role) DO UPDATE SET connected_user_id=EXCLUDED.connected_user_id,updated_at=NOW()
      RETURNING id
    )
    SELECT id FROM updated`);
  assert.equal(run(`SELECT commander||'|'||note FROM flights WHERE id=${flightId}`),"Other Pilot|connected update");
  assert.equal(run(`SELECT connected_user_id FROM flight_connected_crew WHERE source_flight_id=${flightId}`),"3");

  run("UPDATE pilot_connections SET status='pending' WHERE requester_user_id=1 AND recipient_user_id=3");
  const rejected=run(`WITH pic_context AS (${connectedContext(3,"ignored")}),
    updated AS (
      UPDATE flights f SET commander=p.commander,note='should not save'
      FROM pic_context p
      WHERE f.id=${flightId} AND f.user_id=1 AND f.locked_at IS NULL
      RETURNING f.id
    )
    SELECT id FROM updated`);
  assert.equal(rejected,"");
  assert.equal(run(`SELECT commander||'|'||note FROM flights WHERE id=${flightId}`),"Other Pilot|connected update");
  assert.equal(run(`SELECT connected_user_id FROM flight_connected_crew WHERE source_flight_id=${flightId}`),"3");

  run(`WITH pic_context AS (${connectedContext(0,"Manual Captain")}),
    updated AS (
      UPDATE flights f SET commander=p.commander,note='manual update'
      FROM pic_context p WHERE f.id=${flightId} AND f.user_id=1 AND f.locked_at IS NULL RETURNING f.id
    ),deleted_link AS (
      DELETE FROM flight_connected_crew
      WHERE source_flight_id=${flightId} AND source_user_id=1 AND intended_role='PIC'
        AND EXISTS(SELECT 1 FROM updated)
      RETURNING id
    )
    SELECT id FROM updated`);
  assert.equal(run(`SELECT commander||'|'||note FROM flights WHERE id=${flightId}`),"Manual Captain|manual update");
  assert.equal(run(`SELECT COUNT(*) FROM flight_connected_crew WHERE source_flight_id=${flightId}`),"0");
});
