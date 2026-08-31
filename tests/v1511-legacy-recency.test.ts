import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveMovementCompatibility } from "../lib/legacy-movement.ts";
import { evaluateClassRevalidation,evaluateLaplA,evaluatePassengerCurrencyMode,type RecencyFlight } from "../lib/recency-engine.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const base=(o:Partial<RecencyFlight>={}):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:false,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0,...o});
const compatible=(flight:RecencyFlight,legacyMovementCandidate:boolean)=>{const movement=resolveMovementCompatibility({evidence:flight.evidence,movementEvidenceRecorded:flight.movementEvidenceRecorded,legacyMovementCandidate,landingsDay:flight.landingsDay,landingsNight:flight.landingsNight,takeoffsDay:flight.takeoffsDay,takeoffsNight:flight.takeoffsNight,approachesDay:flight.approachesDay,approachesNight:flight.approachesNight});return{...flight,...movement} as RecencyFlight&{legacyMovementInferred:boolean}};

test("v1.51.1 release identifies legacy records from audit provenance",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,1));
  const service=read("lib/recency-service.ts");
  assert.match(service,/flight_audit_log movement_audit/);
  assert.match(service,/new_data \? 'movement_evidence_recorded'/);
  assert.match(service,/resolveMovementCompatibility/);
});

test("legacy certified EASA landings conservatively reconstruct missing PF counters",()=>{
  const movement=resolveMovementCompatibility({evidence:"EASA",movementEvidenceRecorded:false,legacyMovementCandidate:true,landingsDay:2,landingsNight:1,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0});
  assert.equal(movement.movementEvidenceRecorded,true);
  assert.equal(movement.legacyMovementInferred,true);
  assert.deepEqual([movement.takeoffsDay,movement.takeoffsNight,movement.approachesDay,movement.approachesNight],[2,1,2,1]);
});

test("structured-era missing movement evidence is never inferred",()=>{
  const movement=resolveMovementCompatibility({evidence:"EASA",movementEvidenceRecorded:false,legacyMovementCandidate:false,landingsDay:3,landingsNight:0,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0});
  assert.equal(movement.movementEvidenceRecorded,false);
  assert.equal(movement.legacyMovementInferred,false);
  const result=evaluatePassengerCurrencyMode([{...base({landingsDay:3}),...movement}],"SEP",false,"2026-08-31","day");
  assert.equal(result.status,"attention");
  assert.equal(result.badge,"LIMITED DATA");
});

test("explicit structured zero remains zero even on an old flight",()=>{
  const movement=resolveMovementCompatibility({evidence:"EASA",movementEvidenceRecorded:true,legacyMovementCandidate:true,landingsDay:3,landingsNight:0,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0});
  assert.equal(movement.movementEvidenceRecorded,true);
  assert.equal(movement.legacyMovementInferred,false);
  assert.equal(movement.takeoffsDay,0);
  assert.equal(movement.approachesDay,0);
});

test("three recent legacy PIC flights restore SEP passenger currency",()=>{
  const flights=["2026-08-23","2026-08-22","2026-08-21"].map(date=>compatible(base({date}),true));
  const result=evaluatePassengerCurrencyMode(flights,"SEP",false,"2026-08-31","day");
  assert.equal(result.status,"current");
  assert.equal(result.requirements.find(item=>item.id==="takeoffs")?.current,3);
  assert.equal(result.requirements.find(item=>item.id==="approaches")?.current,3);
  assert.equal(result.requirements.find(item=>item.id==="landings")?.current,3);
});

test("legacy movements remain usable for LAPL and FCL.740.A without weakening refresher rules",()=>{
  const pic=compatible(base({date:"2026-08-20",minutes:660,landingsDay:12}),true),refresher=base({date:"2026-08-21",role:"DUAL",minutes:60,landingsDay:0,movementEvidenceRecorded:false,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true});
  const lapl=evaluateLaplA([pic,refresher],"2026-08-31");
  assert.equal(lapl.status,"current");
  assert.equal(lapl.requirements.find(item=>item.id==="landings")?.current,12);
  assert.equal(lapl.requirements.find(item=>item.id==="refresher")?.met,true);

  const classRefresher={...refresher,purposeCode:"SEP_TMG_FCL740A_REFRESHER"};
  const classResult=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[pic,classRefresher]});
  assert.equal(classResult.badge,"READY");
  assert.equal(classResult.meta?.takeoffs,12);
});

test("ULL records are not converted by the legacy EASA compatibility path",()=>{
  const movement=resolveMovementCompatibility({evidence:"ULL",movementEvidenceRecorded:false,legacyMovementCandidate:true,landingsDay:12,landingsNight:0,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0});
  assert.equal(movement.movementEvidenceRecorded,false);
  assert.equal(movement.legacyMovementInferred,false);
});
