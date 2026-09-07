import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_actions_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;

function rawPsql(statement:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function sqlBlock(source:string,needle:string){
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  const block=blocks.find(value=>value.includes(needle));
  assert.ok(block,`Production SQL block not found: ${needle}`);
  return block;
}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL test value for ${key}`);
    const value=values[key];return typeof value==="number"?String(value):`'${String(value).replaceAll("'","''")}'`;
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL pending-action acceptance tests");
  const setup=`
    CREATE SCHEMA ${quotedSchema}; SET search_path TO ${quotedSchema};
    CREATE TABLE flights(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,certified_at TIMESTAMPTZ,record_revision INTEGER NOT NULL DEFAULT 1,certification_hash TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_participations(id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,source_revision INTEGER NOT NULL,source_hash TEXT,status TEXT NOT NULL);
    CREATE TABLE pilot_connections(id BIGSERIAL PRIMARY KEY,requester_user_id BIGINT NOT NULL,recipient_user_id BIGINT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE pilot_qualifications(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,requested_signer_user_id BIGINT,record_kind TEXT,record_active BOOLEAN,signature_status TEXT,verified_at TIMESTAMPTZ);
    CREATE TABLE instructor_flight_approvals(id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,student_user_id BIGINT NOT NULL,instructor_user_id BIGINT NOT NULL,status TEXT NOT NULL,record_revision INTEGER NOT NULL,flight_hash TEXT);

    INSERT INTO flights VALUES
      (100,41,NOW(),1,'h1'),(101,41,NOW(),2,'new-hash'),(200,44,NOW(),1,'h2'),(201,44,NOW(),1,'h3');
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status) VALUES
      (100,41,42,'PAX',1,'h1','pending'),
      (101,41,42,'PAX',1,'old-hash','pending'),
      (201,44,42,'INSTRUCTOR',1,'h3','pending');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES
      (41,42,'pending'),
      (42,50,'pending'),
      (43,42,'accepted'),
      (44,42,'accepted');
    INSERT INTO pilot_qualifications(user_id,requested_signer_user_id,record_kind,record_active,signature_status,verified_at) VALUES
      (43,42,'aircraft_training',TRUE,'pending',NULL),
      (45,42,'aircraft_training',TRUE,'pending',NULL);
    INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,status,record_revision,flight_hash) VALUES
      (200,44,42,'pending',1,'h2'),
      (201,44,42,'pending',1,'h3');
  `;
  const result=rawPsql(setup);if(result.status!==0)throw new Error(`PostgreSQL pending-action schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("v2.2 pending-action count follows authoritative workflow state",{skip:!enabled},()=>{
  const source=fs.readFileSync(path.join(root,"lib/pending-actions.ts"),"utf8");
  const query=sqlBlock(source,"(SELECT COUNT(*) FROM flight_participations p JOIN flights f");
  const rendered=render(query,{userId:42});
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${rendered}`);
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(Number(result.stdout.trim()),5,"expected current shared flight + canonical instructor participation + incoming connection + connected training signature + non-duplicated legacy approval");
});
