import test from "node:test";
import assert from "node:assert/strict";
import { blockingComplianceIssues,complianceReady,fcl050FlightCompliance,fstdCompliance } from "../lib/fcl050-compliance.ts";

const flight=(overrides:Record<string,unknown>={})=>({
  evidence:"EASA",date:"2026-08-24",registration:"OK-ABC",aircraft_make:"Bristell",aircraft_model:"B23",aircraft_variant:"",aircraft_type:"B23",aircraft_class:"SEP",
  departure:"LKLT",arrival:"LKBE",off_block:"08:00",takeoff:"08:05",landing:"08:55",on_block:"09:00",operation_type:"SP",engine_type:"SE",
  starts:1,landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,
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
    const codes=blockingComplianceIssues(issues).map(item=>item.code);
    assert.ok(codes.includes("pic_name"));
    assert.ok(codes.includes("supervising_pilot"));
    assert.ok(codes.includes("supervising_signature"));
  }
});

test("SPIC and PICUS are allocated to PIC when countersigned",()=>{
  for(const role of ["SPIC","PICUS"]){
    const issues=fcl050FlightCompliance(flight({role,verification_name:"Supervising PIC",verification_reference:"Signed ref 123"}),"Test Pilot");
    assert.equal(blockingComplianceIssues(issues).length,0);
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

test("pilot role must match the FCL.050 function-time allocation",()=>{
  const wrongPic=fcl050FlightCompliance(flight({role:"DUAL",pic_minutes:60,dual_minutes:0,instructor:"Instructor"}),"Student Pilot");
  assert.ok(blockingComplianceIssues(wrongPic).some(item=>item.code==="function_time_allocation"));
  const correctDual=fcl050FlightCompliance(flight({role:"DUAL",pic_minutes:0,dual_minutes:60,instructor:"Instructor"}),"Student Pilot");
  assert.equal(blockingComplianceIssues(correctDual).some(item=>item.code==="function_time_allocation"),false);
  const correctInstructor=fcl050FlightCompliance(flight({role:"INSTRUCTOR",pic_minutes:60,instructor_minutes:60}),"Instructor Pilot");
  assert.equal(blockingComplianceIssues(correctInstructor).some(item=>item.code==="function_time_allocation"),false);
  const wrongCrcp=fcl050FlightCompliance(flight({role:"CRUISE-RELIEF CO-PILOT",pic_minutes:60,copilot_minutes:0,commander:"Captain"}),"Relief Pilot");
  assert.ok(blockingComplianceIssues(wrongCrcp).some(item=>item.code==="function_time_allocation"));
});

test("day and night landing columns must reconcile with the landing total",()=>{
  const issues=fcl050FlightCompliance(flight({starts:2,landings_day:1,landings_night:0}),"Test Pilot");
  assert.ok(blockingComplianceIssues(issues).some(item=>item.code==="landing_total"));
});

test("auxiliary safety pilot record can be certified but is non-creditable",()=>{
  const issues=fcl050FlightCompliance(flight({role:"SAFETY PILOT",pic_minutes:0,commander:"Actual PIC"}),"Test Pilot");
  assert.equal(blockingComplianceIssues(issues).length,0);
  assert.ok(issues.some(item=>item.code==="non_creditable_role"&&item.severity==="warning"));
  assert.equal(complianceReady(issues),true);
});

test("auxiliary record cannot contain creditable pilot-function time",()=>{
  const issues=fcl050FlightCompliance(flight({role:"SAFETY PILOT",pic_minutes:60,commander:"Actual PIC"}),"Test Pilot");
  assert.ok(blockingComplianceIssues(issues).some(item=>item.code==="auxiliary_function_time"));
});

test("FSTD requires qualification, instruction and session time",()=>{
  assert.equal(blockingComplianceIssues(fstdCompliance({session_date:"2026-08-24",device_type:"FNPT II",qualification_number:"Q1234",instruction:"IR training",total_minutes:90})).length,0);
  const issues=blockingComplianceIssues(fstdCompliance({session_date:"2026-08-24",device_type:"FNPT II",qualification_number:"",instruction:"",total_minutes:0}));
  assert.deepEqual(issues.map(item=>item.code),["fstd_qualification","fstd_instruction","fstd_time"]);
});
