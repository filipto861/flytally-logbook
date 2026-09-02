import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { rankAircraftTypes,type AircraftTypeCatalogEntry } from "../lib/aircraft-type-search.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const catalog=JSON.parse(read("data/aircraft-type-catalog.json")) as AircraftTypeCatalogEntry[];

test("v1.54.3 ships a broad structured FAA aircraft catalogue",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,54,3));
  assert.ok(catalog.length>4000,`catalogue unexpectedly small: ${catalog.length}`);
  for(const expected of [
    {icao:"BR23",make:"BRM AERO",model:"Bristell B23"},
    {icao:"P208",make:"TECNAM",model:"P-2008"},
    {icao:"WT9",make:"AEROSPOOL",model:"WT-9 Dynamic"},
  ])assert.ok(catalog.some(item=>item.icao===expected.icao&&item.make===expected.make&&item.model===expected.model),`missing ${expected.icao}`);
  const source=read("data/AIRCRAFT_TYPES_SOURCE.md");
  assert.match(source,/FAA Order JO 7360[.]1K/);
  assert.match(source,/manual Make\/Model\/ICAO entry/i);
});

test("v1.54.3 search ranks ICAO, model and manufacturer queries",()=>{
  assert.equal(rankAircraftTypes(catalog,"BR23",5)[0]?.icao,"BR23");
  assert.ok(rankAircraftTypes(catalog,"Bristell B23",8).some(item=>item.icao==="BR23"&&item.make==="BRM AERO"));
  assert.ok(rankAircraftTypes(catalog,"Aerospool Dynamic",12).some(item=>item.icao==="WT9"));
  assert.ok(rankAircraftTypes(catalog,"P-2008",8).some(item=>item.icao==="P208"));
});

test("v1.54.3 aircraft picker keeps catalogue optional and Part-FCL class separate",()=>{
  const picker=read("components/aircraft-type-picker.tsx"),quick=read("components/quick-aircraft-form.tsx"),manager=read("components/aircraft-manager.tsx");
  assert.match(picker,/Search by manufacturer, model or ICAO designator/);
  assert.match(picker,/Can’t find the aircraft[?] Just enter it manually/);
  assert.match(picker,/Confirm the Part-FCL class separately/);
  assert.doesNotMatch(picker,/name="aircraft_class"/);
  assert.match(quick,/AircraftTypePicker/);
  assert.match(manager,/AircraftTypePicker/);
  assert.match(quick,/Catalogue hints are informational only/);
  assert.match(manager,/Catalogue hints are informational only/);
});

test("v1.54.3 preserves EASA aircraft identity validation and v1.53.1 flight state integrity",()=>{
  const actions=read("app/(protected)/database/actions.ts"),flight=read("components/flight-form.tsx");
  assert.match(actions,/evidence==="EASA"&&\(!make\|\|!model\)/);
  assert.match(actions,/normalizeAircraftProfileContext/);
  assert.match(actions,/if\(!normalized[.]context\)return/);
  assert.match(flight,/readOnly=\{Boolean\(selected\)\}/);
  const start=flight.indexOf("const pickAircraft="),end=flight.indexOf("const blockMinutes=",start),pick=flight.slice(start,end);
  assert.match(pick,/setOperationType\("SP"\)/);
  assert.doesNotMatch(pick,/setRole\(/);
});
