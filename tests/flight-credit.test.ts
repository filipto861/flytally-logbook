import test from "node:test";
import assert from "node:assert/strict";
import {effectivePicMinutes,normalizedPilotRole} from "../lib/flight-credit.ts";

test("explicit pilot roles are not overwritten by an instructor name",()=>{
  assert.equal(normalizedPilotRole("PICUS","Instructor"),"PICUS");
  assert.equal(normalizedPilotRole("INSTRUCTOR","Instructor"),"INSTRUCTOR");
  assert.equal(normalizedPilotRole("STUDENT","Instructor"),"DUAL");
  assert.equal(normalizedPilotRole("","Instructor"),"DUAL");
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
