import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_general_pic_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}
function migration16Blocks(){
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===16)return[");
  const end=source.indexOf("if(version===17)return[",start);
  assert.ok(start>=0&&end>start,"migration 16 block is present");
  return [...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for general PIC PostgreSQL tests");
  const result=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL,
      source_user_id BIGINT NOT NULL,
      participant_user_id BIGINT NOT NULL,
      participant_role TEXT NOT NULL,
      source_revision INTEGER NOT NULL DEFAULT 1,
      source_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      UNIQUE(source_flight_id,source_revision,participant_user_id)
    );
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)
    VALUES
      (10,1,2,'PIC',1,'legacy-pic','cancelled'),
      (11,1,3,'OBSERVER',1,'observer','pending');
  `);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  for(const block of migration16Blocks())run(block);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("migration 16 is idempotent and preserves legacy NULL PIC provenance",{skip:!enabled},()=>{
  for(const block of migration16Blocks())run(block);
  assert.equal(run("SELECT COALESCE(pic_commander_basis,'NULL') FROM flight_participations WHERE source_flight_id=10"),"NULL");
});

test("PIC commander basis is valid only for PIC participations",{skip:!enabled},()=>{
  run("UPDATE flight_participations SET pic_commander_basis='CERTIFIED_SOURCE_COMMANDER' WHERE source_flight_id=10");
  assert.equal(run("SELECT pic_commander_basis FROM flight_participations WHERE source_flight_id=10"),"CERTIFIED_SOURCE_COMMANDER");

  let invalid=raw(`SET search_path TO ${quoted};UPDATE flight_participations SET pic_commander_basis='RECIPIENT_ACCOUNT' WHERE source_flight_id=11`);
  assert.notEqual(invalid.status,0);

  invalid=raw(`SET search_path TO ${quoted};INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,pic_commander_basis,source_revision,source_hash,status) VALUES(12,1,4,'PIC','OTHER',1,'bad','pending')`);
  assert.notEqual(invalid.status,0);
});

test("database allows only one active PIC recipient per source revision",{skip:!enabled},()=>{
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,pic_commander_basis,source_revision,source_hash,status) VALUES(20,1,5,'PIC','RECIPIENT_ACCOUNT',1,'h1','pending')");
  const conflict=raw(`SET search_path TO ${quoted};INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,pic_commander_basis,source_revision,source_hash,status) VALUES(20,1,6,'PIC','RECIPIENT_ACCOUNT',1,'h1','pending')`);
  assert.notEqual(conflict.status,0);

  run("UPDATE flight_participations SET status='cancelled' WHERE source_flight_id=20 AND participant_user_id=5");
  run("INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,pic_commander_basis,source_revision,source_hash,status) VALUES(20,1,6,'PIC','RECIPIENT_ACCOUNT',1,'h1','pending')");
  assert.equal(run("SELECT participant_user_id FROM flight_participations WHERE source_flight_id=20 AND status='pending'"),"6");
});
