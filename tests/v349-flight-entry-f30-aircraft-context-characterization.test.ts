import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseFlightInput } from "../lib/flight-input.ts";
import { resolveFlightEntryAircraftProfileDefaults,shouldApplyAircraftProfileDefaults } from "../lib/flight-form-rules.ts";
import { validateAircraftProfile } from "../lib/aircraft-profile-validation.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function manualForm(){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-10-02",
    registration:"OK-F30",
    aircraftType:"B23",
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    role:"PIC",
    offBlock:"10:00",
    takeoff:"10:05",
    landing:"10:55",
    onBlock:"11:00",
    starts:"1",
    landingsDay:"1",
    operationType:"SP",
    engineType:"SE",
  }))form.set(key,value);
  return form;
}

test("F3.0 profile resolver fails closed and preserves explicit ULL / multi-context profiles",()=>{
  const ull=resolveFlightEntryAircraftProfileDefaults({evidence:"ULL",aircraft_class:"ULL",regulatory_category:"ULL"});
  assert.equal(ull.error,undefined);
  assert.equal(ull.profile?.regulatoryCategory,"ULL");

  for(const category of ["AEROPLANE","SAILPLANE"]){
    const tmg=validateAircraftProfile({aircraftMake:"A",aircraftModel:"TMG",evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:category});
    assert.equal(tmg.error,undefined,category);
    assert.equal(tmg.profile?.regulatoryCategory,category);
  }

  for(const category of ["AEROPLANE","SAILPLANE","OTHER"]){
    const other=validateAircraftProfile({aircraftMake:"A",aircraftModel:"Other",evidence:"EASA",aircraftClass:"OTHER",regulatoryCategory:category});
    assert.equal(other.error,undefined,category);
    assert.equal(other.profile?.regulatoryCategory,category);
  }

  const invalid=resolveFlightEntryAircraftProfileDefaults({aircraft_make:"",aircraft_model:"B23",evidence:"EASA",aircraft_class:"SEP",regulatory_category:"AEROPLANE"});
  assert.equal(invalid.profile,undefined);
  assert.match(invalid.error??"",/manufacturer/i);
});

test("F3.0 edit authority currently distinguishes stored snapshot from a changed registration",()=>{
  assert.equal(shouldApplyAircraftProfileDefaults(true,"OK-HIST","OK-HIST"),false);
  assert.equal(shouldApplyAircraftProfileDefaults(true,"OK-HIST","OK-NEW"),true);
  assert.equal(shouldApplyAircraftProfileDefaults(false,"","OK-NEW"),true);
});

test("F3.0 Manual parser currently accepts a canonical flight context without consulting an aircraft profile",()=>{
  const parsed=parseFlightInput(manualForm());
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.registration,"OK-F30");
  assert.equal(parsed.data?.evidence,"EASA");
  assert.equal(parsed.data?.aircraftClass,"SEP");
  assert.equal(parsed.data?.regulatoryCategory,"AEROPLANE");
});

test("F3.0 Manual UI still presents aircraft-profile schema as ordinary editable flight fields",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/<summary><span>Aircraft & logbook<\/span>/);
  assert.match(form,/select name="evidence" value=\{evidence\}/);
  assert.match(form,/select name="aircraftClass" value=\{aircraftClass\}/);
  assert.match(form,/aircraftClass==="TMG"&&evidence==="EASA"\?<label>Regulatory context/);
  assert.match(form,/profileSummary=profileNeedsConfiguration\?"Needs configuration"/);
});

test("F3.3 Manual profile authority is server-enforced while the existing client warning remains visible",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const create=actions.slice(actions.indexOf("export async function createFlight"),actions.indexOf("export async function importKmlFlight"));
  const update=actions.slice(actions.indexOf("export async function updateFlight"));

  assert.match(form,/profileNeedsConfiguration=Boolean/);
  assert.match(create,/resolveProfileAuthorityForSave/);
  assert.match(update,/resolveFlightAircraftContextAuthority/);
  assert.match(update,/isUnchangedSnapshotSubmission/);
  assert.match(update,/validateSnapshotAircraftContextCorrection/);
});

test("F3.3 GPS uses the active profile through the shared allowed-context authority",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=read("components/kml-import-form.tsx");
  const start=actions.indexOf("export async function importKmlFlight");
  const end=actions.indexOf("export async function updateFlight",start);
  const importAction=actions.slice(start,end);

  assert.match(importAction,/loadAircraftAuthorityProfile/);
  assert.match(importAction,/resolveGpsImportAircraftContext/);
  assert.match(importAction,/isAllowedFlightContext/);
  assert.match(importAction,/resolvedProfile/);
  assert.match(gps,/contextChoices/);
  assert.match(gps,/name="regulatoryCategory"/);
  assert.match(gps,/const ready=Boolean\(resolvedProfile&&sourceRequirements\)/);
  assert.match(gps,/Needs configuration/);
});

test("F3.0 historical aircraft identity snapshot contract remains independent of mutable current profile",()=>{
  const identityTest=read("tests/integration/postgres-flight-identity-snapshot.test.ts");
  assert.match(identityTest,/same-registration UPDATE does not refresh historical identity/);
  assert.match(identityTest,/actual registration change snapshots the new registration profile/);
  assert.match(identityTest,/explicit shared historical tuple survives a conflicting recipient profile/);
});
