import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F2.2 derives Manual required cues from the shared RoleCrew contract",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/import \{ roleCrewSpec \} from "@\/lib\/role-crew"/);
  assert.match(form,/roleCrew=roleCrewSpec\(role,evidence\)/);
  assert.match(form,/dualInstructorRequired=roleCrew\?\.instructor==="required_save"/);
  assert.match(form,/countersignatureRequired=roleCrew\?\.verificationName==="required_save"/);
  assert.match(form,/required=\{dualInstructorRequired\}/);
  assert.match(form,/required=\{countersignatureRequired\}/);
  assert.match(form,/required=\{roleCrew\?\.commander==="external_resolver"\}/);
});

test("F2.2 places role-defining identity immediately after Role and before Route",()=>{
  const form=read("components/flight-form.tsx");
  const role=form.indexOf('name="role"');
  const inline=form.indexOf('data-role-crew-inline="true"',role);
  const route=form.indexOf('essential-route-group',role);
  assert.ok(role>=0&&inline>role&&route>inline);
  const block=form.slice(inline,route);
  for(const token of ["Instructor / PIC","Actual PIC source","Supervising PIC / FI","Countersignature reference"])assert.ok(block.includes(token),token);
});

test("F2.2 completion blockers include all server-required RoleCrew evidence",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/dualInstructorMissing=dualInstructorRequired&&!dualInstructor\.trim\(\)/);
  assert.match(form,/verificationNameMissing=countersignatureRequired&&!verificationName\.trim\(\)/);
  assert.match(form,/verificationReferenceMissing=countersignatureRequired&&!verificationReference\.trim\(\)/);
  assert.match(form,/dualInstructorMissing&&"instructor"/);
  assert.match(form,/safetyPicMissing&&"actualPic"/);
  assert.match(form,/verificationNameMissing&&"verificationName"/);
  assert.match(form,/verificationReferenceMissing&&"verificationReference"/);
  for(const selector of ['instructor:\'[name="instructor"]\'','verificationName:\'[name="verificationName"]\'','verificationReference:\'[name="verificationReference"]\''])assert.ok(form.includes(selector),selector);
});

test("F2.2 keeps only genuinely optional crew fields in the disclosure",()=>{
  const form=read("components/flight-form.tsx");
  assert.doesNotMatch(form,/roleContextRequired/);
  assert.doesNotMatch(form,/<summary><span>Role details<\/span>/);
  const start=form.indexOf('entry-section entry-section-role-context');
  const end=form.indexOf('Aircraft & logbook',start);
  assert.ok(start>=0&&end>start);
  const crew=form.slice(start,end);
  assert.match(crew,/<summary><span>Crew details<\/span>/);
  assert.match(crew,/Commander \/ PIC/);
  assert.match(crew,/>Instructor</);
  assert.doesNotMatch(crew,/Actual PIC source|Supervising PIC \/ FI|Countersignature reference/);
});

test("F2.2 preserves local required-role input state across role switches without claiming account identity",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/\[dualInstructor,setDualInstructor\]=useState\(field\("instructor"\)\)/);
  assert.match(form,/\[verificationName,setVerificationName\]=useState\(field\("verification_name"\)\)/);
  assert.match(form,/\[verificationReference,setVerificationReference\]=useState\(field\("verification_reference"\)\)/);
  assert.match(form,/Manual text remains historical evidence and is not linked to a FlyTally account\./);
  assert.doesNotMatch(form,/receives the review\/sign request after certification/);
});
