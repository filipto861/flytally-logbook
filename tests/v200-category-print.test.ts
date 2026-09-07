import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { categoryPrintLoggedMinutes,categoryPrintTotals,partitionCategoryPrintRecords,selectCategoryPrintRecords } from "../lib/category-print.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-E2 print partition preserves conservative legacy category semantics",()=>{
  const rows=[
    {registration:"LEGACY-TMG",regulatory_category:"",aircraft_class:"TMG",evidence:"EASA",block_minutes:60,air_minutes:45,role:"PIC"},
    {registration:"SFCL-TMG",regulatory_category:"SAILPLANE",aircraft_class:"TMG",evidence:"EASA",block_minutes:60,air_minutes:45,role:"PIC"},
    {registration:"GLIDER",regulatory_category:"",aircraft_class:"GLIDER",evidence:"EASA",block_minutes:70,air_minutes:40,role:"PIC"},
    {registration:"BALLOON",regulatory_category:"BALLOON",aircraft_class:"BALLOON",evidence:"EASA",block_minutes:80,air_minutes:55,role:"PIC"},
    {registration:"ULL",regulatory_category:"",aircraft_class:"ULL",evidence:"ULL",block_minutes:50,air_minutes:42,role:"PIC"},
    {registration:"OTHER",regulatory_category:"",aircraft_class:"UNKNOWN",evidence:"OTHER",block_minutes:30,air_minutes:20,role:"PIC"},
  ];
  const selected=selectCategoryPrintRecords(rows,"all"),parts=partitionCategoryPrintRecords(selected);
  assert.deepEqual(parts.fcl.map(row=>row.registration),["LEGACY-TMG","ULL"]);
  assert.deepEqual(parts.sailplane.map(row=>row.registration),["SFCL-TMG","GLIDER"]);
  assert.deepEqual(parts.balloon.map(row=>row.registration),["BALLOON"]);
  assert.deepEqual(parts.other.map(row=>row.registration),["OTHER"]);
  assert.deepEqual(selectCategoryPrintRecords(rows,"SAILPLANE").map(row=>row.registration),["SFCL-TMG","GLIDER"]);
});

test("v2.0-E2 neutral print totals use AIR for SFCL/BFCL and exclude auxiliary credit",()=>{
  const sail={regulatory_category:"SAILPLANE",aircraft_class:"GLIDER",block_minutes:80,air_minutes:40,launches:1,landings_day:1,role:"PIC",pic_minutes:40,dual_minutes:0,instructor_minutes:0};
  const balloon={regulatory_category:"BALLOON",aircraft_class:"BALLOON",block_minutes:90,air_minutes:60,takeoffs_day:1,landings_day:1,role:"DUAL",pic_minutes:0,dual_minutes:60,instructor_minutes:0};
  const pax={regulatory_category:"SAILPLANE",aircraft_class:"GLIDER",block_minutes:60,air_minutes:50,launches:1,landings_day:1,role:"PAX",pic_minutes:50,dual_minutes:0,instructor_minutes:0};
  assert.equal(categoryPrintLoggedMinutes(sail),40);
  assert.equal(categoryPrintLoggedMinutes(balloon),60);
  assert.equal(categoryPrintLoggedMinutes(pax),0);
  assert.deepEqual(categoryPrintTotals([sail,balloon,pax]),{flights:3,minutes:100,picMinutes:40,dualMinutes:60,instructorMinutes:0,movements:2,landings:2});
});

test("v2.0-E2 printable page keeps FCL.050 only for powered context and exposes neutral category sections",()=>{
  const page=read("app/(protected)/print/page.tsx"),hub=read("components/data-hub.tsx");
  assert.match(page,/resolveCategoryPrintRecord|selectCategoryPrintRecords/);
  assert.match(page,/partitionCategoryPrintRecords/);
  assert.match(page,/Sailplane logbook records/);
  assert.match(page,/Balloon logbook records/);
  assert.match(page,/Other aircraft records/);
  assert.match(page,/not an authority-issued form/i);
  assert.match(page,/FCL\.050 electronic record print view/);
  assert.match(page,/category===\"all\"/);
  assert.ok((hub.match(/name="category"/g)||[]).length>=2);
});

test("v2.0-E2 print query projects category evidence before partitioning FCL and neutral pages",()=>{
  const page=read("app/(protected)/print/page.tsx");
  for(const field of ["f.regulatory_category","f.takeoff","f.landing","f.launch_method","f.launches","f.takeoffs_day","f.takeoffs_night","f.balloon_class","f.balloon_group","f.balloon_operation","air_minutes"])assert.match(page,new RegExp(field.replace(".","\\.")));
  assert.match(page,/const selectedFlights=selectCategoryPrintRecords\(rawFlights,category\),partitioned=partitionCategoryPrintRecords\(selectedFlights\)/);
  assert.match(page,/const fclFlights:EasaPrintRecord\[\]=partitioned\.fcl\.map/);
  assert.doesNotMatch(page,/partitioned\.sailplane\.map\(row=>\(\{\.\.\.row,kind:\"flight\"/);
  assert.match(page,/includeFstd=logbookScopeIncludesFstd\(scope\)&&category===\"all\"/);
});

test("v2.0-E2 10k print fixture follows the category evidence projection",()=>{
  const scale=read("tests/integration/postgres-scale-readiness.test.ts");
  for(const field of ["regulatory_category","launch_method","launches","takeoffs_day","takeoffs_night","balloon_class","balloon_group","balloon_operation"])assert.match(scale,new RegExp(field));
  assert.match(scale,/SELECT f\.date,f\.evidence,f\.regulatory_category,f\.registration,f\.aircraft_type/);
});
