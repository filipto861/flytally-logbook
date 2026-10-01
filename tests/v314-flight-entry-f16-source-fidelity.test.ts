import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gpsFlightCandidate } from "../lib/flight-draft-candidate.ts";
import { normalizeFlightDraft } from "../lib/flight-input.ts";
import { gpsImportSourceRequirements } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const gpsForm=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");

const easaSepProfile={
  evidence:"EASA" as const,
  aircraftClass:"SEP" as const,
  regulatoryCategory:"AEROPLANE" as const,
  balloonClass:"" as const,
  balloonGroup:"" as const,
  partFclCreditClass:"" as const,
  partFclCreditBasis:"",
  partFclCreditFrom:"",
};

const baseReviewed={
  date:"2026-10-01",
  departure:"LKPR",
  arrival:"LKLT",
  offBlock:"10:00",
  takeoff:"10:10",
  landing:"11:00",
  onBlock:"11:10",
  starts:"1",
  note:"reviewed",
};

test("F1.6 source requirements are category-driven rather than GPS guesses",()=>{
  assert.deepEqual(gpsImportSourceRequirements(easaSepProfile),{
    landingMode:"DAY_NIGHT",
    movementMode:"FCL060_PF",
    reviewNightIfr:true,
  });
  assert.deepEqual(gpsImportSourceRequirements({...easaSepProfile,aircraftClass:"TMG",regulatoryCategory:"SAILPLANE"}),{
    landingMode:"DAY_NIGHT",
    movementMode:"EXPLICIT_TAKEOFFS",
    reviewNightIfr:true,
  });
  assert.deepEqual(gpsImportSourceRequirements({...easaSepProfile,aircraftClass:"GLIDER",regulatoryCategory:"SAILPLANE"}),{
    landingMode:"TOTAL",
    movementMode:"SAILPLANE_LAUNCH",
    reviewNightIfr:false,
  });
  assert.deepEqual(gpsImportSourceRequirements({...easaSepProfile,aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:"A"}),{
    landingMode:"DAY_NIGHT",
    movementMode:"EXPLICIT_TAKEOFFS",
    reviewNightIfr:true,
  });
});

test("F1.6 explicit EASA SEP GPS evidence normalizes without inferred movements",()=>{
  const result=normalizeFlightDraft(gpsFlightCandidate({
    registration:"OK-F16",
    aircraftType:"B23",
    profile:easaSepProfile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{
      ...baseReviewed,
      landingsDay:"1",
      landingsNight:"0",
      movementEvidenceRecorded:"yes",
      takeoffsDay:"1",
      takeoffsNight:"0",
      approachesDay:"1",
      approachesNight:"0",
      nightTime:"",
      ifrTime:"",
    },
  }));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.starts,1);
  assert.equal(result.data?.landingsDay,1);
  assert.equal(result.data?.landingsNight,0);
  assert.equal(result.data?.movementEvidenceRecorded,true);
  assert.equal(result.data?.takeoffsDay,1);
  assert.equal(result.data?.approachesDay,1);
  assert.equal(result.data?.nightMinutes,0);
  assert.equal(result.data?.ifrMinutes,0);
});

test("F1.6 explicit PF=no resolves to no positive movement evidence",()=>{
  const result=normalizeFlightDraft(gpsFlightCandidate({
    registration:"OK-F16",
    aircraftType:"B23",
    profile:easaSepProfile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{
      ...baseReviewed,
      landingsDay:"1",
      landingsNight:"0",
      movementEvidenceRecorded:"no",
      nightTime:"",
      ifrTime:"",
    },
  }));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.movementEvidenceRecorded,false);
  assert.equal(result.data?.takeoffsDay,0);
  assert.equal(result.data?.takeoffsNight,0);
  assert.equal(result.data?.approachesDay,0);
  assert.equal(result.data?.approachesNight,0);
});

test("F1.6 non-TMG sailplane requires explicit launch evidence and does not invent it",()=>{
  const profile={...easaSepProfile,aircraftClass:"GLIDER" as const,regulatoryCategory:"SAILPLANE" as const};
  const missing=normalizeFlightDraft(gpsFlightCandidate({
    registration:"OK-GLD",
    aircraftType:"GLD",
    profile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{...baseReviewed,landingsDay:"1"},
  }));
  assert.match(missing.error??"",/launch/i);

  const explicit=normalizeFlightDraft(gpsFlightCandidate({
    registration:"OK-GLD",
    aircraftType:"GLD",
    profile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{...baseReviewed,landingsDay:"1",launchMethod:"AEROTOW",launches:"1"},
  }));
  assert.equal(explicit.error,undefined);
  assert.equal(explicit.data?.launchMethod,"AEROTOW");
  assert.equal(explicit.data?.launches,1);
  assert.equal(explicit.data?.starts,1);
});

test("F1.6 GPS UI exposes explicit reviewed evidence and does not auto-classify day/night",()=>{
  assert.match(gpsForm,/part_\$\{index\}_landingsDay/);
  assert.match(gpsForm,/part_\$\{index\}_landingsNight/);
  assert.match(gpsForm,/part_\$\{index\}_movementEvidenceRecorded/);
  assert.match(gpsForm,/Yes — I was PF/);
  assert.match(gpsForm,/No — do not count PF movements/);
  assert.match(gpsForm,/part_\$\{index\}_launchMethod/);
  assert.match(gpsForm,/part_\$\{index\}_launches/);
  assert.match(gpsForm,/part_\$\{index\}_nightTime/);
  assert.match(gpsForm,/part_\$\{index\}_ifrTime/);
  assert.match(gpsForm,/disabled=\{!sourceReady\}/);
  assert.doesNotMatch(gpsForm,/landingsDay:String\(landingCount/);
});

test("F1.6 server validates and persists explicit GPS evidence instead of fixed day/zero placeholders",()=>{
  assert.match(actions,/gpsImportSourceRequirements\(profileResult\.profile\)/);
  assert.match(actions,/needs explicit landing evidence matching the reviewed total/);
  assert.match(actions,/needs an explicit pilot-flying movement decision/);
  assert.match(actions,/requires explicit sailplane launch method and count/);
  assert.match(actions,/Night \/ IFR time cannot exceed BLOCK time/);
  assert.match(actions,/\$\{item\.input\.launchMethod\},\$\{item\.input\.launches\}/);
  assert.match(actions,/\$\{item\.input\.landingsDay\},\$\{item\.input\.landingsNight\},\$\{item\.input\.movementEvidenceRecorded\}/);
  assert.match(actions,/\$\{item\.input\.takeoffsDay\},\$\{item\.input\.takeoffsNight\},\$\{item\.input\.approachesDay\},\$\{item\.input\.approachesNight\}/);
  assert.match(actions,/\$\{item\.input\.nightMinutes\},\$\{item\.input\.ifrMinutes\}/);
  assert.doesNotMatch(actions,/\$\{item\.values\.starts\},0,FALSE,\$\{regulatoryCategory==="BALLOON"\?item\.values\.takeoffs:0\}/);
});
