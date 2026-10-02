import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schemaName=`ft_identity_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}
function rows(statement:string){const value=run(statement);return value?value.split("\n"):[]}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL flight identity acceptance");
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      aircraft_make TEXT NOT NULL DEFAULT '',
      aircraft_model TEXT NOT NULL DEFAULT '',
      aircraft_variant TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      aircraft_make TEXT NOT NULL DEFAULT '',
      aircraft_model TEXT NOT NULL DEFAULT '',
      aircraft_variant TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,
      certification_hash TEXT NOT NULL DEFAULT '',
      certification_version INTEGER NOT NULL DEFAULT 1
    );
    INSERT INTO aircraft(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type) VALUES
      (1,'OK-A','Current Make A','Current Model A','Current Variant A','TYPE-A'),
      (1,'OK-B','Current Make B','Current Model B','Current Variant B','TYPE-B'),
      (2,'OK-A','Recipient Make','Recipient Model','Recipient Variant','RECIPIENT');
    INSERT INTO flights(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type,certified_at,certification_hash,certification_version)
      VALUES(1,'OK-A','Existing Make','Existing Model','Existing Variant','TYPE-A',NOW(),'existing-hash',8);
  `);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);

  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===17)return[");
  const end=source.indexOf("];",start);
  assert.ok(start>=0&&end>start,"migration 17 source block missing");
  const section=source.slice(start,end+2);
  const blocks=[...section.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  assert.equal(blocks.length,3,"migration 17 should contain function + trigger replacement");
  for(const block of blocks)run(block);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("migration 17 does not rewrite existing certified identity",{skip:!enabled},()=>{
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant||'|'||certification_hash||'|'||certification_version FROM flights WHERE certification_hash='existing-hash'`),"Existing Make|Existing Model|Existing Variant|existing-hash|8");
});

test("ordinary empty-snapshot insert resolves the current owned profile",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_type) VALUES(1,'OK-A','TYPE-A')`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE user_id=1 AND registration='OK-A' AND certified_at IS NULL ORDER BY id DESC LIMIT 1`),"Current Make A|Current Model A|Current Variant A");
});

test("explicit shared historical tuple survives a conflicting recipient profile",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type) VALUES(2,'OK-A','Source Make','Source Model','Source Variant','SOURCE')`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE user_id=2 ORDER BY id DESC LIMIT 1`),"Source Make|Source Model|Source Variant");
});

test("partial explicit tuple is preserved atomically without mixing current profile identity",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type) VALUES(2,'OK-A','Source Make Only','','','SOURCE')`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE user_id=2 ORDER BY id DESC LIMIT 1`),"Source Make Only||");
});

test("same-registration UPDATE does not refresh historical identity",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type) VALUES(1,'OK-A','Historical Make','Historical Model','Historical Variant','TYPE-A')`);
  const id=run(`SELECT MAX(id) FROM flights WHERE user_id=1`);
  run(`UPDATE aircraft SET aircraft_make='Changed Current Make',aircraft_model='Changed Current Model',aircraft_variant='Changed Current Variant' WHERE user_id=1 AND registration='OK-A'`);
  run(`UPDATE flights SET registration='OK-A' WHERE id=${id}`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE id=${id}`),"Historical Make|Historical Model|Historical Variant");
});

test("actual registration change snapshots the new registration profile",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type) VALUES(1,'OK-A','Historical Make','Historical Model','Historical Variant','TYPE-A')`);
  const id=run(`SELECT MAX(id) FROM flights WHERE user_id=1`);
  run(`UPDATE flights SET registration='OK-B',aircraft_type='TYPE-B' WHERE id=${id}`);
  assert.equal(run(`SELECT registration||'|'||aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE id=${id}`),"OK-B|Current Make B|Current Model B|Current Variant B");
});

test("exact-restore style second-stage identity UPDATE remains authoritative",{skip:!enabled},()=>{
  run(`INSERT INTO flights(user_id,registration,aircraft_type) VALUES(1,'OK-B','TYPE-B')`);
  const id=run(`SELECT MAX(id) FROM flights WHERE user_id=1`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE id=${id}`),"Current Make B|Current Model B|Current Variant B");
  run(`UPDATE flights SET aircraft_make='Backup Make',aircraft_model='Backup Model',aircraft_variant='Backup Variant' WHERE id=${id}`);
  assert.equal(run(`SELECT aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights WHERE id=${id}`),"Backup Make|Backup Model|Backup Variant");
});

test("migration 17 can be reapplied without changing row identity",{skip:!enabled},()=>{
  const beforeRows=rows(`SELECT id||':'||aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights ORDER BY id`);
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8"),start=source.indexOf("if(version===17)return["),end=source.indexOf("];",start),section=source.slice(start,end+2);
  for(const block of [...section.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]))run(block);
  const afterRows=rows(`SELECT id||':'||aircraft_make||'|'||aircraft_model||'|'||aircraft_variant FROM flights ORDER BY id`);
  assert.deepEqual(afterRows,beforeRows);
});
