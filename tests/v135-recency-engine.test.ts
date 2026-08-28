import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { credentialValidity } from "../lib/credential-validity.ts";
import { evaluateCustomRule,evaluateLaplMetrics,evaluatePassengerCurrency,parseCustomRecencyRules,type RecencyFlight } from "../lib/recency-engine.ts";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(partial:Partial<RecencyFlight>):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...partial});

test("v1.35 selectable built-in monitors and custom rules remain supported",()=>{
  assert.match(JSON.parse(read("package.json")).version,/^1[.]35[.]/);
  const panel=read("components/recency-panel.tsx"),actions=read("app/(protected)/credentials/recency-actions.ts"),service=read("lib/recency-service.ts");
  assert.match(read("app/(protected)/credentials/page.tsx"),/RecencyPanel/);
  assert.match(panel,/saveRecencyMonitors/);
  assert.match(service,/hasSep&&hasNight/);
  assert.match(service,/sep-passenger-night/);
  assert.match(actions,/recency_monitors/);
  assert.match(read("app/layout.tsx"),/v135-recency[.]css/);
});

test("LAPL FCL.140.A threshold evaluation reports exact missing requirements",()=>{
  const current=evaluateLaplMetrics({flightMinutes:720,landings:12,refresherMinutes:60});assert.equal(current.status,"current");
  const short=evaluateLaplMetrics({flightMinutes:600,landings:10,refresherMinutes:30});assert.equal(short.status,"not-current");assert.match(short.summary,/Flight time/);assert.match(short.summary,/Take-offs \/ landings/);assert.match(short.summary,/Instructor refresher/);
});

test("FCL.060 profile distinguishes day passenger currency and night IR exemption",()=>{
  const flights=[flight({}),flight({date:"2026-08-19"}),flight({date:"2026-08-18"})];
  const noIr=evaluatePassengerCurrency(flights,"SEP",false,"2026-08-28");assert.equal(noIr.status,"attention");
  const ir=evaluatePassengerCurrency(flights,"SEP",true,"2026-08-28");assert.equal(ir.status,"current");
  const stale=evaluatePassengerCurrency([flight({date:"2026-01-01",landingsDay:5,takeoffsDay:5,approachesDay:5})],"SEP",false,"2026-08-28");assert.equal(stale.status,"not-current");
});

test("custom rolling rules validate, filter and evaluate certified-flight metrics",()=>{
  const rules=parseCustomRecencyRules([{id:"club",label:"Club currency",windowDays:30,metric:"flight_hours",target:2,evidence:"ULL",aircraftClass:"ULL",role:"PIC"},{id:"bad",label:"",metric:"oops",target:0}]);assert.equal(rules.length,1);
  const result=evaluateCustomRule(rules[0],[flight({evidence:"ULL",aircraftClass:"ULL",minutes:75}),flight({date:"2026-08-10",evidence:"ULL",aircraftClass:"ULL",minutes:60}),flight({evidence:"EASA",minutes:500})],"2026-08-28");assert.equal(result.status,"current");assert.equal(result.requirements[0].current,2.25);
});

test("date validity warns inside the configured warning window",()=>{
  assert.equal(credentialValidity({mode:"date",validUntil:"2026-09-10",warningDays:30},"2026-08-28").status,"warning");
  assert.equal(credentialValidity({mode:"date",validUntil:"2027-01-01",warningDays:30},"2026-08-28").status,"valid");
  assert.equal(credentialValidity({mode:"date",validUntil:"2026-08-01",warningDays:30},"2026-08-28").status,"expired");
});
