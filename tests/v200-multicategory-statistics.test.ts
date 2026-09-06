import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-D Statistics exposes persistent regulatory category scope",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/\[\"AEROPLANE\",\"Aeroplane\"\]/);
  assert.match(page,/\[\"ULL\",\"ULL\"\]/);
  assert.match(page,/\[\"SAILPLANE\",\"Sailplane\"\]/);
  assert.match(page,/\[\"HELICOPTER\",\"Helicopter\"\]/);
  assert.match(page,/\[\"BALLOON\",\"Balloon\"\]/);
  assert.match(page,/statisticsHref\(key,section,category\)/);
  assert.match(page,/statisticsHref\(period,key,category\)/);
  assert.match(page,/getPilotInsightsData\(session[.]userId,period,category\)/);
  assert.match(page,/scopedFlightHref/);
});

test("v2.0-D Statistics uses one category-aware summary instead of dashboard totals",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/s=data[.]summary/);
  assert.match(page,/loggedMinutes=s[.]minutes/);
  assert.doesNotMatch(page,/d=data[.]dashboard/);
  assert.match(page,/Sailplane and balloon totals use AIR flight time/);
  assert.match(page,/Regulatory category experience/);
  assert.match(page,/Logged time/);
});

test("v2.0-D analytics SQL resolves legacy category before deriving logged time",()=>{
  const source=read("lib/data/pilot-insights.ts");
  assert.match(source,/resolved_category/);
  assert.match(source,/regulatory_category/);
  assert.match(source,/aircraft_class.*GLIDER.*SAILPLANE/s);
  assert.match(source,/aircraft_class.*TMG.*AEROPLANE/s);
  assert.match(source,/resolved_category IN \('SAILPLANE','BALLOON'\).*air_minutes>0.*air_minutes.*block_minutes/s);
  assert.match(source,/logged_minutes/);
  assert.match(source,/scope_base/);
  assert.match(source,/scopeCategory/);
});

test("v2.0-D secondary analytics use the same logged-time measure",()=>{
  const source=read("lib/data/pilot-insights.ts");
  for(const token of ["categories","registrations","airports","routes"])assert.match(source,new RegExp(token));
  assert.match(source,/SUM\(logged_minutes\)/);
  assert.match(source,/selected_unique_airports/);
  assert.match(source,/selected_unique_routes/);
  assert.match(source,/stored_day_landings\+stored_night_landings/);
});
