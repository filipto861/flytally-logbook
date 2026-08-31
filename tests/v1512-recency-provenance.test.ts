import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildRecencyAudit,type RecencyAuditFlight } from "../lib/recency-audit.ts";
import { evaluatePassengerCurrencyMode } from "../lib/recency-engine.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(partial:Partial<RecencyAuditFlight>={}):RecencyAuditFlight=>({id:1,date:"2026-08-23",evidence:"EASA",registration:"OK-BID",aircraftClass:"SEP",role:"PIC",departure:"LKKV",arrival:"LKSZ",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...partial});

test("v1.51.2 uses the structured-movement migration boundary in both recency views",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,2));
  for(const file of ["lib/recency-service.ts","lib/recency-audit-service.ts"]){
    const source=read(file);
    assert.match(source,/flight_audit_log created_audit/);
    assert.match(source,/flytally_feature_migrations movement_migration/);
    assert.match(source,/movement_migration[.]migration_key='v1[.]35[.]3-fcl060-structured-movements'/);
    assert.match(source,/created_audit[.]action='created'/);
    assert.match(source,/created_audit[.]changed_at>=movement_migration[.]applied_at/);
    assert.match(source,/resolveMovementCompatibility/);
    assert.doesNotMatch(source,/new_data \? 'movement_evidence_recorded'/);
  }
});

test("legacy-compatible FCL.060 evidence is counted and audited from the same counters",()=>{
  const flights=[
    flight({id:1,date:"2026-08-23"}),
    flight({id:2,date:"2026-08-22"}),
    flight({id:3,date:"2026-07-19",role:"DUAL",legacyMovementInferred:true}),
  ];
  const evaluation=evaluatePassengerCurrencyMode(flights,"SEP",false,"2026-08-31","day"),audit=buildRecencyAudit(evaluation,flights,[],"2026-08-31");
  assert.equal(evaluation.status,"current");
  assert.equal(evaluation.requirements.find(item=>item.id==="takeoffs")?.current,3);
  assert.equal(evaluation.requirements.find(item=>item.id==="approaches")?.current,3);
  assert.equal(evaluation.requirements.find(item=>item.id==="landings")?.current,3);
  assert.equal(audit.totalRows,3);
  assert.equal(audit.confirmedCount,3);
  assert.equal(audit.limitedCount,0);
  assert.match(audit.rows.find(item=>item.id==="flight:3")?.detail??"",/legacy landing compatibility/);
});

test("structured-era missing PF evidence is LIMITED in both calculation and audit",()=>{
  const missing=flight({id:7,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0,landingsDay:1}),evaluation=evaluatePassengerCurrencyMode([missing],"SEP",false,"2026-08-31","day"),audit=buildRecencyAudit(evaluation,[missing],[],"2026-08-31");
  assert.equal(evaluation.status,"attention");
  assert.equal(evaluation.badge,"LIMITED DATA");
  assert.equal(audit.confirmedCount,0);
  assert.equal(audit.limitedCount,1);
  assert.match(audit.rows[0]?.issue??"",/Take-off and approach evidence is unavailable/);
});

test("explicit inconsistent structured movements are REVIEW rather than falsely confirmed",()=>{
  const inconsistent=flight({id:9,movementEvidenceRecorded:true,takeoffsDay:0,approachesDay:0,landingsDay:1}),evaluation=evaluatePassengerCurrencyMode([inconsistent],"SEP",false,"2026-08-31","day"),audit=buildRecencyAudit(evaluation,[inconsistent],[],"2026-08-31");
  assert.notEqual(evaluation.status,"current");
  assert.equal(audit.confirmedCount,0);
  assert.equal(audit.issueCount,1);
  assert.match(audit.rows[0]?.issue??"",/do not reconcile/);
});
