import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  resolveGpsImportAircraftContext,
  validateGpsImportSubmittedAircraftContext,
} from "../lib/gps-import-integrity.ts";
import {
  classifySnapshotAircraftContextChange,
  snapshotComparisonSubmission,
  validateSnapshotAircraftContextCorrection,
} from "../lib/flight-aircraft-context-authority.ts";

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

test("F3.3 GPS standard PROFILE context uses the shared allowed-context set",()=>{
  const resolved=resolveGpsImportAircraftContext(profile());
  assert.equal(resolved.error,undefined);
  assert.equal(resolved.contexts?.length,1);

  const submitted=validateGpsImportSubmittedAircraftContext({
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"",
    aircraftType:"B23",
  },resolved.contexts??[]);
  assert.equal(submitted.error,undefined);
  assert.equal(submitted.context?.regulatoryCategory,"AEROPLANE");
});

test("F3.3 GPS TMG requires and accepts one explicit common regulatory context",()=>{
  const resolved=resolveGpsImportAircraftContext(profile({
    aircraft_type:"TMG",
    aircraft_model:"Touring Motor Glider",
    aircraft_class:"TMG",
    regulatory_category:"AEROPLANE",
  }));
  assert.deepEqual(resolved.contexts?.map(item=>item.regulatoryCategory),["AEROPLANE","SAILPLANE"]);

  const missing=validateGpsImportSubmittedAircraftContext({
    evidence:"EASA",
    aircraftClass:"TMG",
    regulatoryCategory:"",
    aircraftType:"TMG",
  },resolved.contexts??[]);
  assert.match(missing.error??"",/regulatory context/i);

  const sailplane=validateGpsImportSubmittedAircraftContext({
    evidence:"EASA",
    aircraftClass:"TMG",
    regulatoryCategory:"SAILPLANE",
    aircraftType:"TMG",
  },resolved.contexts??[]);
  assert.equal(sailplane.error,undefined);
  assert.equal(sailplane.context?.regulatoryCategory,"SAILPLANE");
});

test("F3.3 GPS rejects crafted evidence, class and aircraft type drift",()=>{
  const resolved=resolveGpsImportAircraftContext(profile());
  for(const submitted of [
    {evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",aircraftType:"B23"},
    {evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:"AEROPLANE",aircraftType:"B23"},
    {evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",aircraftType:"OTHER"},
  ]){
    const result=validateGpsImportSubmittedAircraftContext(submitted,resolved.contexts??[]);
    assert.match(result.error??"",/no longer matches|not allowed/i);
  }
});

test("F3.3 legacy blank SNAPSHOT category stays unchanged unless the pilot chooses a non-default context",()=>{
  const stored={
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"",
    balloonClass:"",
    balloonGroup:"",
    aircraftType:"B23",
  };
  const derivedDefault=snapshotComparisonSubmission({
    stored,
    submitted:{...stored,regulatoryCategory:"AEROPLANE"},
  });
  assert.equal(derivedDefault.regulatoryCategory,"");
  assert.equal(classifySnapshotAircraftContextChange(stored,derivedDefault),"UNCHANGED");

  const legacyTmg={...stored,aircraftClass:"TMG",aircraftType:"TMG"};
  const explicitSailplane=snapshotComparisonSubmission({
    stored:legacyTmg,
    submitted:{...legacyTmg,regulatoryCategory:"SAILPLANE"},
  });
  assert.equal(explicitSailplane.regulatoryCategory,"SAILPLANE");
  assert.equal(classifySnapshotAircraftContextChange(legacyTmg,explicitSailplane),"CHANGED");
});

test("F3.3 explicit SNAPSHOT correction keeps stored identity and validates corrected context",()=>{
  const accepted=validateSnapshotAircraftContextCorrection({
    storedAircraftType:"B23",
    aircraftMake:"BRM Aero",
    aircraftModel:"Bristell B23",
    submitted:{
      evidence:"EASA",
      aircraftClass:"TMG",
      regulatoryCategory:"SAILPLANE",
      balloonClass:"",
      balloonGroup:"",
      aircraftType:"B23",
    },
  });
  assert.equal(accepted.error,undefined);
  assert.equal(accepted.context?.aircraftType,"B23");
  assert.equal(accepted.context?.regulatoryCategory,"SAILPLANE");

  const identityDrift=validateSnapshotAircraftContextCorrection({
    storedAircraftType:"B23",
    aircraftMake:"BRM Aero",
    aircraftModel:"Bristell B23",
    submitted:{
      evidence:"EASA",
      aircraftClass:"SEP",
      regulatoryCategory:"AEROPLANE",
      balloonClass:"",
      balloonGroup:"",
      aircraftType:"DIFFERENT",
    },
  });
  assert.match(identityDrift.error??"",/aircraft type/i);
});

test("F3.3 Manual actions derive PROFILE/SNAPSHOT authority server-side and preserve stored SNAPSHOT fields",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/resolveProfileAircraftContext\(userId,f\.registration/);
  assert.match(actions,/resolveFlightAircraftContextAuthority\(\{mode:"UPDATE"/);
  assert.match(actions,/snapshotComparisonSubmission\(\{stored:storedContext,submitted:flightContextFromForm\(form\)\}\)/);
  assert.match(actions,/classifySnapshotAircraftContextChange\(storedContext,submittedContext\)/);
  assert.match(actions,/flightContext=\{evidence:existing\.evidence/);
  assert.match(actions,/part_fcl_credit_class/);
  assert.match(actions,/aircraftAuthorityProfile\(userId,registration,true\)/);
});

test("F3.3 GPS UI submits one common regulatory context and complete authority profile provenance",()=>{
  const form=read("components/kml-import-form.tsx");
  const aircraft=read("lib/data/aircraft.ts");
  assert.match(form,/name="regulatoryCategory"/);
  assert.match(form,/Applies to every flight in this import session/);
  assert.match(form,/part_fcl_credit_class:selectedAircraft\.part_fcl_credit_class/);
  assert.match(aircraft,/part_fcl_credit_class:string/);
  assert.match(aircraft,/COALESCE\(part_fcl_credit_basis,''\)/);
});
