import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F2.4A certification never infers a verifier account from typed crew names",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  assert.doesNotMatch(certification,/autoRequestTrainingVerification/);
  assert.doesNotMatch(certification,/upsertInstructorRequest/);
  assert.doesNotMatch(certification,/LOWER\(TRIM\(u\.display_name\)\)/);
  assert.doesNotMatch(certification,/pilot_connections/);
});

test("F2.4A keeps certification hash version and record locking unchanged",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  assert.match(certification,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(certification,/certification_version=8/);
  assert.match(certification,/certified_at=NOW\(\),certified_by_user_id=\$\{userId\}/);
  assert.match(certification,/await refreshRecencySnapshot\(userId\);revalidateFlight\(flightId\)/);
});

test("F2.4A account-bound verification remains an explicit account-id action",()=>{
  const action=read("app/(protected)/flights/instructor-actions.ts");
  const helper=read("lib/training-verification.ts");
  assert.match(action,/const instructorId=id\(form\.get\("instructor_id"\)\)/);
  assert.match(action,/await upsertInstructorRequest\(userId,flightId,instructorId\)/);
  assert.match(helper,/c\.status='accepted'/);
  assert.match(helper,/participant_role='INSTRUCTOR'/);
  assert.match(helper,/source_revision=COALESCE\(f\.record_revision,1\)/);
  assert.doesNotMatch(action,/display_name\s*=|LOWER\(TRIM\(u\.display_name\)\)/);
});

test("F2.4A flight detail copy separates typed evidence from account binding",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(detail,/stored as flight evidence only/);
  assert.match(detail,/Certification does not bind it to a FlyTally account/);
  assert.match(detail,/choose a connected instructor explicitly/);
  assert.doesNotMatch(detail,/send the certified revision automatically when the name matches/);
  assert.doesNotMatch(detail,/Request sent automatically to/);
});
