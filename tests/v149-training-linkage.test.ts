import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluateClassRevalidation,type RecencyFlight,type RecencyEvidence } from "../lib/recency-engine.ts";
import { releaseAtLeast } from "./release-version.ts";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(overrides:Partial<RecencyFlight>={}):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:660,landingsDay:11,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:11,takeoffsNight:0,approachesDay:11,approachesNight:0,...overrides});

test("v1.49 signed FCL.740.A DUAL flight satisfies the refresher element directly",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,49,0));
  const flights=[flight(),flight({role:"DUAL",minutes:60,landingsDay:1,takeoffsDay:1,approachesDay:1,purposeCode:"SEP_TMG_FCL740A_REFRESHER",task:"FCL.740.A refresher training",instructorSigned:true})];
  const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights,qualificationId:42});
  assert.equal(result.badge,"READY");assert.equal(result.requirements.find(item=>item.id==="refresher")?.met,true);assert.equal(result.meta?.qualificationId,42);
});

test("unsigned refresher purpose does not satisfy FCL.740.A",()=>{
  const flights=[flight(),flight({role:"DUAL",minutes:60,landingsDay:1,takeoffsDay:1,approachesDay:1,purposeCode:"SEP_TMG_FCL740A_REFRESHER",task:"FCL.740.A refresher training",instructorSigned:false})];
  const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights});
  assert.equal(result.badge,"IN PROGRESS");assert.equal(result.requirements.find(item=>item.id==="refresher")?.met,false);
});

test("combined LAPL plus FCL.740.A purpose remains detectable from certified task",()=>{
  const flights=[flight(),flight({role:"DUAL",minutes:60,landingsDay:1,takeoffsDay:1,approachesDay:1,purposeCode:"LAPL_FCL140A_REFRESHER",task:"Differences training · FCL.140.A refresher training · FCL.740.A refresher training · Circuits",instructorSigned:true})];
  assert.equal(evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights}).badge,"READY");
});

test("SEP and TMG experience can be combined when both ratings are held",()=>{
  const flights=[flight({aircraftClass:"TMG"}),flight({aircraftClass:"SEP",role:"DUAL",minutes:60,landingsDay:1,takeoffsDay:1,approachesDay:1,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})];
  assert.equal(evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights,combineSepTmg:true}).badge,"READY");
  assert.notEqual(evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights,combineSepTmg:false}).badge,"READY");
});

test("documented FCL.740.A refresher exemption can replace the one-hour refresher element",()=>{
  const evidence:RecencyEvidence[]=[{id:"exemption-1",kind:"CLASS_REFRESHER_EXEMPTION",aircraftClass:"SEP",date:"2026-08-10",minutes:0,signer:"Examiner",reference:"AoC-2026-01",note:"Assessment of competence"}];
  const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[flight({minutes:720,landingsDay:12,takeoffsDay:12,approachesDay:12})],evidence});
  assert.equal(result.badge,"READY");assert.equal(result.requirements.find(item=>item.id==="refresher")?.met,true);
});

test("v1.49 refreshes recency when authoritative flight evidence changes",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts"),instructor=read("app/(protected)/flights/instructor-actions.ts"),shared=read("app/(protected)/flights/shared-actions.ts"),inPerson=read("app/(protected)/flights/[id]/in-person-signature/page.tsx");
  assert.match(certification,/refreshRecencySnapshot\(userId\)/);assert.match(instructor,/refreshRecencySnapshot\(payload\.flightUserId\)/);assert.match(instructor,/refreshRecencySnapshot\(Number\(rows\[0\]\.flight_user_id\)\)/);assert.match(shared,/refreshRecencySnapshot\(payload\.flightUserId\)/);assert.match(inPerson,/refreshRecencySnapshot\(userId\)/);
});

test("v1.49 links READY recency to explicit rating validity instead of mutating it",()=>{
  const panel=read("components/recency-panel.tsx"),actions=read("app/(protected)/profile/actions.ts"),credentials=read("app/(protected)/credentials/page.tsx"),engine=read("lib/recency-engine.ts");
  assert.match(panel,/Record new rating validity/);assert.match(actions,/export async function saveQualification/);assert.match(credentials,/Save rating validity/);assert.doesNotMatch(engine,/UPDATE pilot_qualifications/);
});

test("v1.49 offers signed differences flights as aircraft-training candidates without auto granting endorsements",()=>{
  const candidates=read("components/training-flight-candidates.tsx"),section=read("components/aircraft-qualifications-section.tsx");
  assert.match(candidates,/flight_verifications/);assert.match(candidates,/instructor_signed/);assert.match(candidates,/AircraftEndorsementPicker/);assert.match(candidates,/never grants a privilege automatically/);assert.match(section,/TrainingFlightCandidates/);
});
