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

test("F3.3 Manual invalid-profile state now has server PROFILE authority while UI simplification remains F3.4",()=>{
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");
  const createStart=actions.indexOf("export async function createFlight");
  const createEnd=actions.indexOf("export async function importKmlFlight",createStart);
  const create=actions.slice(createStart,createEnd);
  const updateStart=actions.indexOf("export async function updateFlight");
  const updateEnd=actions.indexOf("\nexport async function",updateStart+40);
  const update=actions.slice(updateStart,updateEnd>updateStart?updateEnd:actions.length);

  assert.match(form,/profileNeedsConfiguration=Boolean\(selected&&profileDefaultsApply&&!selectedProfile\?\.profile\)/);
  assert.match(form,/if\(registration&&\(!evidence\|\|!aircraftClass\|\|profileNeedsConfiguration\)\)setLogbookOpen\(true\)/);
  assert.doesNotMatch(form,/missing=\[[^\]]*profileNeedsConfiguration/);

  assert.match(create,/resolveProfileAircraftContext\(userId,f\.registration,flightContextFromForm\(form\)\)/);
  assert.match(update,/resolveFlightAircraftContextAuthority/);
  assert.match(update,/resolveProfileAircraftContext\(userId,f\.registration,flightContextFromForm\(form\)\)/);
  assert.match(actions,/allowedFlightContexts\(aircraft\)/);
});

test("F3.0 GPS already treats the active profile as server authority and blocks drift",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=read("components/kml-import-form.tsx");
  const start=actions.indexOf("export async function importKmlFlight");
  const end=actions.indexOf("\nexport async function updateFlight",start);
  const importAction=actions.slice(start,end);

  assert.match(importAction,/aircraftAuthorityProfile\(userId,registration,true\)/);
  assert.match(actions,/active=1 LIMIT 1/);
  assert.match(importAction,/resolveGpsImportAircraftContext/);
  assert.match(importAction,/validateGpsImportSubmittedAircraftContext/);
  assert.match(importAction,/evidence=submittedContext\.context\.evidence/);
  assert.match(importAction,/aircraftClass=submittedContext\.context\.aircraftClass/);

  assert.match(gps,/profileError=selectedAircraft&&!selectedProfile/);
  assert.match(gps,/const ready=Boolean\(effectiveProfile&&sourceRequirements\)/);
  assert.match(gps,/Needs configuration/);
});

test("F3.0 historical aircraft identity snapshot contract remains independent of mutable current profile",()=>{
  const identityTest=read("tests/integration/postgres-flight-identity-snapshot.test.ts");
  assert.match(identityTest,/same-registration UPDATE does not refresh historical identity/);
  assert.match(identityTest,/actual registration change snapshots the new registration profile/);
  assert.match(identityTest,/explicit shared historical tuple survives a conflicting recipient profile/);
});
