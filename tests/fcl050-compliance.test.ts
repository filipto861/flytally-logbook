import test from "node:test";
import assert from "node:assert/strict";
import { blockingComplianceIssues,complianceReady,fcl050FlightCompliance,fstdCompliance } from "../lib/fcl050-compliance.ts";

const flight=(overrides:Record<string,unknown>={})=>({
  evidence:"EASA",date:"2026-08-24",registration:"OK-ABC",aircraft_make:"Bristell",aircraft_model:"B23",aircraft_variant:"912iS",aircraft_type:"B23",aircraft_class:"SEP",
  departure:"LKLT",arrival:"LKBE",off_block:"08:00",takeoff:"08:05",landing:"08:55",on_block:"09:00",operation_type:"SP",engine_type:"SE",
  landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,
  commander:"",instructor:"",role:"PIC",task:"Local flight",note:"",verification_name:"",verification_reference:"",block_minutes:60,...overrides
});

test("complete EASA flight is ready for certification",()=>{
  const issues=fcl050FlightCompliance(flight(),"Test Pilot");
  assert.equal(blockingComplianceIssues(issues).length,0);
  assert.equal(complianceReady(issues),true);
});

test("aircraft variant is optional when no separate variant applies",()=>{
  const issues=fcl050FlightCompliance(flight({aircraft_variant:""}),"Test Pilot");
  assert.equal(blockingComplianceIssues(issues).some(item=>item.code==="aircraft_variant"),false);
  assert.equal(complianceReady(issues),true);
});

test("SPIC and PICUS require countersignature details",()=>{
  for(const role of ["SPIC","PICUS"]){
    const issues=fcl050FlightCompliance(flight({role,verification_name:"",verification_reference:""}),"Test Pilot");
    assert.deepEqual(blockingComplianceIssues(issues).map(item=>item.code).filter(code=>code.startsWith("supervising_")),["supervising_pilot","supervising_signature"]);
  }
});

test("ordinary EASA roles do not require generic countersignature fields",()=>{
  const issues=fcl050FlightCompliance(flight({role:"PIC",task:"SEP revalidation",verification_name:"",verification_reference:""}),"Test Pilot");
  assert.equal(blockingComplianceIssues(issues).some(item=>item.field==="verification_name"||item.field==="verification_reference"),false);
  assert.ok(issues.some(item=>item.code==="revalidation_endorsement"&&item.severity==="warning"));
});

test("dual flight requires instructor PIC name",()=>{
  const issues=fcl050FlightCompliance(flight({role:"DUAL",pic_minutes:0,dual_minutes:60,instructor:"",commander:""}),"Student Pilot");
  assert.ok(blockingComplianceIssues(issues).some(item=>item.code==="dual_instructor"));
  assert.ok(blockingComplianceIssues(issues).some(item=>item.code==="pic_name"));
});

test("auxiliary safety pilot role is not certifiable as FCL.050 pilot time",()=>{
  const issues=fcl050FlightCompliance(flight({role:"SAFETY PILOT",pic_minutes:0}),"Test Pilot");
  assert.ok(blockingComplianceIssues(issues).some(item=>item.code==="pilot_function"));
});

test("FSTD requires qualification, instruction and session time",()=>{
  assert.equal(blockingComplianceIssues(fstdCompliance({session_date:"2026-08-24",device_type:"FNPT II",qualification_number:"Q1234",instruction:"IR training",total_minutes:90})).length,0);
  const issues=blockingComplianceIssues(fstdCompliance({session_date:"2026-08-24",device_type:"FNPT II",qualification_number:"",instruction:"",total_minutes:0}));
  assert.deepEqual(issues.map(item=>item.code),["fstd_qualification","fstd_instruction","fstd_time"]);
});
