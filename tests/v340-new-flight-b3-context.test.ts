import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B3 aircraft and logbook summary exposes real profile values and origin",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/profileSummary=profileNeedsConfiguration\?"Needs configuration":\[/);
  assert.match(form,/evidence\|\|"Select logbook"/);
  assert.match(form,/regulatoryCategory&&regulatoryCategory!==evidence\?regulatoryCategory:""/);
  assert.match(form,/aircraftClass&&aircraftClass!==regulatoryCategory\?aircraftClass:""/);
  assert.match(form,/entryProfile\.showOperationEngineControls\?\`\$\{operationType\} · \$\{engineType\}\`:""/);
  assert.match(form,/selected&&!editing\?\`from \$\{registration\}\`:""/);
  assert.match(form,/className=\{profileNeedsConfiguration\?"field-message-error":"profile-summary"\}/);
});

test("B3 unresolved aircraft profile keeps Aircraft and logbook expanded",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/if\(registration&&\(!evidence\|\|!aircraftClass\|\|profileNeedsConfiguration\)\)setLogbookOpen\(true\)/);
  assert.match(form,/open=\{logbookOpen\}/);
  assert.match(form,/Needs configuration/);
});

test("B3 role-driven context auto-opens only for required role evidence",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/roleContextRequired=role==="DUAL"\|\|role==="SAFETY PILOT"\|\|countersignatureRequired/);
  assert.match(form,/open=\{roleContextRequired\|\|crewOpen\}/);
  assert.match(form,/<summary><span>Role details<\/span><small>\{roleContextSummary\}<\/small><\/summary>/);
  assert.match(form,/role==="DUAL"\?"Instructor \/ PIC required"/);
  assert.match(form,/role==="SAFETY PILOT"\?\`Actual PIC/);
  assert.match(form,/countersignatureRequired\?\`\$\{role\} · supervision \+ countersignature required\`/);
});

test("B3 keeps required crew evidence in Role details",()=>{
  const form=read("components/flight-form.tsx");
  const start=form.indexOf('entry-section entry-section-role-context');
  const end=form.indexOf('Aircraft & logbook',start);
  const roleBlock=form.slice(start,end);
  for(const token of ["Instructor / PIC","Actual PIC source","connectedPicUserId","verificationName","verificationReference"]){
    assert.ok(roleBlock.includes(token),token);
  }
  assert.doesNotMatch(roleBlock,/FlightPurposePicker|Task \/ exercise/);
});

test("B3 moves training purpose and task to Optional details without changing purpose submission semantics",()=>{
  const form=read("components/flight-form.tsx");
  const picker=read("components/flight-purpose-picker.tsx");
  const start=form.indexOf('entry-section entry-section-optional');
  const end=form.indexOf('<ProfessionalContextFields',start);
  const optional=form.slice(start,end);
  assert.match(optional,/Optional details/);
  assert.match(optional,/FlightPurposePicker value=\{storedPurpose\} regulatoryCategory=\{regulatoryCategory\}/);
  assert.match(optional,/name="task" defaultValue=\{storedTask\}/);
  assert.match(picker,/name="purposeSelectionPresent" value="yes"/);
  assert.match(picker,/name="purposeCode"/);
  assert.match(read("lib/flight-draft-candidate.ts"),/purposeSelectionPresent:form\.has\("purposeSelectionPresent"\)\|\|form\.has\("purposeCode"\)/);\n  assert.match(read("lib/flight-input.ts"),/hasPurposeField=candidate\.purposeSelectionPresent/);
});

test("B3 stays presentation-only around parser certification and collaboration boundaries",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.doesNotMatch(form,/materialize|certificationFingerprint|flight_participations/);
  assert.match(read("lib/fcl050-compliance.ts"),/role==="DUAL"&&!text\(row\.instructor\)/);
  assert.match(read("lib/flight-input.ts"),/\["SPIC","PICUS"\]\.includes\(role\).*verificationName.*verificationReference/);
});
