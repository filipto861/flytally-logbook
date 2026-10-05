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
