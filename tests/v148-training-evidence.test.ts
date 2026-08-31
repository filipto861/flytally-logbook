import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { AIRCRAFT_ENDORSEMENTS,parseAircraftEndorsements,serializeAircraftEndorsements } from "../lib/aircraft-endorsements.ts";
import { flightPurposeTask,normalizeFlightPurposeCodes,primaryFlightPurposeCode } from "../lib/flight-purpose.ts";
import { parseFlightInput } from "../lib/flight-input.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const baseForm=()=>{const form=new FormData();for(const[key,value]of Object.entries({date:"2026-08-31",registration:"OK-TEST",evidence:"EASA",aircraftClass:"SEP",role:"DUAL",billingBasis:"BLOCK",offBlock:"10:00",takeoff:"10:05",landing:"11:00",onBlock:"11:05",landingsDay:"1",landingsNight:"0",instructor:"Test Instructor"}))form.set(key,value);return form};

test("v1.48 offers standard aircraft endorsement codes without invented NON codes",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,48,0));
  assert.deepEqual(AIRCRAFT_ENDORSEMENTS.map(item=>item.code),["VP","RU","T","P","TW","EFIS","SLPC"]);
  const section=read("components/aircraft-qualifications-section.tsx"),picker=read("components/aircraft-endorsement-picker.tsx");
  assert.match(section,/AircraftEndorsementPicker/);assert.match(picker,/Other \/ custom/);assert.doesNotMatch(section+picker,/NON-EFIS|NON-SLPC/);
});

test("aircraft endorsements preserve standard codes and custom equipment",()=>{
  const parsed=parseAircraftEndorsements("VP / RU / AP");assert.deepEqual(parsed.codes,["VP","RU"]);assert.equal(parsed.custom,"AP");assert.equal(serializeAircraftEndorsements(parsed.codes,parsed.custom),"VP · RU · AP");
});

test("instructor flight purposes can be combined while retaining one recency marker",()=>{
  const selected=normalizeFlightPurposeCodes(["AIRCRAFT_DIFFERENCES","SEP_TMG_FCL740A_REFRESHER"]);assert.deepEqual(selected,["AIRCRAFT_DIFFERENCES","SEP_TMG_FCL740A_REFRESHER"]);assert.equal(primaryFlightPurposeCode(selected),"SEP_TMG_FCL740A_REFRESHER");assert.equal(flightPurposeTask(selected),"Differences training · FCL.740.A refresher training");
  const form=baseForm();form.set("purposeSelectionPresent","yes");form.append("purposeCode","AIRCRAFT_DIFFERENCES");form.append("purposeCode","SEP_TMG_FCL740A_REFRESHER");form.set("task","Circuits");const parsed=parseFlightInput(form);assert.ok(parsed.data);assert.equal(parsed.data?.purposeCode,"SEP_TMG_FCL740A_REFRESHER");assert.equal(parsed.data?.task,"Differences training · FCL.740.A refresher training · Circuits");
});

test("LAPL refresher remains the primary marker when combined with another purpose",()=>{
  const form=baseForm();form.set("purposeSelectionPresent","yes");form.append("purposeCode","AIRCRAFT_DIFFERENCES");form.append("purposeCode","LAPL_FCL140A_REFRESHER");form.set("task","EFIS conversion");const parsed=parseFlightInput(form);assert.ok(parsed.data);assert.equal(parsed.data?.purposeCode,"LAPL_FCL140A_REFRESHER");assert.match(parsed.data?.task??"",/^Differences training · FCL\.140\.A refresher training · EFIS conversion$/);
});

test("refresher markers require DUAL while differences remain modular with an instructor",()=>{
  const form=baseForm();form.set("role","PIC");form.set("purposeSelectionPresent","yes");form.append("purposeCode","LAPL_FCL140A_REFRESHER");form.append("purposeCode","AIRCRAFT_DIFFERENCES");const parsed=parseFlightInput(form);assert.equal(parsed.data?.purposeCode,"AIRCRAFT_DIFFERENCES");assert.equal(parsed.data?.task,"Differences training");
});

test("v1.48 keeps purposes and endorsements inside existing evidence boundaries",()=>{
  const form=read("components/flight-form.tsx"),schema=read("lib/v148-schema.ts"),runtime=read("lib/runtime-schema.ts"),roadmap=read("ROADMAP.md");
  assert.match(form,/FlightPurposePicker/);assert.match(form,/Task \/ exercise/);assert.match(schema,/trg_flytally_sync_flight_purpose/);assert.match(schema,/SEP_TMG_FCL740A_REFRESHER/);assert.match(runtime,/ensureV148Schema/);assert.match(roadmap,/Current release — v1\.48\.0/);assert.match(roadmap,/never as an automatic rating revalidation/);
});
