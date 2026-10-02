import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_f33_ctx_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}
function authorityQueries(){
  const source=fs.readFileSync(path.join(root,"app/(protected)/flights/actions.ts"),"utf8");
  const blocks=[...source.matchAll(/sql\`([\s\S]*?)\`/g)].map(match=>match[1]).filter(value=>value.includes("part_fcl_credit_from")&&value.includes("FROM aircraft WHERE user_id=${userId}"));
  const active=blocks.find(value=>value.includes("active=1 LIMIT 1"));
  const owned=blocks.find(value=>!value.includes("active=1 LIMIT 1"));
  assert.ok(active,"F3.3 active GPS authority query is present");
  assert.ok(owned,"F3.3 owned Manual authority query is present");
  return{active,owned};
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
  assert.ok(databaseUrl,"DATABASE_URL is required for F3.3 PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      aircraft_type TEXT,
      aircraft_make TEXT,
      aircraft_model TEXT,
      evidence TEXT,
      aircraft_class TEXT,
      regulatory_category TEXT,
      balloon_class TEXT,
      balloon_group TEXT,
      part_fcl_credit_class TEXT,
      part_fcl_credit_basis TEXT,
      part_fcl_credit_from TEXT
    );
    INSERT INTO aircraft(user_id,registration,active,aircraft_type,aircraft_make,aircraft_model,evidence,aircraft_class,regulatory_category)
    VALUES
      (1,'OK-ACT',1,'B23','BRM Aero','Bristell B23','EASA','SEP','AEROPLANE'),
      (1,'OK-HIST',0,'UL','Legacy','UL','ULL','ULL','ULL'),
      (2,'OK-ACT',1,'OTHER','Other owner','Other','ULL','ULL','ULL');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("F3.3 Manual authority query can resolve an inactive owned profile for historical back-fill", {skip:!enabled},()=>{
  const {owned}=authorityQueries();
  assert.match(run(render(owned,{userId:1,registration:"OK-HIST"})),/^UL\|Legacy\|UL\|ULL\|ULL\|ULL/);
});

test("F3.3 GPS authority query requires an active owned profile", {skip:!enabled},()=>{
  const {active}=authorityQueries();
  assert.equal(run(render(active,{userId:1,registration:"OK-HIST"})),"");
  assert.match(run(render(active,{userId:1,registration:"OK-ACT"})),/^B23\|BRM Aero\|Bristell B23\|EASA\|SEP\|AEROPLANE/);
});

test("F3.3 aircraft authority lookups remain tenant-scoped", {skip:!enabled},()=>{
  const {active}=authorityQueries();
  assert.match(run(render(active,{userId:1,registration:"OK-ACT"})),/^B23\|BRM Aero/);
  assert.match(run(render(active,{userId:2,registration:"OK-ACT"})),/^OTHER\|Other owner/);
});

test("F3.3 submit-time authority lookup observes a profile change instead of trusting stale form defaults", {skip:!enabled},()=>{
  const {owned}=authorityQueries();
  assert.match(run(render(owned,{userId:1,registration:"OK-ACT"})),/EASA\|SEP\|AEROPLANE/);
  run("UPDATE aircraft SET evidence='ULL',aircraft_class='ULL',regulatory_category='ULL',aircraft_make='',aircraft_model='' WHERE user_id=1 AND registration='OK-ACT'");
  assert.match(run(render(owned,{userId:1,registration:"OK-ACT"})),/ULL\|ULL\|ULL/);
});
