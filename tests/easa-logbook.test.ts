import test from "node:test";
import assert from "node:assert/strict";
import {allocatedFunctionTimes,defaultEngineType,durationMinutes,formatEasaDuration} from "../lib/easa-logbook.ts";

test("EASA duration fields accept H:MM and remain bounded",()=>{
  assert.equal(durationMinutes("1:25"),85);
  assert.equal(durationMinutes("99:00"),1440);
  assert.equal(formatEasaDuration(85),"1:25");
});

test("pilot function allocation follows the selected FCL.050 role",()=>{
  assert.deepEqual(allocatedFunctionTimes("PIC",75),{picMinutes:75,copilotMinutes:0,dualMinutes:0,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("SOLO",75),{picMinutes:75,copilotMinutes:0,dualMinutes:0,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("CO-PILOT",75),{picMinutes:0,copilotMinutes:75,dualMinutes:0,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("CRUISE-RELIEF CO-PILOT",75),{picMinutes:0,copilotMinutes:75,dualMinutes:0,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("DUAL",75),{picMinutes:0,copilotMinutes:0,dualMinutes:75,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("INSTRUCTOR",75),{picMinutes:75,copilotMinutes:0,dualMinutes:0,instructorMinutes:75});
});

test("aircraft class supplies a conservative engine default",()=>{
  assert.equal(defaultEngineType("MEP"),"ME");
  assert.equal(defaultEngineType("SEP"),"SE");
});
