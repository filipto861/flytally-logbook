import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_backup13_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
  const source=read("lib/db-optimization.ts"),start=source.indexOf("if(version===20)return["),end=source.indexOf("  ];",start);
  assert.ok(start>=0&&end>start,"schema v20 migration block exists");
  return[...source.slice(start,end).matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);
}
function sqlBlock(source:string,needle:string){
  const block=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).find(value=>value.includes(needle));
  assert.ok(block,`Production restore SQL block not found: ${needle}`);
  return block;
}
function literal(value:unknown){
  if(value===null)return"NULL";
  if(typeof value==="number")return String(value);
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  const raw=typeof value==="string"?value:(JSON.stringify(value)??"");
  return`'${raw.replaceAll("'","''")}'`;
}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL test value for ${key}`);return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);return rendered;
}

const hash="a".repeat(64),snapshotHash="b".repeat(64),sourceTime="2026-10-06T10:00:00.000Z",voidTime="2026-10-06T11:00:00.000Z";
const snapshot={id:100,user_id:10,note:"historical certified source",certified_at:sourceTime,certified_by_user_id:10,certification_hash:hash,certification_version:8,locked_at:sourceTime,locked_by_user_id:10,record_revision:1,correction_reason:"",correction_opened_at:null,correction_opened_by_user_id:null};
const tombstone={id:500,user_id:10,original_flight_id:100,record_revision:1,certification_hash:hash,certification_version:8,certified_at:sourceTime,certified_by_user_id:10,flight_snapshot:snapshot,flight_snapshot_sha256:snapshotHash,archive_version:1,voided_at:voidTime,voided_by_user_id:10,void_reason:"Incorrect certified record",operation_token:"00000000-0000-0000-0000-000000000500"};
const revision={id:501,voided_flight_id:500,source_revision_id:301,revision_number:1,certification_hash:hash,certification_version:8,certified_at:sourceTime,superseded_at:null,correction_reason:"",snapshot_data:snapshot,snapshot_sha256:"c".repeat(64),archived_at:voidTime};
const verification={id:502,voided_flight_id:500,source_verification_id:401,record_revision:1,verification_role:"INSTRUCTOR",status:"signed",signer_user_id:null,flight_hash:hash,payload_hash:"d".repeat(64),server_signature:"e".repeat(64),signed_at:sourceTime,revoked_at:null,credential_snapshot:{identity:"Test FI"},source_data:{id:401,status:"signed"},source_sha256:"f".repeat(64),archived_at:voidTime};
const item={id:503,voided_flight_id:500,item_kind:"TRACK",source_key:"700",source_data:{id:700,coordinates_json:"[]"},source_sha256:"1".repeat(64),archived_at:voidTime};
const provenance={id:504,participant_flight_id:200,participant_user_id:10,source_flight_id:100,source_user_id:10,source_revision:1,source_hash:hash,participant_role:"INSTRUCTOR",pic_commander_basis:null,accepted_at:sourceTime,source_voided_flight_id:500,created_at:sourceTime,updated_at:voidTime};

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for backup v13 PostgreSQL tests");
  const setup=raw(`
    CREATE SCHEMA ${quoted};
    SET search_path TO ${quoted};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,note TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',
      certification_version INTEGER NOT NULL DEFAULT 8,locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,
      record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
    );
    CREATE UNIQUE INDEX flights_id_user_owner_uq ON flights(id,user_id);
    CREATE TABLE flight_certified_revisions(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,revision_number INTEGER NOT NULL,
      snapshot_data JSONB NOT NULL,certification_hash TEXT NOT NULL,certification_version INTEGER NOT NULL DEFAULT 8,
      certified_at TIMESTAMPTZ NOT NULL,superseded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_by_user_id BIGINT NOT NULL,correction_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,pic_commander_basis TEXT,
      source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL,status TEXT NOT NULL,participant_flight_id BIGINT REFERENCES flights(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),responded_at TIMESTAMPTZ
    );
    INSERT INTO users(id) VALUES(10);
    INSERT INTO flights(id,user_id,note) VALUES(200,10,'independent participant copy');
  `);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
  for(const block of migration20Blocks())run(block);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v13 restore inserts tombstone, children and participant provenance in one ordinary transaction",{skip:!enabled},()=>{
  const restore=read("lib/account-restore-v6.ts");
  const statements=[
    render(sqlBlock(restore,"INSERT INTO voided_certified_flights("),{"JSON.stringify(batch)":[tombstone]}),
    render(sqlBlock(restore,"INSERT INTO voided_flight_certified_revisions SELECT"),{"JSON.stringify(batch)":[revision]}),
    render(sqlBlock(restore,"INSERT INTO voided_flight_verifications SELECT"),{"JSON.stringify(batch)":[verification]}),
    render(sqlBlock(restore,"INSERT INTO voided_flight_archive_items SELECT"),{"JSON.stringify(batch)":[item]}),
    render(sqlBlock(restore,"INSERT INTO flight_source_provenance SELECT"),{"JSON.stringify(batch)":[provenance]}),
  ];
  run(`BEGIN;\n${statements.join(";\n")};\nCOMMIT;`);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=100 AND user_id=10"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=200 AND user_id=10"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_certified_flights WHERE id=500 AND original_flight_id=100"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_flight_certified_revisions WHERE voided_flight_id=500"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_flight_verifications WHERE voided_flight_id=500"),"1");
  assert.equal(run("SELECT COUNT(*) FROM voided_flight_archive_items WHERE voided_flight_id=500"),"1");
  assert.equal(run("SELECT COUNT(*) FROM flight_source_provenance WHERE id=504 AND participant_flight_id=200 AND source_voided_flight_id=500"),"1");
  assert.equal(run("SELECT void_reason||'|'||flight_snapshot_sha256 FROM voided_certified_flights WHERE id=500"),`Incorrect certified record|${snapshotHash}`);
});

test("restored void archive and provenance remain immutable",{skip:!enabled},()=>{
  let result=raw(`SET search_path TO ${quoted};UPDATE voided_certified_flights SET void_reason='Changed reason' WHERE id=500`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/archive is immutable/);
  result=raw(`SET search_path TO ${quoted};UPDATE flight_source_provenance SET participant_role='PIC' WHERE id=504`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
  result=raw(`SET search_path TO ${quoted};DELETE FROM flight_source_provenance WHERE id=504`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/provenance is immutable/);
});

test("restored tombstone prevents active-flight resurrection",{skip:!enabled},()=>{
  const result=raw(`SET search_path TO ${quoted};INSERT INTO flights(id,user_id,note) VALUES(100,10,'resurrection')`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/identity cannot be recreated as an active flight/);
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=100"),"0");
});

test("active flight prevents restoring a matching history tombstone and rolls back",{skip:!enabled},()=>{
  run("INSERT INTO flights(id,user_id,note) VALUES(101,10,'active conflict')");
  const conflict={...tombstone,id:600,original_flight_id:101,flight_snapshot:{...snapshot,id:101},operation_token:"00000000-0000-0000-0000-000000000600"};
  const restore=read("lib/account-restore-v6.ts"),statement=render(sqlBlock(restore,"INSERT INTO voided_certified_flights("),{"JSON.stringify(batch)":[conflict]});
  const result=raw(`SET search_path TO ${quoted};BEGIN;${statement};COMMIT;`);
  assert.notEqual(result.status,0);assert.match(String(result.stderr),/cannot coexist with its active flight/);
  assert.equal(run("SELECT COUNT(*) FROM voided_certified_flights WHERE id=600"),"0");
  assert.equal(run("SELECT COUNT(*) FROM flights WHERE id=101"),"1");
});

test("no restore-mode trigger bypass is present or required",{skip:!enabled},()=>{
  const restore=read("lib/account-restore-v6.ts"),schemaSource=read("lib/db-optimization.ts");
  assert.doesNotMatch(restore,/session_replication_role|DISABLE TRIGGER|SET LOCAL app\.restore/i);
  assert.doesNotMatch(schemaSource,/session_replication_role|DISABLE TRIGGER|SET LOCAL app\.restore/i);
  assert.match(schemaSource,/created_txid=txid_current\(\)/);
});
