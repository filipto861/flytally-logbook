import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateSemanticValue,
  gpsFlightCandidate,
  manualFlightCandidate,
} from "../lib/flight-draft-candidate.ts";

test("F1.1 manual adapter preserves raw source values and presence semantics",()=>{
  const form=new FormData();
  form.set("date","2026-10-01");
  form.set("registration","OK-F11");
  form.set("aircraftType","B23");
  form.set("evidence","EASA");
  form.set("aircraftClass","SEP");
  form.set("regulatoryCategory","AEROPLANE");
  form.set("departure","LKPR");
  form.set("arrival","LKLT");
  form.set("offBlock","10:00");
  form.set("takeoff","10:10");
  form.set("landing","11:00");
  form.set("onBlock","11:10");
  form.set("landingsDay","1");
  form.set("landingsNight","0");
  form.set("operationType","SP");
  form.set("engineType","SE");
  form.set("role","PIC");
  form.set("movementEvidenceRecorded","yes");
  form.set("takeoffsDay","1");
  form.set("approachesDay","1");
  form.set("task","Local flight");
  form.set("purposeSelectionPresent","1");
  form.append("purposeCode","AIRCRAFT_FAMILIARISATION");
  form.append("purposeCode","AIRCRAFT_DIFFERENCES");
  form.set("billingBasis","BLOCK");
  form.set("billingShare","2");
  form.set("note","candidate");

  const candidate=manualFlightCandidate(form);

  assert.equal(candidate.source,"MANUAL");
  assert.equal(candidate.date,"2026-10-01");
  assert.equal(candidate.registration,"OK-F11");
  assert.deepEqual(candidate.aircraftContext,{
    state:"provided",
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    balloonClass:"",
    balloonGroup:"",
    provenance:"PILOT",
  });
  assert.equal(candidate.hasStructuredLandings,true);
  assert.equal(candidate.hasLaunches,false);
  assert.equal(candidate.purposeSelectionPresent,true);
  assert.deepEqual(candidate.purposeCodes,["AIRCRAFT_FAMILIARISATION","AIRCRAFT_DIFFERENCES"]);
  assert.equal(candidateSemanticValue(candidate.operationType),"SP");
  assert.equal(candidateSemanticValue(candidate.engineType),"SE");
  assert.equal(candidate.provenance.timeline,"PILOT");
  assert.equal(candidate.provenance.movements,"PILOT");
});

test("F1.1 manual adapter distinguishes absent structured fields from zero values",()=>{
  const form=new FormData();
  form.set("starts","0");
  form.set("launches","0");

  const withLaunches=manualFlightCandidate(form);
  assert.equal(withLaunches.hasStructuredLandings,false);
  assert.equal(withLaunches.hasLaunches,true);

  form.delete("launches");
  const absentLaunches=manualFlightCandidate(form);
  assert.equal(absentLaunches.hasLaunches,false);
  assert.equal(absentLaunches.launches,"");
});

test("F1.1 GPS adapter carries profile context but leaves unsupported regulatory facts unresolved",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-F11",
    aircraftType:"B23",
    profile:{
      evidence:"EASA",
      aircraftClass:"SEP",
      regulatoryCategory:"AEROPLANE",
      balloonClass:"",
      balloonGroup:"",
      partFclCreditClass:"",
      partFclCreditBasis:"",
      partFclCreditFrom:"",
    },
    role:"PIC",
    billingBasis:"BLOCK",
    billingShare:"1",
    task:"GPS import",
    reviewedPart:{
      date:"2026-10-01",
      departure:"LKPR",
      arrival:"LKLT",
      offBlock:"10:00",
      takeoff:"10:10",
      landing:"11:00",
      onBlock:"11:10",
      starts:"1",
      note:"reviewed",
    },
  });

  assert.equal(candidate.source,"GPS_REVIEW");
  assert.equal(candidate.aircraftContext.state,"provided");
  assert.equal(candidate.provenance.aircraftContext,"AIRCRAFT_PROFILE");
  assert.equal(candidate.provenance.route,"GPS_REVIEW");
  assert.equal(candidate.provenance.timeline,"GPS_REVIEW");
  assert.equal(candidate.operationType.state,"unresolved");
  assert.equal(candidate.engineType.state,"unresolved");
  assert.equal(candidate.provenance.operation,"UNRESOLVED");
  assert.equal(candidate.provenance.engine,"UNRESOLVED");
  assert.equal((candidate.landingsDay as {state:string}).state,"unresolved");
  assert.equal((candidate.movementEvidenceRecorded as {state:string}).state,"unresolved");
  assert.equal((candidate.nightTime as {state:string}).state,"unresolved");
  assert.equal((candidate.ifrTime as {state:string}).state,"unresolved");
  assert.equal(candidateSemanticValue(candidate.operationType),undefined);
});

test("F1.1 GPS adapter accepts future explicit common Operation/Engine without class inference",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-F11",
    aircraftType:"B23",
    profile:{
      evidence:"EASA",
      aircraftClass:"SEP",
      regulatoryCategory:"AEROPLANE",
      balloonClass:"",
      balloonGroup:"",
      partFclCreditClass:"",
      partFclCreditBasis:"",
      partFclCreditFrom:"",
    },
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"MP",
    engineType:"ME",
    reviewedPart:{
      date:"2026-10-01",
      departure:"",
      arrival:"",
      offBlock:"",
      takeoff:"",
      landing:"",
      onBlock:"",
      starts:"0",
    },
  });

  assert.equal(candidate.operationType.state,"provided");
  assert.equal(candidate.engineType.state,"provided");
  assert.equal(candidateSemanticValue(candidate.operationType),"MP");
  assert.equal(candidateSemanticValue(candidate.engineType),"ME");
  assert.equal(candidate.provenance.operation,"COMMON_IMPORT");
  assert.equal(candidate.provenance.engine,"COMMON_IMPORT");
});

test("F1.1 GPS adapter preserves unresolved aircraft-profile state instead of inventing ULL",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-BAD",
    aircraftType:"",
    profileError:"Selected aircraft profile needs configuration.",
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    reviewedPart:{
      date:"2026-10-01",
      departure:"",
      arrival:"",
      offBlock:"",
      takeoff:"",
      landing:"",
      onBlock:"",
      starts:"0",
    },
  });

  assert.equal(candidate.aircraftContext.state,"unresolved");
  assert.match(candidate.aircraftContext.reason,/needs configuration/);
  assert.equal(candidate.provenance.aircraftContext,"UNRESOLVED");
});

test("F1.1 candidate contract is now consumed by Manual normalization and F1.4 GPS server normalization",async()=>{
  const fs=await import("node:fs");
  const path=await import("node:path");
  const root=path.resolve(import.meta.dirname,"..");
  const actions=fs.readFileSync(path.join(root,"app/(protected)/flights/actions.ts"),"utf8");
  const parser=fs.readFileSync(path.join(root,"lib/flight-input.ts"),"utf8");
  const gpsForm=fs.readFileSync(path.join(root,"components/kml-import-form.tsx"),"utf8");
  assert.match(parser,/manualFlightCandidate/);
  assert.match(parser,/normalizeFlightDraft\(manualFlightCandidate\(form\)\)/);
  assert.match(actions,/gpsFlightCandidate/);
  assert.match(actions,/normalizeFlightDraft\(candidate\)/);
  assert.doesNotMatch(gpsForm,/flight-draft-candidate/);
});
