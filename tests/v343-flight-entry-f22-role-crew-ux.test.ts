import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F2.2 derives inline RoleCrew visibility and required cues from the shared contract",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/import \{ roleCrewSpec \} from "@\/lib\/role-crew"/);
  assert.match(form,/crewSpec=roleCrewSpec\(role,evidence\)/);
  assert.match(form,/dualCrewInline=crewSpec\?\.rolePicIdentitySource==="INSTRUCTOR"/);
  assert.match(form,/supervisedCrewInline=crewSpec\?\.rolePicIdentitySource==="VERIFIER"/);
  assert.match(form,/safetyCrewInline=crewSpec\?\.connectedActualPic==="allowed"/);
  assert.match(form,/dualInstructorRequired=crewSpec\?\.instructor==="required_save"/);
  assert.match(form,/verificationNameRequired=crewSpec\?\.verificationName==="required_save"/);
  assert.match(form,/verificationReferenceRequired=crewSpec\?\.verificationReference==="required_save"/);
  assert.match(form,/safetyPicRequired=crewSpec\?\.commander==="external_resolver"/);
});

test("F2.2 completion blockers cover every EASA Save-required RoleCrew field",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/dualInstructorMissing=Boolean\(dualInstructorRequired&&!instructorValue\.trim\(\)\)/);
  assert.match(form,/verificationNameMissing=Boolean\(verificationNameRequired&&!verificationNameValue\.trim\(\)\)/);
  assert.match(form,/verificationReferenceMissing=Boolean\(verificationReferenceRequired&&!verificationReferenceValue\.trim\(\)\)/);
  for(const pair of [
    'roleInstructor:"Instructor / PIC"',
    'actualPic:"Actual PIC"',
    'supervisingPic:"Supervising PIC / FI"',
    'countersignature:"Countersignature reference"',
  ])assert.ok(form.includes(pair),pair);
  assert.match(form,/roleInstructor:'\[name="instructor"\]'/);
  assert.match(form,/supervisingPic:'\[name="verificationName"\]'/);
  assert.match(form,/countersignature:'\[name="verificationReference"\]'/);
});

test("F2.2 keeps role switching non-destructive in the browser and leaves server semantics authoritative",()=>{
  const form=read("components/flight-form.tsx");
  const parser=read("lib/flight-input.ts");
  const roleCrew=read("lib/role-crew.ts");
  assert.match(form,/\[instructorValue,setInstructorValue\]=useState\(field\("instructor"\)\)/);
  assert.match(form,/\[verificationNameValue,setVerificationNameValue\]=useState\(field\("verification_name"\)\)/);
  assert.match(form,/\[verificationReferenceValue,setVerificationReferenceValue\]=useState\(field\("verification_reference"\)\)/);
  assert.match(parser,/roleCrewSaveError\(crewSpec,\{instructor,verificationName,verificationReference\}\)/);
  assert.match(roleCrew,/rolePicIdentitySource="SELF"/);
  assert.match(roleCrew,/if\(SELF_PIC_ROLES\.has\(role\)\)return\["COMMANDER","SELF"\]/);
  assert.doesNotMatch(form,/fcl050FlightCompliance|certificationFingerprint|flight_participations/);
});
