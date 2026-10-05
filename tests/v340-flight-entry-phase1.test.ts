import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flightPurposeApplicable } from "../lib/flight-purpose.ts";
import { parseFlightInput } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function baseForm(overrides:Record<string,string>={}){
  const form=new FormData();
  const values={
    date:"2026-10-05",
    registration:"OK-TEST",
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    aircraftType:"Test Type",
    role:"DUAL",
    instructor:"Test Instructor",
    offBlock:"10:00",
    takeoff:"10:05",
    landing:"10:55",
    onBlock:"11:00",
    landingsDay:"1",
    landingsNight:"0",
    purposeSelectionPresent:"yes",
    task:"",
    ...overrides,
  };
  for(const [key,value] of Object.entries(values))form.set(key,value);
  return form;
}

test("3.4.0 Phase 1 uses one fail-closed Training-purpose applicability contract",()=>{
  assert.equal(flightPurposeApplicable("AIRCRAFT_DIFFERENCES",{regulatoryCategory:"ULL",role:"DUAL",instructor:"FI"}),true);
  assert.equal(flightPurposeApplicable("LAPL_FCL140A_REFRESHER",{regulatoryCategory:"ULL",role:"DUAL",instructor:"FI"}),false);
  assert.equal(flightPurposeApplicable("LAPL_FCL140A_REFRESHER",{regulatoryCategory:"AEROPLANE",role:"DUAL",instructor:"FI"}),true);
  assert.equal(flightPurposeApplicable("LAPL_H_FCL140H_REFRESHER",{regulatoryCategory:"AEROPLANE",role:"DUAL",instructor:"FI"}),false);
  assert.equal(flightPurposeApplicable("AIRCRAFT_FAMILIARISATION",{regulatoryCategory:"AEROPLANE",role:"PIC",instructor:"FI"}),true);
  assert.equal(flightPurposeApplicable("SEP_TMG_FCL740A_REFRESHER",{regulatoryCategory:"AEROPLANE",role:"PIC",instructor:"FI"}),false);
  assert.equal(flightPurposeApplicable("AIRCRAFT_DIFFERENCES",{regulatoryCategory:"AEROPLANE",role:"PIC",instructor:""}),false);
  assert.equal(flightPurposeApplicable("BPL_BFCL160_TRAINING",{regulatoryCategory:"OTHER",role:"DUAL",instructor:"FI"}),false);
});

test("3.4.0 new ULL entry cannot persist a non-applicable Part-FCL Training purpose",()=>{
  const form=baseForm({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"});
  form.append("purposeCode","LAPL_FCL140A_REFRESHER");
  form.set("task","Circuits");
  const parsed=parseFlightInput(form);
  assert.ok(parsed.data);
  assert.equal(parsed.data?.purposeCode,"");
  assert.equal(parsed.data?.task,"Circuits");
});

test("3.4.0 applicable DUAL purpose remains canonical",()=>{
  const form=baseForm();
  form.append("purposeCode","LAPL_FCL140A_REFRESHER");
  form.set("task","Circuits");
  const parsed=parseFlightInput(form);
  assert.ok(parsed.data);
  assert.equal(parsed.data?.purposeCode,"LAPL_FCL140A_REFRESHER");
  assert.equal(parsed.data?.task,"FCL.140.A refresher training · Circuits");
});

test("3.4.0 trusted stored purpose can survive later non-applicable edit context until explicitly cleared",()=>{
  const form=baseForm({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"});
  form.append("purposeCode","LAPL_FCL140A_REFRESHER");
  form.set("task","Circuits");
  form.append("existingPurposeCode","LAPL_FCL140A_REFRESHER");

  const untrusted=parseFlightInput(form);
  assert.equal(untrusted.data?.purposeCode,"");

  const trusted=parseFlightInput(form,{existingPurposeCodes:["LAPL_FCL140A_REFRESHER"]});
  assert.equal(trusted.data?.purposeCode,"LAPL_FCL140A_REFRESHER");
  assert.equal(trusted.data?.task,"FCL.140.A refresher training · Circuits");

  form.delete("purposeCode");
  const cleared=parseFlightInput(form,{existingPurposeCodes:["LAPL_FCL140A_REFRESHER"]});
  assert.equal(cleared.data?.purposeCode,"");
  assert.equal(cleared.data?.task,"Circuits");
});

test("3.4.0 picker and update path both consume the shared applicability contract",()=>{
  const picker=read("components/flight-purpose-picker.tsx");
  const form=read("components/flight-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");

  assert.match(picker,/flightPurposeApplicable/);
  assert.doesNotMatch(picker,/const visiblePurpose=/);
  assert.match(form,/role=\{role\} instructor=\{instructorValue\}/);
  assert.match(actions,/COALESCE\(purpose_code,''\) purpose_code/);
  assert.match(actions,/existingPurposeCodes=normalizeFlightPurposeCodes/);
  assert.match(actions,/parseFlightInput\(form,\{existingPurposeCodes\}\)/);
});


test("3.4.0 Phase 2 removes fake GPS wizard chrome and collapses clean-track/context detail",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.doesNotMatch(gps,/className="entry-progress"/);
  assert.doesNotMatch(gps,/className="import-step"/);
  assert.match(gps,/className="entry-section gps-track-review" open=\{gpsReviewNeedsAttention\}/);
  assert.match(gps,/parts\.length===1&&!cuts\.length/);
  assert.match(gps,/Split into multiple flights/);
  assert.match(gps,/className="entry-section gps-flight-context" open=\{flightContextNeedsAttention\}/);
  assert.match(gps,/regulatoryContextLabel/);
  assert.match(gps,/FLIGHT DETAILS/);
});


test("3.4.0 replaces the generic GPS review checkbox with a targeted quality acknowledgement",()=>{
  const gps=read("components/kml-import-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");

  assert.doesNotMatch(gps,/part_\$\{index\}_reviewed/);
  assert.doesNotMatch(gps,/I reviewed this flight/);
  assert.doesNotMatch(gps,/review\.reviewed|reviewed:false/);
  assert.match(gps,/name="gpsWarningReviewed"/);
  assert.match(gps,/I reviewed the GPS quality warning/);
  assert.match(gps,/gpsQualityNeedsAcknowledgement/);

  assert.doesNotMatch(actions,/was not reviewed/);
  assert.doesNotMatch(actions,/part_\$\{index\}_reviewed/);
  assert.match(actions,/gpsQualityNeedsReview=trackQuality\(points\)\.status!=="good"/);
  assert.match(actions,/form\.get\("gpsWarningReviewed"\)/);
  assert.match(actions,/Review the GPS quality warning before saving this import/);
});

test("3.4.0 Phase 2 keeps the clean GPS path compact and truthful",()=>{
  const gps=read("components/kml-import-form.tsx");

  assert.doesNotMatch(gps,/GPS track quality: good/);
  assert.match(gps,/Complete flight details/);
  assert.match(gps,/Save draft/);assert.match(gps,/Save &amp; certify flight/);
  assert.match(gps,/Save \$\{partCount\} flight drafts/);
  assert.match(gps,/data-ready=\{sourceReady&&credible\?"true":"false"\}/);
  assert.match(gps,/flight-review-card\[data-ready="false"\]/);
});

test("3.4.0 Phase 3 keeps Billing secondary to regulatory flight context",()=>{
  const gps=read("components/kml-import-form.tsx");

  assert.match(gps,/className="entry-section entry-section-optional gps-cost-details"/);
  assert.match(gps,/billingSummary=billing==="INVALID"\?"Needs configuration"/);
  assert.match(gps,/Resolve the stored aircraft billing setting/);

  const contextAssignment=gps.match(/flightContextSummary=selectedProfile\?compactContextSummary\(\[([^\]]+)\]\)/)?.[1]??"";
  assert.doesNotMatch(contextAssignment,/Billing|billing/);
});


test("3.4.0 single GPS import exposes draft first and explicit certification second",()=>{
  const gps=read("components/kml-import-form.tsx");
  const actions=read("app/(protected)/flights/actions.ts");

  const submitStart=gps.indexOf("function Submit");
  const submitEnd=gps.indexOf("function AirportReviewField",submitStart);
  const submit=gps.slice(submitStart,submitEnd);
  const draftIndex=submit.indexOf('name="intent" value="draft"');
  const certifyIndex=submit.indexOf('name="intent" value="certify"');
  assert.ok(draftIndex>=0&&certifyIndex>draftIndex,"GPS implicit submit must resolve to draft before explicit certification.");
  assert.match(submit,/partCount===1/);
  assert.match(submit,/Save &amp; certify flight/);
  assert.match(submit,/Save \$\{partCount\} flight drafts/);

  assert.match(actions,/completionIntent=String\(form\.get\("intent"\)\|\|"draft"\)/);
  assert.match(actions,/completionIntent==="certify"&&partCount!==1/);
  assert.match(actions,/Multi-flight GPS imports are saved as drafts/);
  assert.match(actions,/completionIntent==="certify"&&prepared\.length===1/);
  assert.match(actions,/certifyStoredFlight\(userId,lastId\)/);
});

test("3.4.0 single GPS completion summary exposes certification evidence",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/gps-certification-summary/);
  for(const label of ["Flight","Aircraft / role","UTC times","Evidence"])assert.ok(gps.includes(`<span>${label}</span>`),label);
  assert.match(gps,/Certified flights are locked; later changes are recorded as corrections\./);
});

test("3.4.0 flight detail uses the same category-aware certification blocker contract as direct certification",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(detail,/flightCertificationCompliance\(raw,pilotName\)/);
  assert.match(detail,/blockingComplianceIssues\(certificationCompliance\)/);
  assert.match(detail,/blockers:certificationBlockers\.length/);
  assert.match(detail,/disabled=\{certificationBlockers\.length>0\}/);
  assert.doesNotMatch(detail,/fcl050FlightCompliance\(raw,pilotName\)/);
});


test("3.4.0 browser fixture includes credential and recency dependencies used by protected flight pages",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");

  for(const table of ["pilot_licences","pilot_qualifications","user_expiries","spl_recency_evidence","helicopter_recency_evidence","bpl_recency_evidence"]){
    assert.match(bootstrap,new RegExp(`CREATE TABLE ${table}\\(`));
  }
  const flightsTable=bootstrap.match(/CREATE TABLE flights\([\s\S]*?\n\);/)?.[0]??"";
  assert.match(flightsTable,/date TEXT NOT NULL/);
  assert.doesNotMatch(flightsTable,/date DATE NOT NULL/);
  for(const column of ["qualification_type","qualification_family","regulatory_category","qualification_scope","privilege_role","classification_source","validity_mode","valid_until","recency_until"]){
    assert.match(bootstrap,new RegExp(`\\b${column}\\b`));
  }
  assert.match(bootstrap,/generate_series\(1,19\)/);
  assert.match(bootstrap,/default_operation_type TEXT CHECK\(default_operation_type IS NULL OR default_operation_type IN \('SP','MP'\)\)/);
  assert.match(bootstrap,/default_engine_type TEXT CHECK\(default_engine_type IS NULL OR default_engine_type IN \('SE','ME'\)\)/);
  assert.match(bootstrap,/CREATE TRIGGER trg_logbook_snapshot_aircraft_identity/);
});
