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

test("F2.2 puts required RoleCrew identity inline with Role",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/roleCrew=roleCrewSpec\(role,evidence\)/);
  assert.match(form,/roleIdentityInline=role==="DUAL"\|\|role==="SAFETY PILOT"\|\|countersignatureRole/);
  assert.match(form,/data-role-crew-inline="true"/);
  assert.match(form,/dualInstructorRequired=roleCrew\?\.instructor==="required_save"/);
  assert.match(form,/countersignatureRequired=roleCrew\?\.verificationName==="required_save"/);
});

test("F2.2 keeps required crew evidence in Flight essentials and optional crew separate",()=>{
  const form=read("components/flight-form.tsx");
  const essentialsStart=form.indexOf('entry-section entry-section-primary');
  const routeStart=form.indexOf('essential-route-group',essentialsStart);
  const inline=form.slice(essentialsStart,routeStart);
  for(const token of ["Instructor / PIC","Actual PIC source","connectedPicUserId","verificationName","verificationReference"]){
    assert.ok(inline.includes(token),token);
  }
  const crewStart=form.indexOf('entry-section entry-section-role-context');
  const logbookStart=form.indexOf('Aircraft & logbook',crewStart);
  const optionalCrew=form.slice(crewStart,logbookStart);
  assert.match(optionalCrew,/<summary><span>Crew details<\/span>/);
  assert.doesNotMatch(optionalCrew,/Countersignature reference|Actual PIC source/);
  assert.doesNotMatch(optionalCrew,/FlightPurposePicker|Task \/ exercise/);
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
  assert.match(read("lib/flight-draft-candidate.ts"),/purposeSelectionPresent:form\.has\("purposeSelectionPresent"\)\|\|form\.has\("purposeCode"\)/);
  assert.match(read("lib/flight-input.ts"),/hasPurposeField=candidate\.purposeSelectionPresent/);
});

test("B3 stays presentation-only around parser certification and collaboration boundaries",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.doesNotMatch(form,/materialize|certificationFingerprint|flight_participations/);
  assert.match(read("lib/fcl050-compliance.ts"),/role==="DUAL"&&!text\(row\.instructor\)/);
  assert.match(read("lib/flight-input.ts"),/roleCrewSaveError\(crewSpec,\{instructor,verificationName,verificationReference\}\)/);
  assert.match(read("lib/role-crew.ts"),/verificationName=easa\?"required_save":"optional"/);
  assert.match(read("lib/role-crew.ts"),/verificationReference=easa\?"required_save":"optional"/);
});
