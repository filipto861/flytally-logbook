import assert from "node:assert/strict";
import test from "node:test";
import { dashboardLaplIndicator } from "../lib/dashboard-lapl-overview.ts";
import type { RecencyFlight } from "../lib/recency-engine.ts";

const day="2026-10-25";
const flight=(overrides:Partial<RecencyFlight>={}):RecencyFlight=>({
  date:"2026-10-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",
  minutes:60,landingsDay:1,landingsNight:0,
  movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,
  approachesDay:1,approachesNight:0,...overrides,
});
const refresher=flight({
  role:"DUAL",instructorSigned:true,purposeCode:"LAPL_FCL140A_REFRESHER",
  takeoffsDay:0,landingsDay:0,approachesDay:0,
});
const proficiency={
  id:"check-1",kind:"LAPL_PROFICIENCY_CHECK",aircraftClass:"SEP",
  date:"2026-10-20",minutes:0,signer:"Examiner",reference:"Synthetic check",note:"",
};

test("FCL.140.A CURRENT comes from 2-year certified experience and a signed refresher",()=>{
  const experience=Array.from({length:12},()=>flight());
  const result=dashboardLaplIndicator([...experience,refresher],day,[]);
  assert.equal(result.status,"CURRENT");
  assert.equal(result.tone,"neutral");
  assert.match(result.detail,/Current/);
  assert.ok(result.forecastDate);
});

test("complete but insufficient FCL.140.A flight evidence is NOT CURRENT",()=>{
  const result=dashboardLaplIndicator([flight()],day,[]);
  assert.equal(result.status,"NOT CURRENT");
  assert.equal(result.tone,"danger");
  assert.equal(result.forecastDate,null);
});

test("missing movement evidence is UNVERIFIED, never a false negative or positive",()=>{
  const result=dashboardLaplIndicator([flight({movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0})],day,[]);
  assert.equal(result.status,"UNVERIFIED");
  assert.equal(result.tone,"muted");
});

test("valid user-recorded examiner alternative can support CURRENT without flight hours",()=>{
  const result=dashboardLaplIndicator([],day,[proficiency]);
  assert.equal(result.status,"CURRENT");
  assert.match(result.detail,/proficiency check/i);
});

test("malformed saved proficiency evidence cannot produce CURRENT or NOT CURRENT",()=>{
  assert.equal(dashboardLaplIndicator([flight()],day,"{not-json").status,"UNVERIFIED");
  assert.equal(dashboardLaplIndicator([flight()],day,[{...proficiency,date:"2026-02-31"}]).status,"UNVERIFIED");
  assert.equal(dashboardLaplIndicator([flight()],day,[proficiency,{...proficiency,id:"check-1"}]).status,"UNVERIFIED");
});

test("invalid flight date or assessment date cannot produce a positive recency badge",()=>{
  assert.equal(dashboardLaplIndicator([flight({date:"2026-02-31"})],day,[]).status,"UNVERIFIED");
  assert.equal(dashboardLaplIndicator([flight()],"bad",[]).status,"UNVERIFIED");
});
