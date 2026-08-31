import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluateClassRevalidation,evaluateLaplA,evaluatePassengerCurrencyMode,parseRecencyEvidence,type RecencyFlight } from "../lib/recency-engine.ts";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(partial:Partial<RecencyFlight>):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...partial});

test("v1.35.2 forecast, structured evidence, alerts and dashboard status remain supported",()=>{
  assert.match(read("components/recency-panel.tsx"),/Next drop-off/);
  assert.match(read("components/recency-panel.tsx"),/Proficiency & revalidation evidence/);
  assert.match(read("app/(protected)/credentials/recency-actions.ts"),/recency_notification_days/);
  assert.match(read("app/(protected)/dashboard/page.tsx"),/dashboard-recency-status/);
  assert.match(read("app/layout.tsx"),/v1352-recency[.]css/);
  assert.match(read("vercel.json"),/api\/cron\/recency/);
  assert.match(read("lib/notifications.ts"),/notifyUserOnce[\s\S]*DO NOTHING/);
});

test("FCL.060 keeps a Landings requirement and forecasts the next structured movement drop-off",()=>{
  const flights=[flight({date:"2026-08-01"}),flight({date:"2026-08-10"}),flight({date:"2026-08-20"})],result=evaluatePassengerCurrencyMode(flights,"SEP",false,"2026-08-28","day"),landings=result.requirements.find(item=>item.id==="landings");
  assert.equal(result.status,"current");assert.equal(landings?.label,"Landings");assert.equal(landings?.current,3);assert.equal(result.forecastDate,"2026-10-30");
});

test("structured LAPL proficiency-check evidence activates the alternative FCL.140.A route",()=>{
  const evidence=parseRecencyEvidence([{id:"pc1",kind:"LAPL_PROFICIENCY_CHECK",aircraftClass:"SEP",date:"2026-08-01",minutes:0,signer:"Examiner",reference:"PC-2026-01"}]);assert.equal(evidence.length,1);
  const result=evaluateLaplA([],"2026-08-28",evidence);assert.equal(result.status,"current");assert.match(result.summary,/proficiency check/i);assert.equal(result.forecastDate,"2028-08-02");
  assert.equal(parseRecencyEvidence([{id:"bad",kind:"LAPL_PROFICIENCY_CHECK",aircraftClass:"SEP",date:"bad",signer:"",reference:""}]).length,0);
});

test("FCL.740.A experience route combines flight, PIC, landing and structured refresher evidence",()=>{
  const flights=[flight({date:"2026-08-20",minutes:720,landingsDay:12,takeoffsDay:12,approachesDay:12,role:"PIC"})],evidence=parseRecencyEvidence([{id:"ref1",kind:"CLASS_REFRESHER",aircraftClass:"SEP",date:"2026-08-15",minutes:60,signer:"FI Example",reference:"REF-1"}]);
  const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-12-31",flights,evidence,today:"2026-08-28"});assert.equal(result.status,"current");assert.equal(result.badge,"READY");assert.equal(result.requirements.find(item=>item.id==="landings")?.label,"Take-offs / landings");
});

test("FCL.740.A proficiency-check evidence is accepted only in the final three-month route",()=>{
  const evidence=parseRecencyEvidence([{id:"pc2",kind:"CLASS_PROFICIENCY_CHECK",aircraftClass:"SEP",date:"2026-10-01",minutes:0,signer:"FE Example",reference:"SEP-PC"}]),ready=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-12-31",flights:[],evidence,today:"2026-10-15"});assert.equal(ready.badge,"READY");assert.equal(ready.requirements[0].label,"Proficiency check");
  const early=parseRecencyEvidence([{id:"pc3",kind:"CLASS_PROFICIENCY_CHECK",aircraftClass:"SEP",date:"2026-08-01",minutes:0,signer:"FE Example",reference:"EARLY"}]),notReady=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-12-31",flights:[],evidence:early,today:"2026-10-15"});assert.equal(notReady.badge,"IN PROGRESS");
});
