import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flightAircraftCategory,flightEntryProfile } from "../lib/flight-entry-profile.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.61 derives aircraft category for presentation without performing persistence",()=>{
  assert.equal(flightAircraftCategory({aircraftClass:"SEP",evidence:"EASA"}),"aeroplane");
  assert.equal(flightAircraftCategory({aircraftClass:"TMG",evidence:"EASA"}),"aeroplane");
  assert.equal(flightAircraftCategory({aircraftClass:"ULL",evidence:"ULL"}),"ull");
  assert.equal(flightAircraftCategory({aircraftClass:"GLIDER",evidence:"EASA"}),"sailplane");
  assert.equal(flightAircraftCategory({aircraftClass:"OTHER",evidence:"EASA"}),"other");
  const model=read("lib/flight-entry-profile.ts");
  assert.doesNotMatch(model,/certified_at|sql`|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
});

test("v1.61 waits for aircraft selection before showing aircraft-dependent experience controls",()=>{
  const blank=flightEntryProfile({hasAircraft:false,aircraftClass:"",evidence:""});
  assert.equal(blank.selected,false);
  assert.equal(blank.showStandardExperience,false);
  const sep=flightEntryProfile({hasAircraft:true,aircraftClass:"SEP",evidence:"EASA"});
  assert.equal(sep.category,"aeroplane");
  assert.equal(sep.showStandardExperience,true);
  assert.equal(sep.showRegulatoryMovements,true);
  const ull=flightEntryProfile({hasAircraft:true,aircraftClass:"ULL",evidence:"ULL"});
  assert.equal(ull.category,"ull");
  assert.equal(ull.showStandardExperience,true);
  assert.equal(ull.showRegulatoryMovements,true);
});

test("v1.61 FlightForm adapts after aircraft selection while Role stays flight-specific",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/flightEntryProfile/);
  assert.match(form,/data-aircraft-category/);
  assert.match(form,/Select an aircraft first/);
  assert.match(form,/entryProfile[.]showStandardExperience/);
  assert.match(form,/entryProfile[.]showRegulatoryMovements/);
  const start=form.indexOf("const pickAircraft=");
  const end=form.indexOf("const blockMinutes=",start);
  const picker=form.slice(start,end);
  assert.match(picker,/setType/);
  assert.match(picker,/setClass/);
  assert.match(picker,/setEvidence/);
  assert.match(picker,/setBilling/);
  assert.doesNotMatch(picker,/setRole/);
});

test("v1.61 category helper remains a pure layer while v1.62 may extend its regulatory vocabulary",()=>{
  assert.match(read("app/layout.tsx"),/v161-category-flight-entry[.]css/);
  const profile=read("lib/flight-entry-profile.ts"),parser=read("lib/flight-input.ts");
  assert.doesNotMatch(profile,/parseFlightInput|FlightCertification|sql`/);
  assert.match(parser,/export function parseFlightInput/);
});
