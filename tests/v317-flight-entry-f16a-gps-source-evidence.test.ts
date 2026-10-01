import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gpsFlightCandidate } from "../lib/flight-draft-candidate.ts";
import { resolveGpsBasicSourceEvidence } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const gpsForm=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");
const importStart=actions.indexOf("export async function importKmlFlight");
const importEnd=actions.indexOf("\nexport async function",importStart+40);
const importAction=actions.slice(importStart,importEnd>importStart?importEnd:actions.length);

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

test("F1.6a requires explicit day/night landings and Night/IFR duration",()=>{
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"",landingsNight:"0",nightTime:"0:00",ifrTime:"0:00"},60).error??"",/day landings/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"",nightTime:"0:00",ifrTime:"0:00"},60).error??"",/night landings/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"0",nightTime:"",ifrTime:"0:00"},60).error??"",/Night time/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"0",nightTime:"0:00",ifrTime:""},60).error??"",/IFR time/i);
  assert.deepEqual(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"2",nightTime:"0:20",ifrTime:"0:30"},90),{landingsDay:1,landingsNight:2,starts:3,nightMinutes:20,ifrMinutes:30});
});

test("F1.6a rejects invalid ranges and Night/IFR beyond known BLOCK",()=>{
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"100",landingsNight:"0",nightTime:"0:00",ifrTime:"0:00"},60).error??"",/0 to 99/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"0",nightTime:"1:01",ifrTime:"0:00"},60).error??"",/cannot exceed BLOCK/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"0",nightTime:"0:00",ifrTime:"1:01"},60).error??"",/cannot exceed BLOCK/i);
  assert.match(resolveGpsBasicSourceEvidence({landingsDay:"1",landingsNight:"0",nightTime:"0:75",ifrTime:"0:00"},null).error??"",/H:MM/i);
});

test("F1.6a GPS candidate carries reviewed source evidence instead of unresolved placeholders",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-F16",aircraftType:"B23",profile,role:"PIC",billingBasis:"",billingShare:"1",task:"GPS import",operationType:"SP",engineType:"SE",
    reviewedPart:{date:"2026-10-01",departure:"LKPR",arrival:"LKLT",offBlock:"10:00",takeoff:"10:10",landing:"11:00",onBlock:"11:10",starts:"3",landingsDay:"1",landingsNight:"2",nightTime:"0:20",ifrTime:"0:30"},
  });
  assert.equal(candidate.hasStructuredLandings,true);
  assert.deepEqual(candidate.landingsDay,{state:"provided",value:"1",provenance:"GPS_REVIEW"});
  assert.deepEqual(candidate.landingsNight,{state:"provided",value:"2",provenance:"GPS_REVIEW"});
  assert.deepEqual(candidate.nightTime,{state:"provided",value:"0:20",provenance:"GPS_REVIEW"});
  assert.deepEqual(candidate.ifrTime,{state:"provided",value:"0:30",provenance:"GPS_REVIEW"});
  assert.equal(candidate.provenance.movements,"GPS_REVIEW");
});

test("F1.6a UI requires explicit landing split and explicit zero-capable Night/IFR values",()=>{
  assert.match(gpsForm,/part_.+landingsDay/);
  assert.match(gpsForm,/part_.+landingsNight/);
  assert.match(gpsForm,/part_.+nightTime/);
  assert.match(gpsForm,/part_.+ifrTime/);
  assert.match(gpsForm,/Enter 0:00 when none\. GPS does not infer night time\./);
  assert.match(gpsForm,/Enter 0:00 when none\. GPS does not infer IFR time\./);
  assert.match(gpsForm,/Detection is only a suggestion\. Confirm the actual day\/night split below\./);
  assert.match(gpsForm,/basicSourceEvidenceReady\(review\)/);
});

test("F1.6a server validates and persists reviewed source evidence rather than detected all-day landings",()=>{
  assert.match(importAction,/resolveGpsBasicSourceEvidence/);
  assert.match(importAction,/landingsDay:form\.get/);
  assert.match(importAction,/landingsNight:form\.get/);
  assert.match(importAction,/nightTime:form\.get/);
  assert.match(importAction,/ifrTime:form\.get/);
  assert.match(importAction,/\$\{item\.values\.landingsDay\},\$\{item\.values\.landingsNight\}/);
  assert.match(importAction,/\$\{item\.values\.nightMinutes\},\$\{item\.values\.ifrMinutes\}/);
  assert.doesNotMatch(importAction,/\$\{item\.values\.starts\},0,FALSE/);
});

test("F1.6a keeps regulatory movement and sailplane evidence outside this first source-fidelity batch",()=>{
  assert.doesNotMatch(importAction,/gpsFlightCandidate\(/);
  assert.doesNotMatch(importAction,/normalizeFlightDraft\(/);
  assert.match(importAction,/FALSE,\$\{regulatoryCategory==="BALLOON"\?item\.values\.takeoffs:0\},0,0,0/);
});
