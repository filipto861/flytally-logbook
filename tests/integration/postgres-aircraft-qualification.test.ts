import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_aircraft_qual_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
function rawPsql(statement:string){const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});if(result.error)throw result.error;return result}
function run(statement:string){const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for aircraft-qualification acceptance tests");
  const setup=`CREATE SCHEMA ${quotedSchema};SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE pilot_licences(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,licence_type TEXT NOT NULL,licence_number TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE);
    CREATE TABLE pilot_qualifications(id BIGSERIAL PRIMARY KEY,licence_id BIGINT NOT NULL REFERENCES pilot_licences(id) ON DELETE CASCADE,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,qualification_type TEXT NOT NULL,certificate_reference TEXT NOT NULL DEFAULT '',validity_mode TEXT NOT NULL,valid_until DATE,recency_until DATE,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(licence_id,qualification_type,certificate_reference));
    INSERT INTO users(id) VALUES(41),(42);INSERT INTO pilot_licences(id,user_id,licence_type,licence_number) VALUES(501,41,'LAPL(A)','CZ-TEST'),(502,42,'PPL(A)','OTHER');`;
  const base=rawPsql(setup);if(base.status!==0)throw new Error(base.stderr||base.stdout);
  const source=fs.readFileSync(path.join(root,"lib/v145-schema.ts"),"utf8"),blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).filter(value=>(value.startsWith("ALTER TABLE pilot_qualifications")||value.startsWith("CREATE INDEX IF NOT EXISTS idx_v145")));
  assert.ok(blocks.length>=20,"Expected production v1.45 aircraft-training migration blocks");
  for(const block of blocks)run(block);
});
after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("AC-28 aircraft training permits dedicated evidence linked to an owned licence",{skip:!enabled},()=>{
  run(`INSERT INTO pilot_qualifications(licence_id,user_id,qualification_type,certificate_reference,validity_mode,active,record_kind,record_active,linked_licence_id,training_kind,aircraft_make,aircraft_model,aircraft_variant,differences,completed_on,instructor_name,signature_status,verification_version) VALUES(NULL,41,'SEP(land)','FI-REF','unlimited',FALSE,'aircraft_training',TRUE,501,'differences','Bristell','B23','','variable-pitch propeller','2026-08-30','Test FI','unsigned',1)`);
  assert.equal(run(`SELECT COALESCE(licence_id::text,'NULL')||'|'||linked_licence_id||'|'||record_kind||'|'||record_active||'|'||aircraft_model FROM pilot_qualifications WHERE user_id=41 AND record_kind='aircraft_training'`),"NULL|501|aircraft_training|true|B23");
  assert.equal(run(`SELECT COUNT(*) FROM pilot_qualifications WHERE user_id=41 AND active=TRUE`),"0","Aircraft evidence must stay outside ordinary active qualifications used by recency and flight signature snapshots");
});

test("AC-28 linked aircraft training licence remains database referential evidence",{skip:!enabled},()=>{
  const result=rawPsql(`SET search_path TO ${quotedSchema};INSERT INTO pilot_qualifications(licence_id,user_id,qualification_type,certificate_reference,validity_mode,active,record_kind,record_active,linked_licence_id,training_kind,completed_on) VALUES(NULL,41,'SEP(land)','BAD','unlimited',FALSE,'aircraft_training',TRUE,999,'differences','2026-08-30')`);
  assert.notEqual(result.status,0,"Unknown linked licence must be rejected by PostgreSQL");
});

test("AC-29 signed aircraft training preserves immutable evidence fields separately from active ratings",{skip:!enabled},()=>{
  run(`UPDATE pilot_qualifications SET signature_status='signed',verification_role='INSTRUCTOR',verified_at=NOW(),verified_by_user_id=42,verification_snapshot='{"identity":"Test FI"}'::jsonb,verification_signature=repeat('a',64),verification_version=1 WHERE user_id=41 AND record_kind='aircraft_training'`);
  assert.equal(run(`SELECT signature_status||'|'||verification_role||'|'||verified_by_user_id||'|'||length(verification_signature) FROM pilot_qualifications WHERE user_id=41 AND record_kind='aircraft_training'`),"signed|INSTRUCTOR|42|64");
  assert.equal(run(`SELECT COUNT(*) FROM pilot_qualifications WHERE user_id=41 AND active=TRUE`),"0");
});
