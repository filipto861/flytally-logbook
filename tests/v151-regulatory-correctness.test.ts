import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluateClassRevalidation,evaluateLaplA,evaluatePassengerCurrencyMode,type RecencyFlight } from "../lib/recency-engine.ts";
import { isAeroplaneIrQualification } from "../lib/regulatory-qualification.ts";
import { releaseAtLeast } from "./release-version.ts";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(o:Partial<RecencyFlight>={}):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...o});

test("v1.51 release wires aircraft credit, runtime migration and compact movement UI",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,0));
  assert.match(read("lib/runtime-schema.ts"),/ensureV151Schema/);assert.match(read("lib/v151-schema.ts"),/part_fcl_credit_class/);assert.match(read("components/aircraft-manager.tsx"),/part_fcl_credit_class/);assert.match(read("components/flight-form.tsx"),/pilot flying \(PF\)/i);
});

test("FCL.060 never treats landing-only historical data as CURRENT",()=>{
  const old=[flight({movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,landingsDay:3})],result=evaluatePassengerCurrencyMode(old,"SEP",false,"2026-08-31","day");
  assert.equal(result.status,"attention");assert.equal(result.badge,"LIMITED DATA");
  const exact=[flight({takeoffsDay:3,approachesDay:3,landingsDay:3})],ok=evaluatePassengerCurrencyMode(exact,"SEP",false,"2026-08-31","day");assert.equal(ok.status,"current");
});

test("LAPL dual and supervised solo need instructor evidence and real movement evidence",()=>{
  const unsigned=evaluateLaplA([flight({role:"DUAL",minutes:720,takeoffsDay:12,landingsDay:12,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:false})],"2026-08-31");assert.notEqual(unsigned.status,"current");
  const signed=evaluateLaplA([flight({role:"DUAL",minutes:720,takeoffsDay:12,landingsDay:12,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true})],"2026-08-31");assert.equal(signed.status,"current");
  const missingMovements=evaluateLaplA([flight({role:"PIC",minutes:720,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0}) ,flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true})],"2026-08-31");assert.equal(missingMovements.badge,"LIMITED DATA");
});

test("ULL aeroplane PIC experience is automatic LAPL credit while FCL.060 stays separate",()=>{
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  const refresher=flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true});
  const credited=evaluateLaplA([ull,refresher],"2026-08-31");
  assert.equal(credited.status,"current");assert.equal(credited.meta?.ullMinutes,720);
  assert.notEqual(evaluatePassengerCurrencyMode([ull],"SEP",false,"2026-08-31","day").status,"current");
});

test("FCL.740.A keeps movement integrity and automatically accepts eligible ULL experience",()=>{
  const weak=[flight({minutes:660,landingsDay:12,takeoffsDay:11}),flight({role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true})];const result=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:weak});assert.notEqual(result.badge,"READY");
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0}),refresher=flight({role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true});const ready=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[ull,refresher]});assert.equal(ready.badge,"READY");assert.equal(ready.meta?.takeoffs,12);
});

test("IR detection cannot confuse IRI instructor certificate with IR(A)",()=>{assert.equal(isAeroplaneIrQualification("IR(A)"),true);assert.equal(isAeroplaneIrQualification("SE-IR(A)"),true);assert.equal(isAeroplaneIrQualification("IRI(A)"),false);assert.equal(isAeroplaneIrQualification("FI(A)"),false)});

test("licence overview consumes the central recency service instead of trusting its legacy LAPL SQL result",()=>{const page=read("app/(protected)/credentials/page.tsx");assert.match(page,/getRecencyStateForUser/);assert.match(page,/laplEvaluation/)});


test("qualified Czech ULL counts LAPL hours and native starts/landings but never the FI refresher",()=>{
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,partFclCreditClass:"SEP",partFclCreditBasis:"CAA CZ / FCL.035(a)(4) eligible ULL matching SEP(land)",partFclCreditFrom:"2025-01-01"});
  const noRefresher=evaluateLaplA([ull],"2026-08-31");
  assert.equal(noRefresher.requirements.find(item=>item.id==="flight-time")?.met,true);
  assert.equal(noRefresher.requirements.find(item=>item.id==="landings")?.met,true);
  assert.equal(noRefresher.requirements.find(item=>item.id==="refresher")?.met,false);
  const ullFakeRefresher=flight({...ull,role:"DUAL",instructorSigned:true,purposeCode:"LAPL_FCL140A_REFRESHER",minutes:60});
  assert.equal(evaluateLaplA([ull,ullFakeRefresher],"2026-08-31").requirements.find(item=>item.id==="refresher")?.met,false);
});
