import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.3 U10 keeps a new manual entry neutral until the user selects aircraft and route",()=>{
  const data=read("lib/data/flights.ts"),form=read("components/flight-form.tsx");
  const start=data.indexOf("export async function getManualEntryDefaults");
  const end=data.indexOf("export async function getFlightNavigation",start);
  const block=data.slice(start,end);
  assert.match(block,/registration:""/);
  assert.match(block,/departure:""/);
  assert.match(block,/arrival:""/);
  assert.doesNotMatch(block,/lastFlights|previous-arrival|last-flight/);
  assert.doesNotMatch(form,/Last used aircraft selected|Continued from your previous arrival/);
});

test("v3.3 U10 removes fake wizard progress from manual entry",()=>{
  const form=read("components/flight-form.tsx");
  const importer=read("components/kml-import-form.tsx");
  assert.doesNotMatch(form,/aria-label="Manual flight entry progress"/);
  assert.match(importer,/aria-label="GPS import progress"/);
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
  assert.match(workspace,/Import GPS track/);
  assert.doesNotMatch(workspace,/>01<|>02</);
  assert.match(form,/className="entry-save-state"/);
  assert.match(form,/Creates an editable draft for final review/);
  assert.match(css,/workflow simplicity: keep New flight focused on the common path/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto auto/);
});
