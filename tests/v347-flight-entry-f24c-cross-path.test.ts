import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseFlightInput } from "../lib/flight-input.ts";
import { pilotInCommandName } from "../lib/logbook-print.ts";
import { flightAuditChanges } from "../lib/flight-audit.ts";
import { GPS_IMPORT_ROLES,validateGpsImportRole } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function formFor(role:string){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-10-01",
    registration:"OK-F24C",
    aircraftType:"Bristell B23",
    aircraftClass:"SEP",
    evidence:"EASA",
    departure:"LKLT",
    arrival:"LKPR",
    offBlock:"10:00",
    takeoff:"10:05",
    landing:"10:55",
    onBlock:"11:00",
    starts:"1",
    landingsDay:"1",
    role,
    billingBasis:"",
    operationType:"SP",
    engineType:"SE",
  }))form.set(key,value);
  return form;
}

test("F2.4C Manual role changes remain non-destructive across overlapping crew evidence",()=>{
  const dual=formFor("DUAL");
  dual.set("commander","Historical Commander");
  dual.set("instructor","Training Instructor");
  dual.set("verificationName","Examiner Evidence");
  dual.set("verificationReference","Signed DUAL evidence");
  let parsed=parseFlightInput(dual);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.commander,"Historical Commander");
  assert.equal(parsed.data?.instructor,"Training Instructor");
  assert.equal(parsed.data?.verificationName,"Examiner Evidence");
  assert.equal(parsed.data?.verificationReference,"Signed DUAL evidence");

  const pic=formFor("PIC");
  pic.set("commander",parsed.data?.commander??"");
  pic.set("instructor",parsed.data?.instructor??"");
  pic.set("verificationName",parsed.data?.verificationName??"");
  pic.set("verificationReference",parsed.data?.verificationReference??"");
  parsed=parseFlightInput(pic);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.commander,"Historical Commander");
  assert.equal(parsed.data?.instructor,"Training Instructor");
  assert.equal(parsed.data?.verificationName,"Examiner Evidence");
  assert.equal(parsed.data?.verificationReference,"Signed DUAL evidence");

  const spic=formFor("SPIC");
  spic.set("commander",parsed.data?.commander??"");
  spic.set("instructor",parsed.data?.instructor??"");
  spic.set("verificationName","Supervising PIC");
  spic.set("verificationReference","Signed SPIC ref");
  parsed=parseFlightInput(spic);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.commander,"Historical Commander");
  assert.equal(parsed.data?.instructor,"Training Instructor");
  assert.equal(parsed.data?.verificationName,"Supervising PIC");
  assert.equal(parsed.data?.verificationReference,"Signed SPIC ref");
});

test("F2.4C certification stays separate from account-bound instructor requests",()=>{
  const certification=read("lib/flight-certification.ts");
  const instructorActions=read("app/(protected)/flights/instructor-actions.ts");
  const verification=read("lib/training-verification.ts");

  assert.doesNotMatch(certification,/autoRequestTrainingVerification|upsertInstructorRequest|pilot_connections|LOWER\(TRIM\(u\.display_name\)\)/);
  assert.match(certification,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(certification,/certification_version=8/);

  assert.match(instructorActions,/form\.get\("instructor_id"\)/);
  assert.match(instructorActions,/upsertInstructorRequest\(userId,flightId,instructorId\)/);
  assert.match(verification,/participant_role='INSTRUCTOR'/);
  assert.match(verification,/source_revision=COALESCE\(f\.record_revision,1\)/);
  assert.match(verification,/source_hash/);
});

test("F2.4C in-person verification remains exact-revision/hash evidence and does not imply FlyTally identity",()=>{
  const route=read("app/(protected)/flights/[id]/in-person-signature/page.tsx");

  assert.match(route,/recordRevision=Math\.max\(1,Number\(row\.record_revision\)\|\|1\)/);
  assert.match(route,/flightHash=text\(row\.certification_hash\)/);
  assert.match(route,/signerUserId:null/);
  assert.match(route,/source:"In-person handwritten signature"/);
  assert.match(route,/signVerificationPayload\(payload\)/);
  assert.match(route,/flight_hash,credential_snapshot,payload_hash,server_signature,status,signed_at/);
  assert.match(route,/participant_role='INSTRUCTOR' AND status='pending'/);
  assert.match(route,/status='cancelled'/);
  assert.match(route,/identity was not independently authenticated by a FlyTally account/);
});

test("F2.4C shared materialization stays revision/hash-bound and preserves PIC commander provenance",()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");

  assert.match(shared,/Number\(row\.record_revision\)!==Number\(row\.source_revision\)/);
  assert.match(shared,/text\(row\.certification_hash\)!==text\(row\.source_hash\)/);
  assert.match(shared,/picCommanderBasis==="RECIPIENT_ACCOUNT"/);
  assert.match(shared,/picCommanderBasis==="CERTIFIED_SOURCE_COMMANDER"/);
  assert.match(shared,/sourceRole!=="SAFETY PILOT"/);
  assert.match(shared,/flight_connected_crew linked/);
  assert.match(shared,/const commander=pic\?\(picCommanderBasis==="CERTIFIED_SOURCE_COMMANDER"\?text\(row\.commander\):participantName\)/);
  assert.match(shared,/participant_flight_id=chosen\.id/);
});

test("F2.4C print/read-only/export preserve RoleCrew display semantics and raw evidence",()=>{
  assert.equal(pilotInCommandName({role:"PIC",commander:"Historical Captain"},"Owner Pilot"),"Historical Captain");
  assert.equal(pilotInCommandName({role:"PIC",commander:""},"Owner Pilot"),"Owner Pilot");
  assert.equal(pilotInCommandName({role:"DUAL",instructor:"Instructor",commander:"Captain"},"Student"),"Instructor");
  assert.equal(pilotInCommandName({role:"SPIC",verification_name:"Supervisor",commander:"Captain"},"Student"),"Supervisor");

  const print=read("app/(protected)/print/page.tsx");
  const readonly=read("components/readonly-logbook-entry.tsx");
  const exportRoute=read("app/api/export/route.ts");

  assert.match(print,/pilotInCommandName/);
  assert.match(readonly,/pilotInCommandName/);
  for(const field of ["commander","instructor","verification_name","verification_reference"])assert.match(exportRoute,new RegExp(`"${field}"`));
  assert.match(exportRoute,/\["csv","xls","json"\]\.includes\(format\)/);
  assert.match(exportRoute,/if\(format==="xls"\)/);
  assert.match(exportRoute,/"content-type":"text\/csv; charset=utf-8"/);
  assert.match(exportRoute,/"content-type":"application\/vnd\.ms-excel; charset=utf-8"/);
});

test("F2.4C audit and backup keep raw RoleCrew evidence observable and recoverable",()=>{
  const changes=flightAuditChanges(
    {commander:"Old PIC",instructor:"Old FI",verification_name:"Old supervisor",verification_reference:"Old ref"},
    {commander:"New PIC",instructor:"New FI",verification_name:"New supervisor",verification_reference:"New ref"},
  );
  assert.deepEqual(changes.map(item=>item.field),["commander","instructor","verification_name","verification_reference"]);

  const accountBackup=read("lib/account-backup.ts");
  const portable=read("lib/portable-backup.ts");
  assert.match(accountBackup,/SELECT \* FROM flights WHERE user_id=\$\{userId\}/);
  assert.match(accountBackup,/flight_verifications/);
  assert.match(portable,/flights:BackupRow\[\]/);
  assert.match(portable,/flight_verifications\?:BackupRow\[\]/);
});

test("F2.4C recency accepts instructor evidence only when signed verification matches exact revision and hash",()=>{
  const recency=read("lib/recency-service.ts");
  assert.match(recency,/v\.flight_id=f\.id/);
  assert.match(recency,/v\.flight_user_id=f\.user_id/);
  assert.match(recency,/v\.record_revision=COALESCE\(f\.record_revision,1\)/);
  assert.match(recency,/v\.flight_hash=f\.certification_hash/);
  assert.match(recency,/v\.verification_role='INSTRUCTOR'/);
  assert.match(recency,/v\.status='signed'/);
  assert.doesNotMatch(recency,/instructor_signed[^\n]*verification_name/);
});

test("F2.4C Safety Pilot F2.3 remains server-authoritative and account identity stays separate metadata",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const connected=read("lib/flight-connected-crew.ts");

  assert.match(actions,/resolveSafetyPilotPicForSave/);
  assert.match(actions,/flight_connected_crew/);
  assert.match(connected,/Selected Actual PIC is no longer an accepted Connection/);
  assert.match(connected,/pilot_connections/);
  assert.match(connected,/status='accepted'/);
  assert.match(connected,/display_name/);
  assert.doesNotMatch(connected,/LOWER\(TRIM\(u\.display_name\)\)=LOWER/);
});

test("F2.4C GPS multi-role expansion remains narrow while F4.3 adds full Safety Pilot authority",()=>{
  assert.deepEqual([...GPS_IMPORT_ROLES],["PIC","DUAL","SAFETY PILOT"]);
  assert.deepEqual(validateGpsImportRole("PIC"),{role:"PIC"});
  assert.deepEqual(validateGpsImportRole("DUAL"),{role:"DUAL"});
  assert.deepEqual(validateGpsImportRole("SAFETY PILOT"),{role:"SAFETY PILOT"});
  assert.match(validateGpsImportRole("SPIC").error??"",/supports PIC, DUAL and SAFETY PILOT/i);
  assert.match(validateGpsImportRole("PICUS").error??"",/supports PIC, DUAL and SAFETY PILOT/i);

  const form=read("components/kml-import-form.tsx");
  assert.match(form,/GPS_IMPORT_ROLES\.map\(value=><option/);
  assert.match(form,/role==="DUAL"/);
  assert.match(form,/role==="SAFETY PILOT"/);
  assert.match(form,/connectedPicUserId/);
});
