import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildCustomRecencyAudit,buildRecencyAudit,movementEvidenceIssue,type RecencyAuditFlight } from "../lib/recency-audit.ts";
import { evaluateLaplA,parseRecencyEvidence,type CustomRecencyRule } from "../lib/recency-engine.ts";
import { evaluatePassengerLandingIndicator } from "../lib/recency-landing-indicator.ts";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(partial:Partial<RecencyAuditFlight>={}):RecencyAuditFlight=>({id:1,date:"2026-08-20",evidence:"EASA",registration:"OK-ABC",aircraftClass:"SEP",role:"PIC",departure:"LKLT",arrival:"LKBE",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...partial});

test("v1.35.4 expandable audit evidence remains wired into recency cards",()=>{
  assert.match(JSON.parse(read("package.json")).version,/^1[.]35[.]/);
  const panel=read("components/recency-panel.tsx"),service=read("lib/recency-audit-service.ts"),layout=read("app/layout.tsx"),roadmap=read("ROADMAP.md");
  assert.match(panel,/Evidence detail/);assert.match(panel,/Leaves window/);assert.match(panel,/Open flight/);assert.match(panel,/getRecencyAuditForUser/);
  assert.match(service,/SELECT f[.]id,f[.]date/);assert.match(service,/f[.]certified_at IS NOT NULL/);
  assert.match(layout,/v1354-recency-audit[.]css/);assert.match(roadmap,/FSTD recency evidence deferred/i);
});

test("legacy movement consistency helper remains available without driving the everyday UI",()=>{
  const inconsistent=flight({takeoffsDay:1,approachesDay:1,landingsDay:2});
  assert.match(movementEvidenceIssue(inconsistent),/do not reconcile/);
  assert.equal(movementEvidenceIssue(flight()),"");
  assert.match(movementEvidenceIssue(flight({takeoffsDay:2,approachesDay:1,landingsDay:2})),/Approaches/);
});

test("FCL.060 audit now shows only contributing landing records and their drop-off dates",()=>{
  const flights=[flight({id:1,date:"2026-08-20"}),flight({id:2,date:"2026-08-18"}),flight({id:3,date:"2026-08-15"}),flight({id:4,date:"2026-08-10",landingsDay:2}),flight({id:5,date:"2026-08-12",movementEvidenceRecorded:false})];
  const evaluation=evaluatePassengerLandingIndicator(flights,"SEP",false,"2026-08-28","day"),audit=buildRecencyAudit(evaluation,flights,[],"2026-08-28");
  assert.equal(evaluation.status,"current");assert.deepEqual(evaluation.requirements.map(item=>item.label),["Landings"]);assert.equal(audit.totalRows,5);assert.equal(audit.confirmedCount,5);assert.equal(audit.limitedCount,0);assert.equal(audit.issueCount,0);
  const row=audit.rows.find(item=>item.id==="flight:1");assert.equal(row?.dropOffDate,"2026-11-18");assert.equal(row?.href,"/flights/1");assert.doesNotMatch(row?.detail??"",/T\/O|APP/);
});

test("LAPL audit exposes contributing flight and examiner evidence separately",()=>{
  const flights=[flight({id:11,date:"2026-08-01",evidence:"ULL",aircraftClass:"ULL",minutes:90,landingsDay:2})],evidence=parseRecencyEvidence([{id:"pc",kind:"LAPL_PROFICIENCY_CHECK",aircraftClass:"SEP",date:"2026-08-02",minutes:0,signer:"FE Example",reference:"PC-1"}]),evaluation=evaluateLaplA(flights,"2026-08-28",evidence),audit=buildRecencyAudit(evaluation,flights,evidence,"2026-08-28");
  assert.equal(audit.totalRows,2);assert.equal(audit.rows.some(item=>item.source==="flight"&&item.href==="/flights/11"),true);assert.equal(audit.rows.some(item=>item.source==="evidence"&&/proficiency check/i.test(item.title)),true);
});

test("custom rule audit lists only records that actually contribute to the selected metric",()=>{
  const rule:CustomRecencyRule={id:"club",label:"Club",windowDays:30,metric:"night_landings",target:1,evidence:"EASA",aircraftClass:"SEP",role:"PIC"},flights=[flight({id:21,date:"2026-08-20",landingsNight:1}),flight({id:22,date:"2026-08-19",landingsNight:0}),flight({id:23,date:"2026-07-01",landingsNight:4})],audit=buildCustomRecencyAudit(rule,flights,"2026-08-28");
  assert.equal(audit.totalRows,1);assert.equal(audit.rows[0]?.id,"flight:21");assert.equal(audit.rows[0]?.dropOffDate,"2026-09-19");
});
