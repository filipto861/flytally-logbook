import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const actions=read("app/(protected)/flights/actions.ts");
const gps=read("components/kml-import-form.tsx");
const aircraftData=read("lib/data/aircraft.ts");

const sliceAction=(name:string,next:string)=>{
  const start=actions.indexOf(name);
  const end=actions.indexOf(next,start+name.length);
  return actions.slice(start,end>start?end:actions.length);
};
const create=sliceAction("export async function createFlight","export async function importKmlFlight");
const gpsAction=sliceAction("export async function importKmlFlight","export async function updateFlight");
const update=actions.slice(actions.indexOf("export async function updateFlight"));

test("F3.3 Manual create requires an owned valid profile and rejects stale submitted context",()=>{
  assert.match(create,/resolveProfileAuthorityForSave\(userId,f,false\)/);
  assert.match(actions,/loadAircraftAuthorityProfile\(userId:number,registration:string,activeOnly:boolean\)/);
  assert.match(actions,/allowedFlightContexts\(authorityProfileInput\(row\)\)/);
  assert.match(actions,/isAllowedFlightContext\(submitted,\[item\]\)/);
  assert.match(actions,/Aircraft profile changed\. Reload the flight/);
});

test("F3.3 Manual profile authority intentionally does not require active while GPS still does",()=>{
  const helperStart=actions.indexOf("async function loadAircraftAuthorityProfile");
  const helperEnd=actions.indexOf("async function resolveProfileAuthorityForSave",helperStart);
  const helper=actions.slice(helperStart,helperEnd);
  assert.match(helper,/active=1 LIMIT 1/);
  assert.match(helper,/FROM aircraft WHERE user_id=\$\{userId\} AND UPPER\(TRIM\(registration\)\)=\$\{registration\} LIMIT 1/);
  assert.match(create,/resolveProfileAuthorityForSave\(userId,f,false\)/);
  assert.match(gpsAction,/loadAircraftAuthorityProfile\(userId,registration,true\)/);
});

test("F3.3 same-registration Edit derives SNAPSHOT authority from stored versus final registration",()=>{
  assert.match(update,/resolveFlightAircraftContextAuthority/);
  assert.match(update,/storedRegistration:existing\.registration,submittedRegistration:f\.registration/);
  assert.match(update,/isUnchangedSnapshotSubmission\(storedContext,submittedContext\)/);
  assert.match(update,/contextToPersist=storedContext/);
  assert.match(update,/validateSnapshotAircraftContextCorrection/);
  assert.match(update,/Aircraft type is part of the stored flight identity/);
});

test("F3.3 update persistence uses the resolved authority context instead of blindly writing parsed context",()=>{
  assert.match(update,/evidence=\$\{String\(contextToPersist\.evidence/);
  assert.match(update,/aircraft_type=\$\{String\(contextToPersist\.aircraftType/);
  assert.match(update,/aircraft_class=\$\{String\(contextToPersist\.aircraftClass/);
  assert.match(update,/regulatory_category=\$\{String\(contextToPersist\.regulatoryCategory/);
  assert.match(update,/balloon_class=\$\{String\(contextToPersist\.balloonClass/);
  assert.match(update,/balloon_group=\$\{String\(contextToPersist\.balloonGroup/);
});

test("F3.3 GPS uses one common allowed regulatory context for the whole import session",()=>{
  assert.match(gps,/contextChoices=profileResolution\?\.contexts\|\|\[\]/);
  assert.match(gps,/name="regulatoryCategory"/);
  assert.match(gps,/Applies to every flight in this import/);
  assert.match(gpsAction,/profileResult\.contexts\.find\(context=>isAllowedFlightContext/);
  assert.match(gpsAction,/resolvedProfile=\{\.\.\.profileResult\.profile,regulatoryCategory:selectedContext\.regulatoryCategory\}/);
  assert.match(gpsAction,/profile:resolvedProfile/);
});

test("F3.3 GPS and Manual profile authority receive Part-FCL credit provenance",()=>{
  for(const field of ["part_fcl_credit_class","part_fcl_credit_basis","part_fcl_credit_from"]){
    assert.match(aircraftData,new RegExp(field));
    assert.match(actions,new RegExp(field));
    assert.match(gps,new RegExp(field));
  }
});

test("F3.3 does not broaden GPS Role/Crew beyond PIC",()=>{
  assert.match(gps,/name="role" defaultValue="PIC"><option>PIC<\/option><\/select>/);
  assert.match(gpsAction,/validateGpsImportRole\(form\.get\("role"\)\)/);
  assert.doesNotMatch(gps,/<option>DUAL<\/option>/);
  assert.doesNotMatch(gps,/<option>SAFETY PILOT<\/option>/);
});
