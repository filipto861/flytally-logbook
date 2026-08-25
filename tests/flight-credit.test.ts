import test from "node:test";
import assert from "node:assert/strict";
import {effectivePicMinutes,includedInDashboardTotal,normalizedPilotRole} from "../lib/flight-credit.ts";

test("explicit pilot roles are not overwritten by an instructor name",()=>{
  assert.equal(normalizedPilotRole("PICUS","Instructor"),"PICUS");
  assert.equal(normalizedPilotRole("INSTRUCTOR","Instructor"),"INSTRUCTOR");
  assert.equal(normalizedPilotRole("STUDENT","Instructor"),"DUAL");
  assert.equal(normalizedPilotRole("","Instructor"),"DUAL");
});

test("dashboard total includes Safety Pilot only as an operational overview",()=>{
  assert.equal(includedInDashboardTotal("PIC"),true);
  assert.equal(includedInDashboardTotal("SAFETY PILOT"),true);
  assert.equal(includedInDashboardTotal("PAX"),false);
  assert.equal(includedInDashboardTotal("OBSERVER"),false);
});

test("PIC credit includes every FCL.050 PIC function and legacy SOLO rows",()=>{
  for(const role of ["PIC","SOLO","SPIC","PICUS","INSTRUCTOR","EXAMINER"]){
    assert.equal(effectivePicMinutes(role,0,60),60,role);
  }
  assert.equal(effectivePicMinutes("DUAL",0,60),0);
  assert.equal(effectivePicMinutes("CO-PILOT",0,60),0);
  assert.equal(effectivePicMinutes("SAFETY PILOT",0,60),0);
  assert.equal(effectivePicMinutes("PIC",45,60),45);
});
