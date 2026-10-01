import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gpsFlightCandidate } from "../lib/flight-draft-candidate.ts";
import { normalizeFlightDraft,parseFlightInput } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const actions=read("app/(protected)/flights/actions.ts");
const start=actions.indexOf("export async function importKmlFlight");
const end=actions.indexOf("\nexport async function",start+40);
const gpsAction=actions.slice(start,end>start?end:actions.length);

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

function manualPicForm(){
  const form=new FormData();
  for(const [name,value] of Object.entries({
    date:"2026-10-01",registration:"OK-F14",aircraftType:"B23",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",
    departure:"LKPR",arrival:"LKLT",offBlock:"10:00",takeoff:"10:10",landing:"11:00",onBlock:"11:10",
    landingsDay:"1",landingsNight:"0",movementEvidenceRecorded:"yes",takeoffsDay:"1",takeoffsNight:"0",approachesDay:"1",approachesNight:"0",
    operationType:"SP",engineType:"SE",nightTime:"0:00",ifrTime:"0:00",role:"PIC",task:"GPS import",billingBasis:"",billingShare:"1",note:"reviewed",
  }))form.set(name,value);
  return form;
}

test("F1.4 equivalent Manual and GPS EASA PIC facts normalize to the same FlightInput",()=>{
  const manual=parseFlightInput(manualPicForm());
  const gps=normalizeFlightDraft(gpsFlightCandidate({
    registration:"OK-F14",
    aircraftType:"B23",
    profile:easaSepProfile,
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{
      date:"2026-10-01",departure:"LKPR",arrival:"LKLT",offBlock:"10:00",takeoff:"10:10",landing:"11:00",onBlock:"11:10",
      starts:"1",landingsDay:"1",landingsNight:"0",movementEvidenceRecorded:"yes",takeoffsDay:"1",takeoffsNight:"0",approachesDay:"1",approachesNight:"0",
      nightTime:"0:00",ifrTime:"0:00",note:"reviewed",
    },
  }));
  assert.equal(manual.error,undefined);
  assert.equal(gps.error,undefined);
  assert.deepEqual(gps.data,manual.data);
});

test("F1.4 GPS action constructs reviewed candidates and normalizes every part before persistence",()=>{
  assert.match(gpsAction,/gpsFlightCandidate\(\{/);
  assert.match(gpsAction,/normalizeFlightDraft\(candidate\)/);
  assert.match(gpsAction,/if\(!normalized\.data\)return\{error:/);
  assert.match(gpsAction,/prepared\.push\(\{part,stats,input,/);
  assert.doesNotMatch(gpsAction,/prepared\.push\(\{part,stats,values,/);
});

test("F1.4 flight INSERT consumes normalized FlightInput semantics rather than source variables",()=>{
  for(const field of [
    "date","evidence","registration","aircraftType","aircraftClass","regulatoryCategory","balloonClass","balloonGroup","balloonOperation",
    "launchMethod","launches","departure","arrival","offBlock","takeoff","landing","onBlock","starts","commander","instructor","role","task",
    "purposeCode","verificationName","verificationReference","billingBasis","note","operationType","engineType","operatorName","flightNumber",
    "operationContext","landingsDay","landingsNight","movementEvidenceRecorded","takeoffsDay","takeoffsNight","approachesDay","approachesNight",
    "nightMinutes","ifrMinutes","picMinutes","copilotMinutes","dualMinutes","instructorMinutes",
  ])assert.match(gpsAction,new RegExp("item\\.input\\."+field),field);
  assert.doesNotMatch(gpsAction,/\$\{evidence\},\$\{registration\},\$\{aircraftType\},\$\{aircraftClass\}/);
  assert.doesNotMatch(gpsAction,/\$\{operationType\},\$\{engineType\}/);
});

test("F1.4 duplicate identity uses the same normalized semantic record",()=>{
  assert.match(gpsAction,/flightFingerprint\(userId,\{date:input\.date,registration:input\.registration,offBlock:input\.offBlock,departure:input\.departure,arrival:input\.arrival\}\)/);
  assert.match(gpsAction,/date::text=\$\{item\.input\.date\}/);
  assert.match(gpsAction,/UPPER\(TRIM\(registration\)\)=\$\{item\.input\.registration\}/);
});

test("F1.4 preserves specialized GPS atomic persistence and provenance outside FlightInput",()=>{
  assert.match(gpsAction,/pg_advisory_xact_lock/);
  assert.match(gpsAction,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(gpsAction,/WHERE NOT EXISTS\(SELECT 1 FROM flights/);
  assert.match(gpsAction,/INSERT INTO flight_tracks/);
  assert.match(gpsAction,/JSON\.stringify\(item\.part\)/);
  assert.match(gpsAction,/rolled back\. No partial flights were created/);
});
