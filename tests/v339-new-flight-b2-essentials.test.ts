import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("B2 exposes landing and PF presets in the collapsed experience summary without reconfirmation",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/standardLandingSummary=/);
  assert.match(form,/PF \$\{movementRecorded\?"Yes":"No"\}/);
  assert.match(form,/className="experience-summary"/);
  assert.match(form,/className="entry-summary-action">Change<\/span>/);
  assert.match(form,/\[experienceOpen,setExperienceOpen\]=useState\(editing\)/);
  assert.match(form,/if\(!editing&&!movementTouched\)setMovementRecorded\(autoMovement/);
  assert.match(form,/checked=\{movementRecorded\}/);
});

test("B2 remains presentation-only around canonical parsing and certification",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const certification=read("lib/fcl050-compliance.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(certification,/issue\("off_block","off_block","Departure time must be recorded in UTC\."\)/);
  assert.match(certification,/issue\("on_block","on_block","Arrival time must be recorded in UTC\."\)/);
  assert.doesNotMatch(form,/fcl050FlightCompliance|blockingComplianceIssues/);
});
