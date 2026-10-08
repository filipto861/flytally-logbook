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

test("v3.3 U10 baseline stays valid while 3.4 removes fake wizard progress from both entry paths",()=>{
  const form=read("components/flight-form.tsx");
  const importer=read("components/kml-import-form.tsx");
  assert.doesNotMatch(form,/aria-label="Manual flight entry progress"/);
  assert.doesNotMatch(importer,/aria-label="GPS import progress"/);
  assert.doesNotMatch(importer,/className="entry-progress"/);
});

test("v3.3 U10 collapses routine experience while keeping required category evidence visible",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/experienceRequiredOpen=!entryProfile\.selected\|\|entryProfile\.showSailplaneExperience\|\|balloonFlight/);
  assert.match(form,/open=\{experienceRequiredOpen\|\|experienceOpen\}/);
  assert.match(form,/className="entry-section entry-section-experience"/);
  assert.match(form,/experienceSummary/);
  assert.match(form,/PF \$\{movementRecorded\?"Yes":"No"\}/);
  assert.match(form,/entry-summary-action">Change/);
});

test("v3.3 U10 makes source choice and save readiness compact and explicit",()=>{
  const workspace=read("components/flight-entry-workspace.tsx"),form=read("components/flight-form.tsx"),css=read("app/ui-system.css");
  assert.match(workspace,/Import GPS track/);
  assert.doesNotMatch(workspace,/>01<|>02</);
  assert.match(form,/className="entry-save-state"/);
  assert.match(form,/Save draft keeps the record editable/);
  assert.match(css,/workflow simplicity: keep New flight focused on the common path/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
  assert.doesNotMatch(form,/Save and add another|Review before save|Ready to save/);
});


test("3.6.0 P1.3 derives new Manual flight date from strict server user-calendar authority",()=>{
  const page=read("app/(protected)/flights/new/page.tsx");
  const data=read("lib/data/flights.ts");
  const form=read("components/flight-form.tsx");
  const start=data.indexOf("export async function getManualEntryDefaults");
  const end=data.indexOf("export async function getFlightNavigation",start);
  const defaults=data.slice(start,end);

  assert.match(page,/getUserSaveableCalendarDefault/);
  assert.match(page,/calendarDefault/);
  assert.match(page,/calendarDefault=\{calendarDefault\}/);

  assert.doesNotMatch(defaults,/Europe\/Prague/);
  assert.doesNotMatch(defaults,/Intl\.DateTimeFormat|new Date\(/);
  assert.doesNotMatch(defaults,/date:/);

  assert.match(form,/calendarDefault\?:SaveableCalendarDefault/);
  assert.match(form,/resolvedCalendarDate=!editing&&calendarDefault\?\.status==="resolved"\?calendarDefault\.date:""/);
  assert.match(form,/initialDate=editing\?field\("date"\):field\("date",resolvedCalendarDate\)/);
  assert.doesNotMatch(form,/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
  assert.match(form,/Needs configuration for automatic date/);
  assert.match(form,/Automatic date is temporarily unavailable/);
});

test("3.6.0 P1.3 keeps Manual flight UTC timeline semantics unchanged",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const certification=read("lib/fcl050-compliance.ts");

  assert.match(form,/<strong>Times<\/strong><small>UTC<\/small>/);
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(certification,/Departure time must be recorded in UTC/);
  assert.match(certification,/Arrival time must be recorded in UTC/);
});
