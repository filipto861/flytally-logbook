import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.53.1 registration changes refresh aircraft state without changing the flight role",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,53,1));
  const form=read("components/flight-form.tsx");
  const start=form.indexOf("const pickAircraft=");
  const end=form.indexOf("const blockMinutes=",start);
  assert.ok(start>=0&&end>start);
  const pick=form.slice(start,end);
  assert.match(pick,/setType\(a[.]aircraft_type\|\|""\)/);
  assert.match(pick,/setClass\(nextClass\)/);
  assert.match(pick,/setEngineType\(defaultEngineType\(nextClass\)\)/);
  assert.match(pick,/setOperationType\("SP"\)/);
  assert.match(pick,/setEvidence\(nextEvidence\)/);
  assert.match(pick,/setBilling\(nextBilling[.]basis\)/);
  assert.match(pick,/setBillingShare\(nextBilling[.]share\)/);
  assert.match(pick,/setHourlyRate\(Number\(a[.]price_per_hour\)\|\|0\)/);
  assert.doesNotMatch(pick,/setRole\(/);
  assert.doesNotMatch(pick,/nextRole/);
});

test("v1.53.1 known aircraft type cannot be independently mixed with another profile",()=>{
  const form=read("components/flight-form.tsx");
  const fieldStart=form.indexOf('<label>Aircraft type<input name="aircraftType"');
  const fieldEnd=form.indexOf('</label>',fieldStart);
  assert.ok(fieldStart>=0&&fieldEnd>fieldStart);
  const aircraftTypeField=form.slice(fieldStart,fieldEnd);
  assert.match(aircraftTypeField,/readOnly=\{Boolean\(selected\)\}/);
  assert.match(aircraftTypeField,/From the selected aircraft profile/);
  assert.match(aircraftTypeField,/No active aircraft profile is available/);
});

test("v1.53.1 keeps regulatory parsing and certification boundaries unchanged",()=>{
  const input=read("lib/flight-input.ts"),cert=read("lib/certification-integrity.ts");
  assert.match(input,/movementEvidenceRecorded/);
  assert.match(input,/allocatedFunctionTimes/);
  assert.match(cert,/flightCertificationHash/);
});


test("v1.53.1 keeps required EASA aircraft identity out of the optional settings drawer",()=>{
  const quick=read("components/quick-aircraft-form.tsx"),manager=read("components/aircraft-manager.tsx"),picker=read("components/aircraft-type-picker.tsx"),actions=read("app/(protected)/database/actions.ts");
  const quickPicker=quick.indexOf('<AircraftTypePicker'),quickDrawer=quick.indexOf('<details className="quick-aircraft-advanced');
  const managerPicker=manager.indexOf('<AircraftTypePicker'),managerDrawer=manager.indexOf('<details className="aircraft-advanced-fields');
  assert.ok(quickPicker>=0&&quickDrawer>quickPicker);
  assert.ok(managerPicker>=0&&managerDrawer>managerPicker);
  assert.match(quick,/AircraftTypePicker[^\n]*requireMake=\{logbook==="EASA"\}[^\n]*requireModel/);
  assert.match(manager,/AircraftTypePicker[^\n]*requireMake=\{logbook==="EASA"\}[^\n]*requireModel/);
  assert.match(picker,/name="aircraft_make"/);
  assert.match(picker,/required=\{requireMake\}/);
  assert.match(picker,/name="aircraft_model"/);
  assert.match(picker,/required=\{requireModel\}/);
  assert.match(actions,/evidence==="EASA"&&\(!make\|\|!model\)/);
  assert.match(actions,/evidence==="ULL"\?"ULL":requestedClass/);
});
