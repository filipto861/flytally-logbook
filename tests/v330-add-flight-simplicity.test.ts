import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.3 U10 prefills the common manual-entry continuation path",()=>{
  const data=read("lib/data/flights.ts");
  assert.match(data,/ORDER BY f\.id DESC LIMIT 1/);
  assert.match(data,/a\.active=1/);
  assert.match(data,/registration_default_source:registration\?"last-flight":""/);
  assert.match(data,/departure_default_source:departure\?"previous-arrival":""/);
});

test("v3.3 U10 removes fake wizard progress from manual entry",()=>{
  const form=read("components/flight-form.tsx");
  const importer=read("components/kml-import-form.tsx");
  assert.doesNotMatch(form,/aria-label="Manual flight entry progress"/);
  assert.match(importer,/aria-label="GPS import progress"/);
  assert.match(form,/Last used aircraft selected/);
  assert.match(form,/Continued from your previous arrival/);
});

test("v3.3 U10 collapses routine experience while keeping required category evidence visible",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/experienceRequiredOpen=!entryProfile\.selected\|\|entryProfile\.showSailplaneExperience\|\|balloonFlight/);
  assert.match(form,/open=\{experienceRequiredOpen\|\|experienceOpen\}/);
  assert.match(form,/className="entry-section entry-section-experience"/);
  assert.match(form,/experienceSummary/);
});

test("v3.3 U10 makes source choice and save readiness compact and explicit",()=>{
  const workspace=read("components/flight-entry-workspace.tsx"),form=read("components/flight-form.tsx"),css=read("app/ui-system.css");
  assert.match(workspace,/GPS import/);
  assert.doesNotMatch(workspace,/>01<|>02</);
  assert.match(form,/className="entry-save-state"/);
  assert.match(form,/Creates an editable draft for final review/);
  assert.match(css,/workflow simplicity: keep New flight focused on the common path/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto auto/);
});
