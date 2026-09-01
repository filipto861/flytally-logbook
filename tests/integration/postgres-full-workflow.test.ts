import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { flightCertificationHash,verifyFlightCertification } from "../../lib/certification-integrity.ts";
import { verificationCryptographicStatus } from "../../lib/authority-verification.ts";
import { signVerificationPayload } from "../../lib/verification-signature.ts";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_workflow_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function rawPsql(statement:string){
  const result=spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL full-workflow command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
function sqlBlock(source:string,needle:string,which:"first"|"last"="first"){
  const blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]).filter(value=>value.includes(needle));
  const block=which==="last"?blocks.at(-1):blocks[0];
  assert.ok(block,`Production SQL block not found: ${needle}`);
  return block;
}
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"NULL";
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  return`'${String(value).replaceAll("'","''")}'`;
}
function render(block:string,values:Record<string,unknown>){
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{
    const key=String(expression).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No workflow SQL test value for ${key}`);
    return literal(values[key]);
  });
  assert.doesNotMatch(rendered,/\$\{/);
  return rendered;
}
function productionSqlBlock(source:string,needle:string,which:"first"|"last"="first"){
  const block=sqlBlock(source,needle,which);
  assert.doesNotMatch(block,/\$\{/ ,`Acceptance DDL contains unresolved interpolation: ${needle}`);
  return block;
}

const flightColumns=`
  id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT 'AEROPLANE',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',starts INTEGER NOT NULL DEFAULT 0,operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 5,locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT
`;

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for PostgreSQL full-workflow acceptance tests");
  const dbSource=read("lib/db-optimization.ts");
  const revisionTable=productionSqlBlock(dbSource,"CREATE TABLE IF NOT EXISTS flight_certified_revisions");
  const protectionFunction=productionSqlBlock(dbSource,"CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()","last");
  const participationTable=productionSqlBlock(dbSource,"CREATE TABLE IF NOT EXISTS flight_participations");
  const verificationTable=productionSqlBlock(dbSource,"CREATE TABLE IF NOT EXISTS flight_verifications");
  const participationCancelled=productionSqlBlock(dbSource,"ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS cancelled_at");
  const participationSuperseded=productionSqlBlock(dbSource,"ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS superseded_at");
  const participationMemberIndex=productionSqlBlock(dbSource,"CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_participations_revision_member");
  const setup=`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,email TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(${flightColumns});
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,icao_type TEXT NOT NULL DEFAULT '');
    CREATE TABLE pilot_connections(id BIGSERIAL PRIMARY KEY,requester_user_id BIGINT NOT NULL,recipient_user_id BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',requester_label TEXT NOT NULL DEFAULT '',recipient_label TEXT NOT NULL DEFAULT '',relationship TEXT NOT NULL DEFAULT '');
    CREATE TABLE instructor_flight_approvals(id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,student_user_id BIGINT NOT NULL,instructor_user_id BIGINT NOT NULL,record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),decided_at TIMESTAMPTZ,decision_note TEXT NOT NULL DEFAULT '',UNIQUE(flight_id,record_revision));
    ${revisionTable};
    ${protectionFunction};
    CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
    ${participationTable};
    ${participationCancelled};
    ${participationSuperseded};
    ${participationMemberIndex};
    ${verificationTable};
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS decision_note TEXT NOT NULL DEFAULT '';
    ALTER TABLE flight_participations ADD COLUMN IF NOT EXISTS approval_id BIGINT;
    INSERT INTO users(id,email,display_name) VALUES(41,'pilot@example.test','Workflow Pilot'),(42,'fi@example.test','Test Instructor');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status,requester_label,recipient_label,relationship) VALUES(41,42,'accepted','instructor','student','recipient_instructor');
    INSERT INTO aircraft(user_id,registration,icao_type) VALUES(41,'OK-WF1','BR23');
  `;
  const result=rawPsql(setup);
  if(result.status!==0)throw new Error(`PostgreSQL full-workflow schema setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{if(enabled)rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`)});

test("AC-01/03/04/05/06/26 full certified workflow stays consistent across current and historical projections",{skip:!enabled},()=>{
  process.env.SIGNING_SECRET=process.env.SIGNING_SECRET||"flytally-ci-signing-secret-with-enough-entropy";
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const training=read("lib/training-verification.ts");
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  const audit=read("app/(protected)/flights/[id]/audit/page.tsx");
  const report=read("app/(protected)/flights/[id]/verification-report/page.tsx");
  const print=read("app/(protected)/print/page.tsx");

  const draft={id:401,user_id:41,date:"2026-08-28",evidence:"EASA",registration:"OK-WF1",aircraft_make:"Bristell",aircraft_model:"B23",aircraft_variant:"",aircraft_type:"B23",aircraft_class:"SEP",regulatory_category:"AEROPLANE",launch_method:"",launches:0,departure:"LKPR",arrival:"LKBE",off_block:"08:00",takeoff:"08:05",landing:"09:00",on_block:"09:05",starts:1,operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,movement_evidence_recorded:false,takeoffs_day:0,takeoffs_night:0,approaches_day:0,approaches_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:0,copilot_minutes:0,dual_minutes:65,instructor_minutes:0,commander:"Test Instructor",instructor:"Test Instructor",role:"DUAL",task:"Training exercise",note:"",purpose_code:"",verification_name:"",verification_reference:"",certification_version:5,record_revision:1,correction_reason:""};
  run(`INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_make,aircraft_model,aircraft_variant,aircraft_type,aircraft_class,regulatory_category,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,operation_type,engine_type,landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,commander,instructor,role,task,note,purpose_code,verification_name,verification_reference,certification_version,record_revision,correction_reason)
    VALUES(401,41,'2026-08-28','EASA','OK-WF1','Bristell','B23','','B23','SEP','AEROPLANE','',0,'LKPR','LKBE','08:00','08:05','09:00','09:05',1,'SP','SE',1,0,FALSE,0,0,0,0,0,0,0,0,65,0,'Test Instructor','Test Instructor','DUAL','Training exercise','','','','',5,1,'')`);

  const certifyUpdate=sqlBlock(certification,"UPDATE flights SET certified_at=NOW(),certified_by_user_id=");
  const r1Hash=flightCertificationHash(draft,41,5);
  run(render(certifyUpdate,{flightId:401,userId:41,certificationHash:r1Hash}));
  const certifiedR1=rows(`SELECT * FROM flights WHERE id=401 AND user_id=41`)[0];
  assert.equal(verifyFlightCertification(certifiedR1,41).status,"verified");

  const requestInsert=sqlBlock(training,"INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role");
  function requestRevision(revision:number,hash:string){
    const inserted=rows(render(requestInsert,{flightId:401,studentUserId:41,instructorUserId:42}))[0];
    const participationId=Number(inserted.id);
    const participation=rows(`SELECT * FROM flight_participations WHERE id=${participationId}`)[0];
    assert.equal(Number(participation.source_revision),revision);
    assert.equal(String(participation.source_hash),hash);
    assert.equal(participation.approval_id,null,"Modern instructor requests must remain participation-only");
    return{participationId,approvalId:0};
  }

  const signInsert=sqlBlock(shared,"INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash");
  const signParticipation=sqlBlock(shared,"UPDATE flight_participations SET status='accepted',responded_at=NOW(),decision_note=");
  const signApproval=sqlBlock(shared,"UPDATE instructor_flight_approvals SET status='approved',decided_at=NOW(),decision_note=");
  const credentialSnapshot={identity:"Test Instructor",source:"FlyTally account",licences:[{licence_type:"CPL(A)",licence_number:"CZ.FCL.TEST",authority:"CAA CZ"}],qualifications:[{qualification_type:"FI(A)",certificate_reference:"FI-TEST"}]};
  function signRevision(revision:number,hash:string,participationId:number,approvalId:number,note:string){
    const payload={flightId:401,flightUserId:41,signerUserId:42,recordRevision:revision,flightHash:hash,verificationRole:"INSTRUCTOR",credentialSnapshot};
    const signature=signVerificationPayload(payload);
    run(render(signInsert,{"payload.flightId":401,"payload.flightUserId":41,"session.userId":42,verificationRole:"INSTRUCTOR","payload.recordRevision":revision,"payload.flightHash":hash,"JSON.stringify(credentialSnapshot)":JSON.stringify(credentialSnapshot),signature,note}));
    run(render(signParticipation,{note,participationId,"session.userId":42}));
    run(render(signApproval,{note,"Number(row.approval_id)||0":approvalId,"payload.flightId":401,"payload.flightUserId":41,"session.userId":42,"payload.recordRevision":revision,"payload.flightHash":hash}));
    const verification=rows(`SELECT * FROM flight_verifications WHERE flight_id=401 AND flight_user_id=41 AND signer_user_id=42 AND record_revision=${revision}`)[0];
    assert.equal(verificationCryptographicStatus(verification),"verified");
    return Number(verification.id);
  }

  const r1Request=requestRevision(1,r1Hash);
  const r1VerificationId=signRevision(1,r1Hash,r1Request.participationId,r1Request.approvalId,"R1 reviewed and signed");

  const correctionReason="Correct destination after post-flight review";
  const archiveInsert=sqlBlock(certification,"INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data");
  const correctionUpdate=sqlBlock(certification,"UPDATE flights SET record_revision=COALESCE(record_revision,1)+1");
  run(render(archiveInsert,{flightId:401,userId:41,reason:correctionReason}));
  run(render(correctionUpdate,{reason:correctionReason,flightId:401,userId:41}));

  const detailVerification=sqlBlock(detail,"SELECT v.id,v.signer_user_id,v.signed_at,v.credential_snapshot");
  assert.equal(rows(render(detailVerification,{id:401,userId:41})).length,0,"R1 signature must not appear as current after opening R2");

  const printQuery=sqlBlock(print,"SELECT f.date,f.evidence,f.registration,f.aircraft_type");
  const draftPrint=rows(render(printQuery,{userId:41,scope:"easa",from:null,to:null,includeAuxiliary:false}));
  assert.equal(draftPrint.length,1);
  assert.equal(draftPrint[0].certified_at,null);
  assert.equal(draftPrint[0].instructor_approval_name,null,"Historical R1 signature must not leak into current R2 print projection");

  run(`UPDATE flights SET arrival='LKMB',note='Destination corrected from LKBE to LKMB' WHERE id=401 AND user_id=41`);
  const r2Draft=rows(`SELECT * FROM flights WHERE id=401 AND user_id=41`)[0];
  assert.equal(Number(r2Draft.record_revision),2);
  assert.equal(String(r2Draft.correction_reason),correctionReason);
  const r2Hash=flightCertificationHash(r2Draft,41,5);
  run(render(certifyUpdate,{flightId:401,userId:41,certificationHash:r2Hash}));

  const r2Request=requestRevision(2,r2Hash);
  const r2VerificationId=signRevision(2,r2Hash,r2Request.participationId,r2Request.approvalId,"R2 reviewed and signed");
  assert.notEqual(r1VerificationId,r2VerificationId);

  const current=rows(`SELECT * FROM flights WHERE id=401 AND user_id=41`)[0];
  assert.equal(Number(current.record_revision),2);
  assert.equal(String(current.arrival),"LKMB");
  assert.equal(verifyFlightCertification(current,41).status,"verified");
  const archived=rows(`SELECT revision_number,certification_hash,certification_version,correction_reason,snapshot_data FROM flight_certified_revisions WHERE flight_id=401 AND user_id=41 ORDER BY revision_number`);
  assert.equal(archived.length,1);
  assert.equal(Number(archived[0].revision_number),1);
  assert.equal(String(archived[0].correction_reason),correctionReason);
  const archivedSnapshot={...(archived[0].snapshot_data as Record<string,unknown>),certification_hash:archived[0].certification_hash,certification_version:archived[0].certification_version};
  assert.equal(verifyFlightCertification(archivedSnapshot,41).status,"verified");

  const currentDetail=rows(render(detailVerification,{id:401,userId:41}));
  assert.equal(currentDetail.length,1);
  assert.equal(Number(currentDetail[0].id),r2VerificationId,"Flight detail must select the exact current R2 signature");

  const auditVerification=sqlBlock(audit,"SELECT v.*,u.display_name signer_name FROM flight_verifications");
  const auditRows=rows(render(auditVerification,{id:401,userId:41}));
  assert.deepEqual(auditRows.map(row=>Number(row.record_revision)),[1,2]);
  assert.ok(auditRows.every(row=>verificationCryptographicStatus(row)==="verified"));

  const reportCurrent=sqlBlock(report,"SELECT f.*,u.display_name pilot_name,u.email pilot_email FROM flights");
  const reportArchive=sqlBlock(report,"SELECT revision_number,certification_hash,certification_version,certified_at,superseded_at,correction_reason,snapshot_data FROM flight_certified_revisions");
  const reportVerification=sqlBlock(report,"SELECT v.*,u.display_name signer_name FROM flight_verifications");
  const reportCurrentRows=rows(render(reportCurrent,{id:401,userId:41}));
  const reportArchiveRows=rows(render(reportArchive,{id:401,userId:41}));
  const reportVerificationRows=rows(render(reportVerification,{id:401,userId:41}));
  assert.equal(Number(reportCurrentRows[0].record_revision),2);
  assert.equal(reportArchiveRows.length,1);
  assert.deepEqual(reportVerificationRows.map(row=>Number(row.record_revision)),[1,2]);
  assert.ok(reportVerificationRows.every(row=>verificationCryptographicStatus(row)==="verified"));

  const finalPrint=rows(render(printQuery,{userId:41,scope:"easa",from:null,to:null,includeAuxiliary:false}));
  assert.equal(finalPrint.length,1);
  assert.ok(finalPrint[0].certified_at);
  assert.equal(String(finalPrint[0].instructor_approval_name),"Test Instructor");
  assert.equal(String(finalPrint[0].arrival),"LKMB");

  assert.equal(run(`SELECT COUNT(*) FROM instructor_flight_approvals WHERE flight_id=401`),"0","Modern workflow must not recreate legacy approvals");
  assert.equal(run(`SELECT COUNT(*) FROM flight_verifications WHERE flight_id=401 AND flight_user_id=41 AND status='signed'`),"2");
  assert.equal(run(`SELECT COUNT(*) FROM flight_verifications v JOIN flights f ON f.id=v.flight_id AND f.user_id=v.flight_user_id WHERE v.flight_id=401 AND v.status='signed' AND v.record_revision=f.record_revision AND v.flight_hash=f.certification_hash`),"1");
});
