import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  authorizeProfileFlightContext,
  authorizeUnchangedSnapshotFlightContext,
} from "../lib/flight-aircraft-context-authority.ts";
import { resolveGpsImportAircraftContext } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const profile=(overrides:Record<string,unknown>={})=>({
  aircraft_type:"B23",
  aircraft_make:"BRM Aero",
  aircraft_model:"Bristell B23",
  evidence:"EASA",
  aircraft_class:"SEP",
  regulatory_category:"AEROPLANE",
  balloon_class:"",
  balloon_group:"",
  part_fcl_credit_class:"",
  part_fcl_credit_basis:"",
  part_fcl_credit_from:"",
  ...overrides,
});

test("F3.3 PROFILE authorization accepts only a complete profile-supported context",()=>{
  const accepted=authorizeProfileFlightContext(profile(),{
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  });
  assert.equal(accepted.error,undefined);
  assert.equal(accepted.context?.regulatoryCategory,"AEROPLANE");

  const drift=authorizeProfileFlightContext(profile(),{
    evidence:"ULL",
    aircraftClass:"ULL",
    regulatoryCategory:"ULL",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  });
  assert.match(drift.error??"",/profile changed|no longer available/i);

  const invalidCredit=authorizeProfileFlightContext(profile({
    part_fcl_credit_class:"SEP",
    part_fcl_credit_basis:"",
    part_fcl_credit_from:"2026-01-01",
  }),{
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  });
  assert.match(invalidCredit.error??"",/basis\/reference/i);
});

test("F3.3 A+ permits only profile-supported TMG/OTHER category alternatives",()=>{
  const tmg=profile({
    aircraft_type:"TMG",
    aircraft_model:"Touring Motor Glider",
    aircraft_class:"TMG",
    regulatory_category:"AEROPLANE",
  });
  for(const category of ["AEROPLANE","SAILPLANE"] as const){
    const result=authorizeProfileFlightContext(tmg,{
      evidence:"EASA",
      aircraftClass:"TMG",
      regulatoryCategory:category,
      balloonClass:"",
      balloonGroup:"",
      aircraftType:"TMG",
    });
    assert.equal(result.error,undefined,category);
  }

  const forbidden=authorizeProfileFlightContext(tmg,{
    evidence:"EASA",
    aircraftClass:"TMG",
    regulatoryCategory:"OTHER",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"TMG",
  });
  assert.ok(forbidden.error);
});

test("F3.3 unchanged SNAPSHOT passes without current-profile validation while changed context fails closed",()=>{
  const stored={
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"LEGACY",
  };
  const unchanged=authorizeUnchangedSnapshotFlightContext(stored,{...stored});
  assert.equal(unchanged.error,undefined);
  assert.deepEqual(unchanged.context,stored);

  const changed=authorizeUnchangedSnapshotFlightContext(stored,{...stored,evidence:"ULL",aircraftClass:"ULL"});
  assert.match(changed.error??"",/changes the stored aircraft context/i);
});

test("F3.3 GPS resolver shares the same allowed-context authority and complete provenance validation",()=>{
  const resolved=resolveGpsImportAircraftContext(profile({
    aircraft_type:"TMG",
    aircraft_model:"Touring Motor Glider",
    aircraft_class:"TMG",
    regulatory_category:"SAILPLANE",
  }));
  assert.equal(resolved.error,undefined);
  assert.deepEqual(resolved.contexts?.map(context=>context.regulatoryCategory),["SAILPLANE","AEROPLANE"]);

  const invalid=resolveGpsImportAircraftContext(profile({
    part_fcl_credit_class:"SEP",
    part_fcl_credit_basis:"",
    part_fcl_credit_from:"2026-01-01",
  }));
  assert.ok(invalid.error);
  assert.equal(invalid.contexts,undefined);
});

test("F3.3 Manual actions derive PROFILE/SNAPSHOT authority server-side before persistence",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const createStart=actions.indexOf("export async function createFlight");
  const createEnd=actions.indexOf("export async function importKmlFlight",createStart);
  const create=actions.slice(createStart,createEnd);
  const updateStart=actions.indexOf("export async function updateFlight");
  const updateEnd=actions.indexOf("\nexport async function",updateStart+40);
  const update=actions.slice(updateStart,updateEnd>updateStart?updateEnd:actions.length);

  assert.match(create,/aircraftAuthorityProfile\(userId,f\.registration,false\)/);
  assert.match(create,/authorizeProfileFlightContext\(profile,flightAircraftContextFromForm\(form\)\)/);
  assert.match(create,/authorityContext=authority\.context/);
  assert.match(create,/\$\{authorityContext\.evidence\}/);
  assert.match(create,/\$\{authorityContext\.aircraftType\}/);
  assert.match(create,/\$\{authorityContext\.aircraftClass\}/);
  assert.match(create,/\$\{authorityContext\.regulatoryCategory\}/);
  assert.match(create,/\$\{authorityContext\.balloonClass\}/);
  assert.match(create,/\$\{authorityContext\.balloonGroup\}/);

  assert.match(update,/resolveFlightAircraftContextAuthority/);
  assert.match(update,/authorityKind\.authority==="PROFILE"/);
  assert.match(update,/authorizeUnchangedSnapshotFlightContext/);
  assert.match(update,/legacyCategoryPresentationOnly/);
  assert.match(update,/evidence=\$\{persistedAircraftContext\.evidence\}/);
  assert.match(update,/regulatory_category=\$\{persistedAircraftContext\.regulatoryCategory\}/);
});

test("F3.3 GPS uses active PROFILE authority and exposes one common multi-context choice",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const form=read("components/kml-import-form.tsx");
  const start=actions.indexOf("export async function importKmlFlight");
  const end=actions.indexOf("\nexport async function updateFlight",start);
  const gpsAction=actions.slice(start,end);

  assert.match(gpsAction,/aircraftAuthorityProfile\(userId,registration,true\)/);
  assert.match(gpsAction,/authorizeProfileFlightContext\(selectedAircraft,flightAircraftContextFromForm\(form\)\)/);
  assert.match(gpsAction,/authorityProfile=authority\.profile,authorityContext=authority\.context,profileForFlight=\{\.\.\.authorityProfile,regulatoryCategory:authorityContext\.regulatoryCategory\}/);
  assert.match(form,/allowedContexts\.length>1/);
  assert.match(form,/name="regulatoryCategory"/);
  assert.match(form,/This choice applies to every flight in this import session/);
  assert.match(form,/name="balloonClass"/);
  assert.match(form,/name="balloonGroup"/);
});

test("F3.3 shared-flight materialization remains outside Manual PROFILE equality enforcement",()=>{
  const shared=read("app/(protected)/connections/actions.ts");
  assert.doesNotMatch(shared,/flight-aircraft-context-authority/);
  assert.doesNotMatch(shared,/authorizeProfileFlightContext/);
});
