import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { CandidateSemantic,FlightDraftProvenance } from "../lib/flight-draft-candidate.ts";
import { normalizeGpsReviewedFlight } from "../lib/gps-flight-normalization.ts";

const root=path.resolve(import.meta.dirname,"..");
const explicit=(value:unknown,provenance:FlightDraftProvenance="GPS_REVIEW"):CandidateSemantic=>({state:"provided",value,provenance});

const profile={
  evidence:"EASA" as const,
  aircraftClass:"SEP" as const,
  regulatoryCategory:"AEROPLANE" as const,
  balloonClass:"" as const,
  balloonGroup:"" as const,
  partFclCreditClass:"" as const,
  partFclCreditBasis:"",
  partFclCreditFrom:"",
};

const reviewedPart={
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

test("F1.4A prepared GPS normalization fails closed while day/night landing authority is unresolved",()=>{
  const result=normalizeGpsReviewedFlight({
    registration:"OK-F14",
    aircraftType:"B23",
    profile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart,
    semanticEvidence:{
      movementEvidenceRecorded:explicit("no"),
      nightTime:explicit(""),
      ifrTime:explicit(""),
    },
  });
  assert.equal(result.data,undefined);
  assert.match(result.error??"",/landing evidence|day\/night classification/i);
  assert.equal(result.candidate.provenance.route,"GPS_REVIEW");
});

test("F1.4A explicit source authority can produce the same canonical FlightInput contract",()=>{
  const result=normalizeGpsReviewedFlight({
    registration:"OK-F14",
    aircraftType:"B23",
    profile,
    role:"PIC",
    billingBasis:"BLOCK",
    billingShare:"2",
    task:"GPS import",
    operationType:"MP",
    engineType:"ME",
    reviewedPart,
    semanticEvidence:{
      landingsDay:explicit("1"),
      landingsNight:explicit("0"),
      movementEvidenceRecorded:explicit("no","COMMON_IMPORT"),
      nightTime:explicit(""),
      ifrTime:explicit(""),
    },
  });

  assert.equal(result.error,undefined);
  assert.equal(result.data?.evidence,"EASA");
  assert.equal(result.data?.aircraftClass,"SEP");
  assert.equal(result.data?.regulatoryCategory,"AEROPLANE");
  assert.equal(result.data?.role,"PIC");
  assert.equal(result.data?.operationType,"MP");
  assert.equal(result.data?.engineType,"ME");
  assert.equal(result.data?.starts,1);
  assert.equal(result.data?.landingsDay,1);
  assert.equal(result.data?.landingsNight,0);
  assert.equal(result.data?.movementEvidenceRecorded,false);
  assert.equal(result.data?.takeoffsDay,0);
  assert.equal(result.data?.approachesDay,0);
  assert.equal(result.data?.nightMinutes,0);
  assert.equal(result.data?.ifrMinutes,0);
  assert.equal(result.data?.billingBasis,"BLOCK/2");
  assert.equal(result.data?.picMinutes,70);
});

test("F1.4A non-TMG sailplane remains blocked without explicit launch authority",()=>{
  const result=normalizeGpsReviewedFlight({
    registration:"OK-GLD",
    aircraftType:"Sailplane",
    profile:{...profile,aircraftClass:"GLIDER",regulatoryCategory:"SAILPLANE"},
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart,
    semanticEvidence:{
      landingsDay:explicit("1"),
      landingsNight:explicit("0"),
      movementEvidenceRecorded:explicit("no"),
      nightTime:explicit(""),
      ifrTime:explicit(""),
    },
  });
  assert.equal(result.data,undefined);
  assert.match(result.error??"",/sailplane launch/i);
});

test("F1.4A generic GPS movement never becomes positive Part-FCL movement or approach evidence",()=>{
  const result=normalizeGpsReviewedFlight({
    registration:"OK-F14",
    aircraftType:"B23",
    profile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{...reviewedPart,starts:"3"},
    semanticEvidence:{
      landingsDay:explicit("3"),
      landingsNight:explicit("0"),
      movementEvidenceRecorded:explicit("no","COMMON_IMPORT"),
      nightTime:explicit(""),
      ifrTime:explicit(""),
    },
  });
  assert.equal(result.error,undefined);
  assert.equal(result.data?.starts,3);
  assert.equal(result.data?.movementEvidenceRecorded,false);
  assert.equal(result.data?.takeoffsDay,0);
  assert.equal(result.data?.takeoffsNight,0);
  assert.equal(result.data?.approachesDay,0);
  assert.equal(result.data?.approachesNight,0);
});

test("F1.4A production GPS mutation is not activated before F1.5/F1.6",()=>{
  const actions=fs.readFileSync(path.join(root,"app/(protected)/flights/actions.ts"),"utf8");
  const start=actions.indexOf("export async function importKmlFlight");
  const end=actions.indexOf("\nexport async function updateFlight",start);
  const gps=actions.slice(start,end);
  assert.doesNotMatch(gps,/normalizeGpsReviewedFlight|gpsFlightCandidate|normalizeFlightDraft/);
  assert.match(gps,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
});
