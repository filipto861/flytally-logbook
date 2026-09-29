import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_sp_pic_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}
function migration15Blocks(){
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===15)return[");
  const next=source.indexOf("if(version===16)return[",start);
  const end=next>start?next:source.indexOf("throw new Error",start);
  assert.ok(start>=0&&end>start,"migration 15 block is present");
  return [...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
}
function sqlBlock(file:string,needle:string){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  const block=blocks.find(value=>value.includes(needle));
  assert.ok(block,`Production SQL block not found: ${needle}`);
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
  assert.ok(databaseUrl,"DATABASE_URL is required for Safety Pilot/PIC SP1 PostgreSQL tests");
  const setup=`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'PIC',
      certified_at TIMESTAMPTZ,
      locked_at TIMESTAMPTZ,
      UNIQUE(id,user_id)
    );
    CREATE TABLE pilot_connections(
      id BIGSERIAL PRIMARY KEY,
      requester_user_id BIGINT NOT NULL REFERENCES users(id),
      recipient_user_id BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL
    );
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,
      participant_role TEXT NOT NULL,
      CONSTRAINT flight_participations_participant_role_check CHECK(participant_role IN ('CO-PILOT','SAFETY PILOT','INSTRUCTOR','EXAMINER','OBSERVER'))
    );
    INSERT INTO users(id,display_name) VALUES(1,'Source Pilot'),(2,'Connected PIC'),(3,'Other Pilot');
    INSERT INTO flights(id,user_id,role) VALUES(10,1,'SAFETY PILOT'),(11,1,'SAFETY PILOT'),(12,1,'SAFETY PILOT');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(1,2,'accepted'),(1,3,'accepted');
  `;
  const result=raw(setup);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  const blocks=migration15Blocks();
  assert.equal(blocks.length,5);
  for(const block of blocks)run(block);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("SP1 migration 15 is idempotent and extends the participation role constraint",{skip:!enabled},()=>{
  for(const block of migration15Blocks())run(block);
  run("INSERT INTO flight_participations(participant_role) VALUES('PIC')");
  const invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_participations(participant_role) VALUES('CAPTAIN')`);
  assert.notEqual(invalid.status,0);
});

test("SP1 connected-crew schema enforces owner, role, uniqueness and cascade",{skip:!enabled},()=>{
  run("INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(10,1,2,'PIC')");
  let invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(11,1,1,'PIC')`);
  assert.notEqual(invalid.status,0);
  invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(11,1,2,'CAPTAIN')`);
  assert.notEqual(invalid.status,0);
  invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(10,1,3,'PIC')`);
  assert.notEqual(invalid.status,0);
  invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role) VALUES(11,2,3,'PIC')`);
  assert.notEqual(invalid.status,0);
  run("DELETE FROM flights WHERE id=10");
  assert.equal(run("SELECT COUNT(*) FROM flight_connected_crew WHERE source_flight_id=10"),"0");
});

test("SP1 production upsert helper fails closed unless the source is editable Safety Pilot with an accepted Connection",{skip:!enabled},()=>{
  const upsert=sqlBlock("lib/flight-connected-crew.ts","INSERT INTO flight_connected_crew");
  const values={sourceFlightId:12,sourceUserId:1,connectedUserId:2};
  assert.match(run(render(upsert,values)),/12\|1\|2\|PIC$/);
  run("UPDATE flights SET role='PIC' WHERE id=12");
  assert.equal(run(render(upsert,{...values,connectedUserId:3})),"");
  run("UPDATE flights SET role='SAFETY PILOT',locked_at=NOW() WHERE id=12");
  assert.equal(run(render(upsert,{...values,connectedUserId:3})),"");
  run("UPDATE flights SET locked_at=NULL WHERE id=12");
  run("UPDATE pilot_connections SET status='cancelled' WHERE requester_user_id=1 AND recipient_user_id=3");
  assert.equal(run(render(upsert,{...values,connectedUserId:3})),"");
  assert.equal(run("SELECT connected_user_id FROM flight_connected_crew WHERE source_flight_id=12"),"2");
});
