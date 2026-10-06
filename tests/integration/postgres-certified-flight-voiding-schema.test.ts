import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_void_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{
    input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},
  });
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim().replace(/\r\n/g,"\n");
}
function migration20Blocks(){
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const start=source.indexOf("if(version===20)return[");
  const end=source.indexOf("  ];",start);
  assert.ok(start>=0&&end>start,"schema v20 migration block exists");
  const block=source.slice(start,end);
  const sqlBlocks=[...block.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
  assert.ok(sqlBlocks.length>=20,"schema v20 exposes the expected SQL statements");
  return sqlBlocks;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for certified voiding PostgreSQL tests");
  const setup=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      date TEXT NOT NULL DEFAULT '2026-10-06',
      note TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,
      certified_by_user_id BIGINT,
      certification_hash TEXT NOT NULL DEFAULT '',
      certification_version INTEGER NOT NULL DEFAULT 8,
      locked_at TIMESTAMPTZ,
      locked_by_user_id BIGINT,
      record_revision INTEGER NOT NULL DEFAULT 1,
      correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,
      correction_opened_by_user_id BIGINT
    );
    CREATE UNIQUE INDEX flights_id_user_owner_uq ON flights(id,user_id);
    CREATE TABLE flight_certified_revisions(
      id BIGSERIAL PRIMARY KEY,
      flight_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      revision_number INTEGER NOT NULL,
      snapshot_data JSONB NOT NULL,
      certification_hash TEXT NOT NULL,
      certification_version INTEGER NOT NULL DEFAULT 8,
      certified_at TIMESTAMPTZ NOT NULL,
      superseded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_by_user_id BIGINT NOT NULL,
      correction_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,
      source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      source_user_id BIGINT NOT NULL,
      participant_user_id BIGINT NOT NULL,
      participant_role TEXT NOT NULL,
      pic_commander_basis TEXT,
      source_revision INTEGER NOT NULL,
      source_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      participant_flight_id BIGINT REFERENCES flights(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
    INSERT INTO users(id) VALUES(1),(2);
    INSERT INTO flights(id,user_id,note,certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id)
      VALUES
      (100,1,'source',NOW(),1,repeat('a',64),NOW(),1),
      (200,2,'participant copy',NOW(),2,repeat('b',64),NOW(),2),
      (300,1,'correction candidate',NOW(),1,repeat('c',64),NOW(),1);
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id,responded_at)
      VALUES(100,1,2,'INSTRUCTOR',1,repeat('a',64),'accepted',200,NOW());
  `);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
  for(const block of migration20Blocks())run(block);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v20 backfills accepted participant-copy provenance",{skip:!enabled},()=>{
  assert.equal(run("SELECT participant_flight_id||'|'||source_flight_id||'|'||source_revision||'|'||participant_role FROM flight_source_provenance"),"200|100|1|INSTRUCTOR");
});

test("certified DELETE without a same-transaction tombstone is rejected",{skip:!enabled},()=>{
  const result=raw(`SET search_path TO ${quoted};DELETE FROM flights WHERE id=100`);
  assert.notEqual(result.status,0);
  assert.match(String(result.stderr),/matching same-transaction void archive/);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=100"),"1");
});

test("a tombstone cannot commit while the active source flight still exists",{skip:!enabled},()=>{
  const result=raw(`SET search_path TO ${quoted};
    INSERT INTO voided_certified_flights(
      user_id,original_flight_id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
      flight_snapshot,flight_snapshot_sha256,voided_by_user_id,void_reason,operation_token
    )
    SELECT user_id,id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
      to_jsonb(f),repeat('d',64),1,'Incorrect certified record','00000000-0000-0000-0000-000000000001'
    FROM flights f WHERE id=100;`);
  assert.notEqual(result.status,0);
  assert.match(String(result.stderr),/cannot coexist with its active flight/);
  assert.equal(run("SELECT COUNT(*) FROM voided_certified_flights WHERE original_flight_id=100"),"0");
});

test("same-transaction tombstone + archive evidence authorizes the certified DELETE and leaves participant copy active",{skip:!enabled},()=>{
  run(`BEGIN;
    WITH inserted AS (
      INSERT INTO voided_certified_flights(
        user_id,original_flight_id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
        flight_snapshot,flight_snapshot_sha256,voided_by_user_id,void_reason,operation_token
      )
      SELECT user_id,id,record_revision,certification_hash,certification_version,certified_at,certified_by_user_id,
        to_jsonb(f),repeat('e',64),1,'Incorrect certified record','00000000-0000-0000-0000-000000000002'
      FROM flights f WHERE id=100
      RETURNING id
    )
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
      SELECT id,'PARTICIPATION','1','{"status":"accepted"}'::jsonb,repeat('f',64) FROM inserted;
    UPDATE flight_source_provenance p
      SET source_voided_flight_id=v.id,updated_at=NOW()
      FROM voided_certified_flights v
      WHERE p.source_flight_id=v.original_flight_id AND p.source_user_id=v.user_id AND v.original_flight_id=100;
    DELETE FROM flights WHERE id=100;
    COMMIT;`);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=100"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=200"),"1");
  assert.equal(run("SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=100"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flight_source_provenance WHERE participant_flight_id=200 AND source_voided_flight_id IS NOT NULL"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_certified_flights WHERE original_flight_id=100"),"1");
});

test("committed void archive rows and archive children are immutable/frozen",{skip:!enabled},()=>{
  let result=raw(`SET search_path TO ${quoted};UPDATE voided_certified_flights SET void_reason='Changed reason' WHERE original_flight_id=100`);
  assert.notEqual(result.status,0);
  assert.match(String(result.stderr),/archive is immutable/);
  result=raw(`SET search_path TO ${quoted};INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256) SELECT id,'EXPENSE','late','{}',repeat('1',64) FROM voided_certified_flights WHERE original_flight_id=100`);
  assert.notEqual(result.status,0);
  assert.match(String(result.stderr),/must be captured in the tombstone transaction/);
});

test("participant source provenance is immutable after its one same-transaction tombstone binding",{skip:!enabled},()=>{
  let result=raw(`SET search_path TO ${quoted};UPDATE flight_source_provenance SET participant_role='PIC' WHERE participant_flight_id=200`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
  result=raw(`SET search_path TO ${quoted};UPDATE flight_source_provenance SET source_hash=repeat('9',64) WHERE participant_flight_id=200`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
  result=raw(`SET search_path TO ${quoted};UPDATE flight_source_provenance SET source_voided_flight_id=NULL WHERE participant_flight_id=200`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
  result=raw(`SET search_path TO ${quoted};DELETE FROM flight_source_provenance WHERE participant_flight_id=200`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
  assert.equal(run("SELECT participant_role||'|'||source_hash||'|'||(source_voided_flight_id IS NOT NULL)::text FROM flight_source_provenance WHERE participant_flight_id=200"),`INSTRUCTOR|${"a".repeat(64)}|true`);
});

test("existing certified correction transition still succeeds with preserved revision evidence",{skip:!enabled},()=>{
  run(`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,superseded_by_user_id,correction_reason)
    SELECT id,user_id,record_revision,to_jsonb(f),certification_hash,certification_version,certified_at,1,'Correction opened'
    FROM flights f WHERE id=300`);
  run(`UPDATE flights
    SET record_revision=2,correction_reason='Correct registration data',correction_opened_at=NOW(),correction_opened_by_user_id=1,
        certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL
    WHERE id=300`);
  assert.equal(run("SELECT record_revision||'|'||(certified_at IS NULL)::text||'|'||correction_reason FROM flights WHERE id=300"),"2|true|Correct registration data");
});
