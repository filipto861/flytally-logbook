import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-F Dashboard shares the conservative regulatory category resolver",()=>{
  const source=read("lib/data/dashboard.ts");
  assert.match(source,/regulatory_category.*AEROPLANE.*HELICOPTER.*BALLOON.*SAILPLANE.*ULL.*OTHER/s);
  assert.match(source,/aircraft_class.*GLIDER.*SAILPLANE/s);
  assert.match(source,/aircraft_class.*TMG.*AEROPLANE/s);
  assert.match(source,/aircraft_class.*ULL.*evidence.*ULL.*ULL/s);
});

test("v2.0-F Dashboard uses category-aware logged time consistently",()=>{
  const source=read("lib/data/dashboard.ts");
  assert.match(source,/resolved_category IN \('SAILPLANE','BALLOON'\).*air_minutes>0.*air_minutes.*block_minutes/s);
  assert.match(source,/stored_pic_minutes>0.*role IN \('PIC','SOLO','SPIC','PICUS','INSTRUCTOR','EXAMINER'\).*logged_minutes/s);
  assert.match(source,/SUM\(activity_minutes\).*total_minutes/);
  assert.match(source,/SUM\(logged_minutes\).*ull_minutes/);
  assert.match(source,/SUM\(logged_minutes\).*easa_minutes/);
  assert.match(source,/SUM\(activity_minutes\).*month_key/s);
  assert.match(source,/SUM\(logged_minutes\).*top_aircraft/s);
  assert.match(source,/SUM\(activity_minutes\).*year_key/s);
});

test("v2.0-F preserves Dashboard-only Safety Pilot activity and canonical landing fallback",()=>{
  const source=read("lib/data/dashboard.ts"),page=read("app/(protected)/dashboard/page.tsx");
  assert.match(source,/role='SAFETY PILOT' THEN block_minutes ELSE logged_minutes/);
  assert.match(source,/SUM\(block_minutes\) FILTER\(WHERE role='SAFETY PILOT'\).*safety_minutes/);
  assert.match(source,/stored_day_landings\+stored_night_landings>0 THEN stored_day_landings ELSE legacy_starts/);
  assert.match(source,/stored_day_landings\+stored_night_landings>0 THEN stored_day_landings\+stored_night_landings ELSE legacy_starts/);
  assert.match(page,/safety pilot time · dashboard only/);
});
