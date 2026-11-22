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
