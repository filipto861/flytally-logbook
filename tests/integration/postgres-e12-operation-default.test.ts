import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schemaName=`ft_e12_operation_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}
function migration18Blocks(){
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===18)return[");
  const end=source.indexOf("if(version===19)return[",start);
  assert.ok(start>=0&&end>start);
  return [...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      default_role TEXT NOT NULL DEFAULT 'PIC'
    );
    INSERT INTO aircraft(user_id,registration) VALUES(1,'OK-E12'),(1,'OK-NULL');`);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("E1.2 migration 18 is additive idempotent and leaves existing profiles NULL",{skip:!enabled},()=>{
  const blocks=migration18Blocks();
  assert.equal(blocks.length,2);
  for(const block of blocks)run(block);
  assert.equal(run("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='aircraft' AND column_name='default_operation_type'"),"1");
  assert.equal(run("SELECT COUNT(*) FROM aircraft WHERE default_operation_type IS NULL"),"2");
  for(const block of blocks)run(block);
  assert.equal(run("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='aircraft' AND column_name='default_operation_type'"),"1");
});

test("E1.2 database constraint accepts NULL SP MP and rejects any other default",{skip:!enabled},()=>{
  run("UPDATE aircraft SET default_operation_type='SP' WHERE registration='OK-E12'");
  assert.equal(run("SELECT default_operation_type FROM aircraft WHERE registration='OK-E12'"),"SP");
  run("UPDATE aircraft SET default_operation_type='MP' WHERE registration='OK-E12'");
  assert.equal(run("SELECT default_operation_type FROM aircraft WHERE registration='OK-E12'"),"MP");
  run("UPDATE aircraft SET default_operation_type=NULL WHERE registration='OK-E12'");
  assert.equal(run("SELECT COALESCE(default_operation_type,'NULL') FROM aircraft WHERE registration='OK-E12'"),"NULL");
  const invalid=raw(`SET search_path TO ${quoted};UPDATE aircraft SET default_operation_type='AUTO' WHERE registration='OK-E12';`);
  assert.notEqual(invalid.status,0);
});
