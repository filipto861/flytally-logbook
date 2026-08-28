import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_accept_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;

function rawPsql(sql:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",sql],{
    encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}
  });
  if(result.error)throw result.error;
  return result;
}

function run(sql:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${sql}`);
  if(result.status!==0)throw new Error(`PostgreSQL acceptance command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}

function reject(sql:string,pattern:RegExp){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${sql}`);
  assert.notEqual(result.status,0,"PostgreSQL unexpectedly accepted an operation that must be rejected");
  assert.match(String(result.stderr??result.stdout),pattern);
}

function productionSqlBlock(source:string,needle:string,which:"first"|"last"="first"){
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).filter(value=>value.includes(needle));
  const block=which==="last"?blocks.at(-1):blocks[0];
  assert.ok(block,`Production SQL block not found: ${needle}`);
  assert.doesNotMatch(block,/\$\{/ ,`Acceptance DDL block contains unresolved template interpolation: ${needle}`);
  return block;
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL acceptance tests");
  const version=spawnSync("psql",["--version"],{encoding:"utf8"});
  if(version.error)throw new Error(`psql is required for PostgreSQL acceptance tests: ${version.error.message}`);
  const source=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");
  const revisionTable=productionSqlBlock(source,"CREATE TABLE IF NOT EXISTS flight_certified_revisions");
  const protectionFunction=productionSqlBlock(source,"CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()","last");
  const participationTable=productionSqlBlock(source,"CREATE TABLE IF NOT EXISTS flight_participations");
  const verificationTable=productionSqlBlock(source,"CREATE TABLE IF NOT EXISTS flight_verifications");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,
      certified_by_user_id BIGINT,
      certification_hash TEXT NOT NULL DEFAULT '',
      certification_version INTEGER NOT NULL DEFAULT 3,
      locked_at TIMESTAMPTZ,
      locked_by_user_id BIGINT,
      record_revision INTEGER NOT NULL DEFAULT 1,
      correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,
      correction_opened_by_user_id BIGINT
    );
    ${revisionTable};
    ${protectionFunction};
    CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
    ${participationTable};
    ${verificationTable};
    INSERT INTO users(id) VALUES(1),(2),(3);
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL acceptance schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("AC-02 PostgreSQL rejects ordinary UPDATE and DELETE of a certified flight",{skip:!enabled},()=>{
  run(`INSERT INTO flights(id,user_id,note,certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id,record_revision)
    VALUES(101,1,'original',NOW(),1,'hash-r1',NOW(),1,1);`);
  reject(`UPDATE flights SET note='tampered' WHERE id=101`,/Certified flight is immutable/i);
  reject(`DELETE FROM flights WHERE id=101`,/Certified flight cannot be deleted/i);
  assert.equal(run(`SELECT note||'|'||record_revision FROM flights WHERE id=101`),"original|1");
});

test("AC-03 and AC-04 correction transition requires matching archive and preserves R1",{skip:!enabled},()=>{
  run(`INSERT INTO flights(id,user_id,note,certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id,record_revision)
    VALUES(102,1,'r1',NOW(),1,'hash-r1',NOW(),1,1);`);
  const correction=`UPDATE flights SET certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL,
    record_revision=2,correction_reason='Correct recorded detail',correction_opened_at=NOW(),correction_opened_by_user_id=1 WHERE id=102`;
  reject(correction,/Certified flight is immutable/i);
  run(`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_by_user_id,correction_reason)
    SELECT id,user_id,record_revision,to_jsonb(f),'hash-r1',certification_version,certified_at,certified_by_user_id,1,'Correct recorded detail' FROM flights f WHERE id=102;`);
  run(correction);
  assert.equal(run(`SELECT record_revision||'|'||COALESCE(certification_hash,'')||'|'||(certified_at IS NULL)::text FROM flights WHERE id=102`),"2||true");
  run(`UPDATE flights SET note='r2 corrected' WHERE id=102`);
  run(`UPDATE flights SET certified_at=NOW(),certified_by_user_id=1,certification_hash='hash-r2',locked_at=NOW(),locked_by_user_id=1 WHERE id=102`);
  reject(`UPDATE flights SET note='silent rewrite' WHERE id=102`,/Certified flight is immutable/i);
  assert.equal(run(`SELECT COUNT(*)||'|'||MIN(revision_number)||'|'||MIN(certification_hash) FROM flight_certified_revisions WHERE flight_id=102`),"1|1|hash-r1");
  assert.equal(run(`SELECT record_revision||'|'||certification_hash||'|'||note FROM flights WHERE id=102`),"2|hash-r2|r2 corrected");
});

test("AC-06 verification stays bound to exact revision and hash",{skip:!enabled},()=>{
  run(`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,payload_hash,server_signature,status,signed_at)
    VALUES(102,1,2,'INSTRUCTOR',1,'hash-r1','hash-r1','sig-r1','signed',NOW());`);
  assert.equal(run(`SELECT COUNT(*) FROM flight_verifications v JOIN flights f ON f.id=v.flight_id AND f.user_id=v.flight_user_id
    WHERE v.flight_id=102 AND v.status='signed' AND v.record_revision=f.record_revision AND v.flight_hash=f.certification_hash`),"0");
  run(`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,payload_hash,server_signature,status,signed_at)
    VALUES(102,1,2,'INSTRUCTOR',2,'hash-r2','hash-r2','sig-r2','signed',NOW());`);
  assert.equal(run(`SELECT COUNT(*) FROM flight_verifications v JOIN flights f ON f.id=v.flight_id AND f.user_id=v.flight_user_id
    WHERE v.flight_id=102 AND v.status='signed' AND v.record_revision=f.record_revision AND v.flight_hash=f.certification_hash`),"1");
  reject(`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,status)
    VALUES(102,1,2,'INSTRUCTOR',2,'hash-r2','signed')`,/duplicate key|unique constraint/i);
});

test("AC-12 deleting participant-owned draft cannot delete source flight or verification",{skip:!enabled},()=>{
  run(`INSERT INTO flights(id,user_id,note,certified_at,certified_by_user_id,certification_hash,record_revision) VALUES(103,1,'student source',NOW(),1,'source-hash',1);`);
  run(`INSERT INTO flights(id,user_id,note,record_revision) VALUES(201,2,'instructor own draft',1);`);
  run(`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,participant_flight_id)
    VALUES(103,1,2,'INSTRUCTOR',1,'source-hash','accepted',201);`);
  run(`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,payload_hash,server_signature,status,signed_at)
    VALUES(103,1,2,'INSTRUCTOR',1,'source-hash','source-hash','sig','signed',NOW());`);
  run(`DELETE FROM flights WHERE id=201 AND user_id=2`);
  assert.equal(run(`SELECT (participant_flight_id IS NULL)::text FROM flight_participations WHERE source_flight_id=103`),"true");
  assert.equal(run(`SELECT COUNT(*) FROM flights WHERE id=103 AND user_id=1`),"1");
  assert.equal(run(`SELECT COUNT(*) FROM flight_verifications WHERE flight_id=103 AND flight_user_id=1 AND status='signed'`),"1");
});
