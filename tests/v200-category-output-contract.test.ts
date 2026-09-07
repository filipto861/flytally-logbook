import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { LOGBOOK_OUTPUT_CATEGORIES,normalizeLogbookOutputCategory } from "../lib/logbook-print.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-E1 exposes a stable output category vocabulary",()=>{
  assert.deepEqual(LOGBOOK_OUTPUT_CATEGORIES.map(item=>item.value),["all","AEROPLANE","ULL","SAILPLANE","HELICOPTER","BALLOON","OTHER"]);
  assert.equal(normalizeLogbookOutputCategory("sailplane"),"SAILPLANE");
  assert.equal(normalizeLogbookOutputCategory("balloon"),"BALLOON");
  assert.equal(normalizeLogbookOutputCategory("unknown"),"all");
  assert.equal(normalizeLogbookOutputCategory(null),"all");
});

test("v2.0-E2 Print and data export share the regulatory category scope",()=>{
  const hub=read("components/data-hub.tsx");
  assert.match(hub,/LOGBOOK_OUTPUT_CATEGORIES/);
  assert.equal((hub.match(/name="category"/g)||[]).length,2);
  assert.match(hub,/action="\/print"/);
  assert.match(hub,/action="\/api\/export"/);
  assert.match(hub,/legacy records use the same conservative resolver as Flights and Statistics/);
  assert.match(hub,/FSTD is included only when no regulatory-category filter is active/);
  assert.match(hub,/not authority-issued forms/);
});

test("v2.0-E1 export carries category-specific evidence and category-aware logged time",()=>{
  const route=read("app/api/export/route.ts");
  for(const field of ["regulatory_category","logged_time","launch_method","launches","takeoffs_day","takeoffs_night","balloon_class","balloon_group","balloon_operation"])assert.match(route,new RegExp(field));
  assert.match(route,/regulatory_category IN \('SAILPLANE','BALLOON'\).*air_minutes>0.*air_minutes.*block_minutes/s);
  assert.match(route,/AND \(\$\{category\}='all' OR regulatory_category=\$\{category\}\)/);
  assert.match(route,/logbookScopeIncludesFstd\(scope\)&&category==="all"/);
  assert.match(route,/metric:"Logged time"/);
  assert.match(route,/metric:"BLOCK"/);
  assert.match(route,/metric:"AIR"/);
  assert.match(route,/worksheet\("Categories"/);
});

test("v2.0-E1 keeps the conservative legacy TMG and category resolver contract",()=>{
  const route=read("app/api/export/route.ts");
  assert.match(route,/aircraft_class.*GLIDER.*SAILPLANE/s);
  assert.match(route,/aircraft_class.*HELICOPTER.*HELICOPTER/s);
  assert.match(route,/aircraft_class.*BALLOON.*BALLOON/s);
  assert.match(route,/aircraft_class.*TMG.*AEROPLANE/s);
  assert.match(route,/aircraft_class.*ULL.*evidence.*ULL.*ULL/s);
});
