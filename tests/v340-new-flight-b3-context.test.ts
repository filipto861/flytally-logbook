import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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
