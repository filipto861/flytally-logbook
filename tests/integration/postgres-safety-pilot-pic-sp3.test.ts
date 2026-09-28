import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_sp3_pic_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}
function inviteSql(){
  const source=fs.readFileSync(path.join(root,"app/(protected)/flights/shared-actions.ts"),"utf8");
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  const block=blocks.find(value=>value.includes("INSERT INTO flight_participations")&&value.includes("JOIN flight_connected_crew c"));
  assert.ok(block,"SP3 production invite SQL is present");
  return block;
}
function literal(value:unknown){return typeof value==="number"?String(value):`'${String(value).replaceAll("'","''")}'`}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for Safety Pilot/PIC SP3 PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL);
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      certified_at TIMESTAMPTZ,
      certification_hash TEXT NOT NULL DEFAULT '',
      record_revision INTEGER NOT NULL DEFAULT 1,
      UNIQUE(id,user_id)
    );
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id),
      recipient_user_id BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL
    );
    CREATE TABLE flight_connected_crew(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL,
      source_user_id BIGINT NOT NULL REFERENCES users(id),
      connected_user_id BIGINT NOT NULL REFERENCES users(id),
      intended_role TEXT NOT NULL CHECK(intended_role='PIC'),
      UNIQUE(source_flight_id,intended_role),
      FOREIGN KEY(source_flight_id,source_user_id) REFERENCES flights(id,user_id)
    );
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL REFERENCES flights(id),
      source_user_id BIGINT NOT NULL REFERENCES users(id),
      participant_user_id BIGINT NOT NULL REFERENCES users(id),
      participant_role TEXT NOT NULL CHECK(participant_role IN ('CO-PILOT','SAFETY PILOT','INSTRUCTOR','EXAMINER','OBSERVER','PIC')),
      source_revision INTEGER NOT NULL,
      source_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','superseded','cancelled')),
      decision_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      superseded_at TIMESTAMPTZ,
      UNIQUE(source_flight_id,source_revision,participant_user_id)
    );
    INSERT INTO users(id,display_name) VALUES(1,'Source Safety Pilot'),(2,'Linked PIC'),(3,'Other Connected Pilot');
    INSERT INTO flights(id,user_id,role,certified_at,certification_hash,record_revision) VALUES
      (10,1,'SAFETY PILOT',NOW(),'hash-r2',2),
      (11,1,'PIC',NOW(),'pic-hash',1),
      (12,1,'SAFETY PILOT',NULL,'',1),
      (13,1,'SAFETY PILOT',NOW(),'revoked-hash',1);
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES
      (1,2,'accepted'),
      (1,3,'accepted');
    INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES
      (10,1,2,'PIC'),
      (11,1,2,'PIC'),
      (12,1,2,'PIC'),
      (13,1,2,'PIC');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("SP3 production invite inserts exact certified revision for the stored linked PIC",{skip:!enabled},()=>{
  const sql=render(inviteSql(),{sourceFlightId:10,userId:1});
  const result=run(sql);
  assert.match(result,/\d+\|2$/);
  assert.equal(run("SELECT participant_user_id||'|'||participant_role||'|'||source_revision||'|'||source_hash||'|'||status FROM flight_participations WHERE source_flight_id=10"),"2|PIC|2|hash-r2|pending");
});

test("SP3 invite cannot be redirected to another accepted Connection",{skip:!enabled},()=>{
  assert.equal(run("SELECT COUNT(*) FROM flight_connected_crew WHERE source_flight_id=10 AND connected_user_id=3"),"0");
  run("DELETE FROM flight_participations WHERE source_flight_id=10");
  run(render(inviteSql(),{sourceFlightId:10,userId:1}));
  assert.equal(run("SELECT participant_user_id FROM flight_participations WHERE source_flight_id=10"),"2");
});

test("SP3 invite fails closed for wrong source role, uncertified source, and revoked Connection",{skip:!enabled},()=>{
  assert.equal(run(render(inviteSql(),{sourceFlightId:11,userId:1})),"");
  assert.equal(run(render(inviteSql(),{sourceFlightId:12,userId:1})),"");
  run("UPDATE pilot_connections SET status='cancelled' WHERE requester_user_id=1 AND recipient_user_id=2");
  assert.equal(run(render(inviteSql(),{sourceFlightId:13,userId:1})),"");
  assert.equal(run("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id IN (11,12,13)"),"0");
});

test("SP3 reinvite can reopen declined or cancelled request but does not reset accepted state",{skip:!enabled},()=>{
  run("UPDATE pilot_connections SET status='accepted' WHERE requester_user_id=1 AND recipient_user_id=2");
  run("DELETE FROM flight_participations WHERE source_flight_id=10");
  run(render(inviteSql(),{sourceFlightId:10,userId:1}));
  const participationId=Number(run("SELECT id FROM flight_participations WHERE source_flight_id=10"));
  run(`UPDATE flight_participations SET status='declined',responded_at=NOW(),decision_note='No' WHERE id=${participationId}`);
  run(render(inviteSql(),{sourceFlightId:10,userId:1}));
  assert.equal(run(`SELECT status||'|'||COALESCE(decision_note,'x')||'|'||(responded_at IS NULL)::text FROM flight_participations WHERE id=${participationId}`),"pending||true");
  run(`UPDATE flight_participations SET status='accepted' WHERE id=${participationId}`);
  assert.equal(run(render(inviteSql(),{sourceFlightId:10,userId:1})),"");
  assert.equal(run(`SELECT status FROM flight_participations WHERE id=${participationId}`),"accepted");
});
