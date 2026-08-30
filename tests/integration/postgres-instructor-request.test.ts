import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_instructor_${randomUUID().replaceAll("-","")}`;
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
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL instructor-request acceptance tests");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE flights(id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,record_revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE flight_participations(id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,source_revision INTEGER NOT NULL,status TEXT NOT NULL,approval_id BIGINT);
    INSERT INTO flights(id,user_id,record_revision) VALUES(388,41,1);
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL instructor-request schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("AC-27 instructor request preflight query qualifies joined id columns and preserves legacy projection link",{skip:!enabled},()=>{
  const source=fs.readFileSync(path.join(root,"lib/training-verification.ts"),"utf8");
  const query=sqlBlock(source,"SELECT p.id,p.participant_user_id,p.approval_id FROM flight_participations p JOIN flights f");
  const rendered=render(query,{flightId:388,studentUserId:41,instructorUserId:42});
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${rendered}`);
  assert.equal(result.status,0,result.stderr||result.stdout);
});
