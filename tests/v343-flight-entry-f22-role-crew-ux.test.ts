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

test("F2.2 places role-defining identity immediately after Role inside Flight essentials",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-primary');
  const end=form.indexOf('entry-section entry-section-experience',start);
  const essentials=form.slice(start,end);
  const roleAt=essentials.indexOf('name="role"');
  const inlineAt=essentials.indexOf('className="form-grid role-crew-inline-grid"');
  const routeAt=essentials.indexOf('essential-route-group');
  assert.ok(roleAt>=0&&inlineAt>roleAt&&routeAt>inlineAt);
  for(const token of ["Instructor / PIC","Actual PIC source","Actual PIC","Supervising PIC / FI","Countersignature reference"])assert.ok(essentials.includes(token),token);
  assert.match(essentials,/required=\{dualInstructorRequired\}/);
  assert.match(essentials,/required=\{safetyPicRequired\}/);
  assert.match(essentials,/required=\{verificationNameRequired\}/);
  assert.match(essentials,/required=\{verificationReferenceRequired\}/);
});

test("F2.2 keeps generic crew fields available but outside required inline identity",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-role-context');
  const end=form.indexOf('Aircraft context',start);
  const additional=form.slice(start,end);
  assert.match(additional,/Additional crew details/);
  assert.match(form,/\{role&&role!=="DUAL"\?<details className="entry-section entry-section-role-context"/);
  assert.match(additional,/Commander \/ PIC/);
  assert.match(additional,/>Instructor<input/);
  assert.doesNotMatch(additional,/Actual PIC source|Countersignature reference/);
  assert.match(form,/initialRole==="DUAL"\?false:initialRole==="SAFETY PILOT"/);
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

test("F2.2 inline RoleCrew grid reflows for iPad and mobile without changing the existing essentials grid",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.flight-form \.role-crew-inline-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:13px\}/);
  assert.match(css,/@media\(max-width:820px\)\{[\s\S]*?\.flight-form \.role-crew-inline-grid,[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.flight-form \.essential-identity-grid\{grid-template-columns:minmax\(0,\.8fr\) minmax\(0,1\.15fr\) minmax\(0,1\.35fr\)\}/);
});
