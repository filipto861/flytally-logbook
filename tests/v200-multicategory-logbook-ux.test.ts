import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {aircraftCategoryCapabilities} from "../lib/aircraft-category.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0-C keeps explicit and legacy TMG category semantics distinct",()=>{
  assert.equal(aircraftCategoryCapabilities({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}).category,"sailplane");
  assert.equal(aircraftCategoryCapabilities({aircraftClass:"TMG",evidence:"EASA"}).category,"aeroplane");
});

test("v2.0-C Flights exposes category as a first-class persistent filter",()=>{
  const page=read("app/(protected)/flights/page.tsx"),detail=read("app/(protected)/flights/[id]/page.tsx"),core=read("lib/data/flights.ts");
  assert.match(page,/category\?:string/);
  assert.match(page,/aria-label="Logbook category"/);
  assert.match(page,/AEROPLANE","ULL","SAILPLANE","HELICOPTER","BALLOON/);
  assert.match(page,/params[.]q\|\|params[.]category\?href\(\{\}, \{q:params[.]q,category:params[.]category\}\)/);
  assert.match(detail,/category\?:string/);
  assert.match(core,/FlightFilters=\{q\?:string;category\?:string/);
});

test("v2.0-C fast list resolves category without rewriting historical rows",()=>{
  const source=read("lib/data/flights-fast.ts");
  assert.match(source,/resolved_category/);
  assert.match(source,/regulatory_category/);
  assert.match(source,/aircraft_class.*GLIDER/s);
  assert.match(source,/aircraft_class.*TMG.*AEROPLANE/s);
  assert.match(source,/resolved_category=\$\{category\}/);
  assert.match(source,/!v[.]category/);
});

test("v2.0-C uses category-aware logged time in totals and rows",()=>{
  const fast=read("lib/data/flights-fast.ts"),page=read("app/(protected)/flights/page.tsx");
  assert.match(fast,/summary_logged/);
  assert.match(fast,/resolved_category IN \('SAILPLANE','BALLOON'\)/);
  assert.match(page,/Logged time/);
  assert.match(page,/usesAir=category[.]category==="sailplane"\|\|category[.]category==="balloon"/);
  assert.match(page,/loggedMinutes=usesAir\?\(f[.]air_minutes\|\|f[.]block_minutes\):f[.]block_minutes/);
});
