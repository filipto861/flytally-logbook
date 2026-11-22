import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { flightCertificationHash,flightCertificationPayload,verifyFlightCertification } from "../../lib/certification-integrity.ts";
import { blockingComplianceIssues,flightCertificationCompliance } from "../../lib/fcl050-compliance.ts";
import { cookSql } from "./production-sql.ts";

// Behavioural test of the server-side certification gate in lib/flight-certification.ts.
// It runs the module's real SQL (the owned-row read and the guarded seal UPDATE) against
// the production certified-flight protection trigger, and checks the stored fingerprint
// with the canonical verifier. The TypeScript orchestration around these statements is
// covered end to end by e2e/manual-authority-certification.spec.mjs.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_cert_gate_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const PILOT=71,OTHER=72;

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function reject(statement:string,pattern:RegExp){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  assert.notEqual(result.status,0,"PostgreSQL unexpectedly accepted an operation that must be rejected");
  assert.match(String(result.stderr||result.stdout),pattern);
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return String(value);
  return`'${String(value).replaceAll("'","''")}'`;
}
function sqlBlocks(file:string){
  return [...read(file).matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1]));
}
function render(block:string,values:Record<string,unknown>){
  return block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No test value for \${${key}}`);
    return literal(values[key]);
  });
}

const certificationSql=sqlBlocks("lib/flight-certification.ts");
const readBlock=certificationSql.find(b=>b.includes("JOIN users u ON u.id=f.user_id"));
const sealBlock=certificationSql.find(b=>b.includes("UPDATE flights")&&b.includes("certification_hash="));

/** The owned-row read certifyStoredFlight uses for compliance and the fingerprint. */
function certificationRow(userId:number,flightId:number){
  assert.ok(readBlock,"certification row SELECT not found in lib/flight-certification.ts");
  return rows(render(readBlock,{userId,flightId}))[0]??null;
}
/** The guarded seal UPDATE certifyStoredFlight runs; returns the RETURNING rows. */
function seal(userId:number,flightId:number,certificationHash:string,rowXmin:unknown){
  assert.ok(sealBlock,"certification seal UPDATE not found in lib/flight-certification.ts");
  return rows(render(sealBlock,{userId,flightId,certificationHash,'String(row.row_xmin??"")':String(rowXmin??"")}));
}
function readyHash(row:Record<string,unknown>,userId:number){
  assert.deepEqual(blockingComplianceIssues(flightCertificationCompliance(row,String(row.pilot_name??""))),[],"fixture flight must be certifiable");
  return flightCertificationHash({...row,certification_version:8},userId,8);
}
function stored(flightId:number){
  return rows(`SELECT to_jsonb(f)||jsonb_build_object('date',f.date::text) r FROM flights f WHERE id=${flightId}`)[0].r as Record<string,unknown>;
}

// A complete, FCL.050-compliant single-pilot PIC draft.
const READY="'EASA','OK-CRT','Cessna','172','S','C172','SEP','AEROPLANE','LKPR','LKTB','08:00','08:05','08:55','09:00',1,'SP','SE',1,60,'SELF','PIC','Local circuits'";
const READY_COLUMNS="evidence,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type,aircraft_class,regulatory_category,departure,arrival,off_block,takeoff,landing,on_block,starts,operation_type,engine_type,landings_day,pic_minutes,commander,role,task";

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const optimization=sqlBlocks("lib/db-optimization.ts");
  const block=(needle:string,which:"first"|"last"="first")=>{
    const found=optimization.filter(b=>b.includes(needle));
    const value=which==="last"?found.at(-1):found[0];
    assert.ok(value,`Production SQL block not found: ${needle}`);
    assert.doesNotMatch(value,/\$\{/);
    return value;
  };
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),date DATE NOT NULL DEFAULT DATE '2026-06-01',evidence TEXT NOT NULL DEFAULT '',
      registration TEXT NOT NULL DEFAULT '',aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,
      departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,operation_type TEXT NOT NULL DEFAULT '',engine_type TEXT NOT NULL DEFAULT '',operator_name TEXT NOT NULL DEFAULT '',flight_number TEXT NOT NULL DEFAULT '',operation_context TEXT NOT NULL DEFAULT '',
      landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 3,
      locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
    );
    ${block("CREATE TABLE IF NOT EXISTS flight_certified_revisions")};
    ${block("CREATE TABLE IF NOT EXISTS voided_certified_flights")};
    ${block("CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()","last")};
    CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
    INSERT INTO users(id,display_name) VALUES(${PILOT},'Gate Pilot'),(${OTHER},'Other Pilot');
    INSERT INTO flights(id,user_id,${READY_COLUMNS}) VALUES
      (701,${PILOT},${READY}),(702,${PILOT},${READY}),(703,${PILOT},${READY}),(704,${PILOT},${READY}),(705,${PILOT},${READY});
    UPDATE flights SET locked_at=NOW(),locked_by_user_id=${PILOT} WHERE id=704;
  `);
  if(result.status!==0)throw new Error(`Certification gate fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("certification seals the owner's ready draft with a verifiable v8 fingerprint and locks it",{skip:!enabled},()=>{
  const row=certificationRow(PILOT,701);
  assert.ok(row);
  assert.equal(row.pilot_name,"Gate Pilot");
  const hash=readyHash(row,PILOT);
  assert.deepEqual(seal(PILOT,701,hash,row.row_xmin),[{id:701,record_revision:1,certification_hash:hash}]);

  const sealed=stored(701);
  assert.ok(sealed.certified_at&&sealed.locked_at);
  assert.equal(sealed.certified_by_user_id,PILOT);
  assert.equal(sealed.locked_by_user_id,PILOT);
  assert.equal(sealed.certification_version,8);
  assert.equal(verifyFlightCertification(sealed,PILOT).status,"verified");
  // The fingerprint is bound to the owner and to the recorded content.
  assert.equal(verifyFlightCertification(sealed,OTHER).status,"mismatch");
  assert.equal(verifyFlightCertification({...sealed,registration:"OK-XXX"},PILOT).status,"mismatch");
  // Once sealed, the protection trigger rejects silent edits, and a second seal finds nothing.
  reject(`UPDATE flights SET note='tampered' WHERE id=701`,/Certified flight is immutable/i);
  assert.deepEqual(seal(PILOT,701,"other-hash",certificationRow(PILOT,701)?.row_xmin),[]);
  assert.equal(stored(701).certification_hash,hash);
});

test("certification never reads or seals another pilot's flight",{skip:!enabled},()=>{
  assert.equal(certificationRow(OTHER,702),null);
  const own=certificationRow(PILOT,702);
  assert.ok(own);
  assert.deepEqual(seal(OTHER,702,readyHash(own,PILOT),own.row_xmin),[]);
  const untouched=stored(702);
  assert.equal(untouched.certified_at,null);
  assert.equal(untouched.locked_at,null);
  assert.equal(untouched.certification_hash,"");
});

test("certification refuses to seal a row that changed after it was checked",{skip:!enabled},()=>{
  const checked=certificationRow(PILOT,703);
  assert.ok(checked);
  const hash=readyHash(checked,PILOT);
  // A concurrent draft edit lands between the compliance check and the seal.
  run(`UPDATE flights SET arrival='LKVO' WHERE id=703`);
  assert.deepEqual(seal(PILOT,703,hash,checked.row_xmin),[]);
  assert.equal(stored(703).certified_at,null);
  // Re-reading the current row and fingerprinting what is actually stored succeeds.
  const current=certificationRow(PILOT,703);
  assert.ok(current);
  assert.notEqual(current.row_xmin,checked.row_xmin);
  const currentHash=readyHash(current,PILOT);
  assert.notEqual(currentHash,hash);
  assert.equal(seal(PILOT,703,currentHash,current.row_xmin).length,1);
  const sealed=stored(703);
  assert.equal(sealed.arrival,"LKVO");
  assert.equal(verifyFlightCertification(sealed,PILOT).status,"verified");
});

test("certification does not seal a locked draft or re-seal a certified record",{skip:!enabled},()=>{
  const row=certificationRow(PILOT,704);
  assert.ok(row?.locked_at);
  assert.deepEqual(seal(PILOT,704,readyHash(row,PILOT),row.row_xmin),[]);
  const unchanged=stored(704);
  assert.equal(unchanged.certified_at,null);
  assert.equal(unchanged.certification_hash,"");

  // A legacy certified record that was never locked keeps its original fingerprint.
  run(`INSERT INTO flights(id,user_id,${READY_COLUMNS},certified_at,certified_by_user_id,certification_hash,certification_version)
    VALUES(707,${PILOT},${READY},NOW(),${PILOT},'legacy-hash',3)`);
  const legacy=certificationRow(PILOT,707);
  assert.ok(legacy?.certified_at&&!legacy.locked_at);
  assert.deepEqual(seal(PILOT,707,readyHash(legacy,PILOT),legacy.row_xmin),[]);
  const kept=stored(707);
  assert.equal(kept.certification_hash,"legacy-hash");
  assert.equal(kept.certification_version,3);
  assert.equal(kept.locked_at,null);
});

test("certification fails closed for an incomplete flight",{skip:!enabled},()=>{
  run(`UPDATE flights SET registration='',pic_minutes=30 WHERE id=705`);
  const row=certificationRow(PILOT,705);
  assert.ok(row);
  const codes=blockingComplianceIssues(flightCertificationCompliance(row,String(row.pilot_name))).map(issue=>issue.code);
  assert.ok(codes.includes("registration"),codes.join(","));
  assert.ok(codes.includes("function_time_allocation"),codes.join(","));
});

test("the certification row carries every stored field the fingerprint and compliance read",{skip:!enabled},()=>{
  // Every payload field holds a distinct non-default value, so a column missing from the
  // certification SELECT changes the payload instead of silently hashing a default.
  run(`INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type,aircraft_class,regulatory_category,
      balloon_class,balloon_group,balloon_operation,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,
      operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,landings_night,movement_evidence_recorded,
      takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,
      commander,instructor,role,task,note,purpose_code,verification_name,verification_reference,record_revision,correction_reason)
    VALUES(706,${PILOT},DATE '2026-07-14','EASA','OK-ALL','Make','Model','Variant','TYPE','MEP','AEROPLANE',
      'HOT_AIR_BALLOON','C','TETHERED','WINCH',2,'LKPR','EDDM','10:00','10:07','11:41','11:50',3,
      'MP','ME','Example Air','EX706','CAT',2,1,TRUE,
      2,1,3,1,25,40,11,12,13,14,
      'Captain Ref','Instructor Ref','CO-PILOT','Line check','Remark','FCL140A','Verifier Ref','SIG-706',4,'Corrected time')`);
  const row=certificationRow(PILOT,706);
  assert.ok(row);
  const full={...stored(706),pilot_name:"Gate Pilot"};
  for(let version=1;version<=8;version++){
    assert.deepEqual(flightCertificationPayload(row,PILOT,version),flightCertificationPayload(full,PILOT,version),`payload v${version}`);
  }
  assert.deepEqual(flightCertificationCompliance(row,String(row.pilot_name)),flightCertificationCompliance(full,"Gate Pilot"));
});
