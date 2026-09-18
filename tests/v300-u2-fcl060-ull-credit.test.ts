import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { aircraftCategoryCapabilities } from "../lib/aircraft-category.ts";
import { flightEntryProfile } from "../lib/flight-entry-profile.ts";
import { resolveMovementCompatibility } from "../lib/legacy-movement.ts";
import { buildRecencyAudit,type RecencyAuditFlight } from "../lib/recency-audit.ts";
import { evaluatePassengerCurrencyMode,type RecencyFlight } from "../lib/recency-engine.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const nativeUll=()=>resolveMovementCompatibility({
  evidence:"ULL",
  movementEvidenceRecorded:false,
  legacyMovementCandidate:false,
  starts:3,
  landingsDay:3,
  landingsNight:0,
  takeoffsDay:0,
  takeoffsNight:0,
  approachesDay:0,
  approachesNight:0,
});

test("v3.0 U2 FCL.060 accepts same-class ULL movement evidence for SEP",()=>{
  const movement=nativeUll();
  assert.equal(movement.movementEvidenceRecorded,true);
  assert.equal(movement.takeoffsDay,3);
  assert.equal(movement.approachesDay,3);
  assert.equal(movement.takeoffsNight,0);
  assert.equal(movement.approachesNight,0);
  assert.equal(movement.ullMovementInferred,true);

  const flight:RecencyFlight={date:"2026-09-10",evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:45,starts:3,landingsDay:3,landingsNight:0,movementEvidenceRecorded:movement.movementEvidenceRecorded,takeoffsDay:movement.takeoffsDay,takeoffsNight:movement.takeoffsNight,approachesDay:movement.approachesDay,approachesNight:movement.approachesNight};
  const evaluation=evaluatePassengerCurrencyMode([flight],"SEP",false,"2026-09-18","day");
  assert.equal(evaluation.status,"current");
  assert.equal(evaluation.requirements.find(item=>item.id==="takeoffs")?.current,3);
  assert.equal(evaluation.requirements.find(item=>item.id==="approaches")?.current,3);
  assert.equal(evaluation.requirements.find(item=>item.id==="landings")?.current,3);
});

test("v3.0 U2 FCL.060 respects explicit ULL class mapping and valid-from boundary",()=>{
  const base:RecencyFlight={date:"2026-09-10",evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:45,starts:3,landingsDay:3,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:3,takeoffsNight:0,approachesDay:3,approachesNight:0};
  assert.equal(evaluatePassengerCurrencyMode([{...base,partFclCreditClass:"TMG"}],"SEP",false,"2026-09-18","day").status,"not-current");
  assert.equal(evaluatePassengerCurrencyMode([{...base,partFclCreditClass:"TMG"}],"TMG",false,"2026-09-18","day").status,"current");
  assert.equal(evaluatePassengerCurrencyMode([{...base,partFclCreditClass:"SEP",partFclCreditFrom:"2026-09-15"}],"SEP",false,"2026-09-18","day").status,"not-current");
});

test("v3.0 U2 native ULL compatibility requires both start and landing evidence",()=>{
  const incomplete=resolveMovementCompatibility({evidence:"ULL",movementEvidenceRecorded:false,legacyMovementCandidate:false,starts:0,landingsDay:2,landingsNight:0,takeoffsDay:0,takeoffsNight:0,approachesDay:0,approachesNight:0});
  assert.equal(incomplete.movementEvidenceRecorded,false);
  assert.equal(incomplete.ullMovementInferred,false);
});

test("v3.0 U2 ULL entry captures explicit PF movements for future records",()=>{
  const capability=aircraftCategoryCapabilities({regulatoryCategory:"ULL",aircraftClass:"ULL",evidence:"ULL"});
  assert.equal(capability.recencyFamily,"ULL");
  assert.equal(capability.movementEvidenceMode,"FCL060_PF");
  assert.equal(capability.supportsFcl060MovementEvidence,true);
  assert.equal(flightEntryProfile({hasAircraft:true,regulatoryCategory:"ULL",aircraftClass:"ULL",evidence:"ULL"}).showRegulatoryMovements,true);
});

test("v3.0 U2 FCL.060 audit exposes ULL class credit provenance",()=>{
  const flight:RecencyAuditFlight={id:77,date:"2026-09-10",evidence:"ULL",registration:"OK-U01",aircraftClass:"ULL",role:"PIC",departure:"LKLT",arrival:"LKLT",minutes:45,starts:3,landingsDay:3,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:3,takeoffsNight:0,approachesDay:3,approachesNight:0,ullMovementInferred:true};
  const evaluation=evaluatePassengerCurrencyMode([flight],"SEP",false,"2026-09-18","day");
  const audit=buildRecencyAudit(evaluation,[flight],[],"2026-09-18");
  assert.equal(audit.confirmedCount,1);
  assert.match(audit.rows[0]?.detail??"",/ULL → SEP native movement evidence/);
});

test("v3.0 U2 recency services feed native ULL starts into calculation and audit compatibility",()=>{
  const service=read("lib/recency-service.ts"),auditService=read("lib/recency-audit-service.ts");
  assert.match(service,/starts:row\.starts/);
  assert.match(service,/ullMovementInferred:movement\.ullMovementInferred/);
  assert.match(auditService,/SELECT f\.id,f\.date,f\.starts/);
  assert.match(auditService,/starts:row\.starts/);
  assert.match(auditService,/ullMovementInferred:movement\.ullMovementInferred/);
});
