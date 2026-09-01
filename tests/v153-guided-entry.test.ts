import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.53 makes normal manual entry the default while keeping GPS explicit",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,53,0));
  const page=read("app/(protected)/flights/new/page.tsx"),workspace=read("components/flight-entry-workspace.tsx");
  assert.match(page,/params\.mode==="gps"\?"gps":"manual"/);
  assert.match(workspace,/initialMode="manual"/);
  assert.ok(workspace.indexOf("Manual entry")<workspace.indexOf("Import GPS track"));
  assert.match(page,/saved-next-flight/);
  assert.match(page,/Flight saved\./);
});

test("v1.53 guides an empty account to a minimal first-aircraft flow",()=>{
  const page=read("app/(protected)/flights/new/page.tsx"),workspace=read("components/flight-entry-workspace.tsx"),quick=read("components/quick-aircraft-form.tsx"),picker=read("components/aircraft-type-picker.tsx");
  assert.match(page,/aircraftCount=\{aircraft\.length\}/);
  assert.match(page,/aircraftAction=\{saveAircraftWithResult\}/);
  assert.doesNotMatch(page,/aircraftForm=<form/);
  assert.match(workspace,/Start by adding the aircraft you fly/);
  assert.match(workspace,/Add first aircraft/);
  assert.match(workspace,/QuickAircraftForm/);
  assert.match(quick,/name="registration"/);
  assert.match(quick,/AircraftTypePicker/);
  assert.match(picker,/name="aircraft_model"/);
  assert.match(picker,/name="aircraft_make"/);
  assert.match(quick,/name="evidence"/);
  assert.match(quick,/logbook==="EASA"/);
  assert.match(quick,/type="hidden" name="aircraft_class" value="ULL"/);
  assert.match(quick,/More aircraft settings/);
});

test("v1.53 keeps full aircraft profiles approachable through progressive disclosure",()=>{
  const aircraft=read("components/aircraft-manager.tsx"),picker=read("components/aircraft-type-picker.tsx");
  assert.match(aircraft,/Normal logbook/);
  assert.match(aircraft,/More aircraft settings/);
  assert.match(aircraft,/open=\{!aircraft\.length\}/);
  assert.match(aircraft,/Add your first aircraft/);
  assert.match(aircraft,/Search the aircraft catalogue first; pricing and technical defaults can be added later/);
  const pickerAt=aircraft.indexOf('<AircraftTypePicker'),advancedAt=aircraft.indexOf('<details className="aircraft-advanced-fields');
  assert.ok(pickerAt>=0&&advancedAt>pickerAt);
  assert.match(aircraft,/AircraftTypePicker[^\n]*requireMake=\{logbook==="EASA"\}[^\n]*requireModel/);
  assert.match(picker,/required=\{requireMake\}/);
  assert.match(picker,/required=\{requireModel\}/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_class"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_basis"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_from"/);
  assert.doesNotMatch(aircraft,/>Part-FCL credit override</);
});

test("v1.53 makes everyday role choices readable without changing stored role codes",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/PIC — Pilot in command/);
  assert.match(form,/DUAL — Training with instructor/);
  assert.match(form,/INSTRUCTOR — Giving instruction/);
  assert.match(form,/value=\{x\}>\{roleOptionLabel\(x\)\}/);
  assert.match(form,/a\.registration\}\{a\.aircraft_type\?` · \$\{a\.aircraft_type\}`/);
  assert.match(form,/I was pilot flying \(PF\) for the recorded take-offs, approaches and landings/);
  assert.match(form,/Adjust movement counts/);
  assert.match(form,/Save and add another/);
});

test("v1.53 has one final UX layer and documents a behavior-preserving scope",()=>{
  const layout=read("app/layout.tsx"),roadmap=read("ROADMAP.md"),css=read("app/v153-everyday-ux.css");
  assert.match(layout,/v153-everyday-ux\.css/);
  assert.match(css,/\.first-aircraft-callout/);
  assert.match(css,/\.aircraft-advanced-fields/);
  assert.match(roadmap,/## Current development — v1\.53\.0 · Guided everyday entry/);
  assert.match(roadmap,/keep v1\.51 regulatory rules, certification revisions\/hashes, signatures, GPS evidence, ownership, print\/export and backup\/restore behavior unchanged/i);
});
