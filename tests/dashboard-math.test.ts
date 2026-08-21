import test from "node:test";
import assert from "node:assert/strict";
import { flightDateKey,flightMinutes } from "../lib/dashboard-math.ts";

test("dashboard accepts ISO and legacy Czech dates",()=>{
  assert.equal(flightDateKey("2026-08-21"),"2026-08-21");
  assert.equal(flightDateKey("21.8.2026"),"2026-08-21");
  assert.equal(flightDateKey("2026-02-30"),null);
  assert.equal(flightDateKey("unknown"),null);
});

test("dashboard calculates flight durations including midnight",()=>{
  assert.equal(flightMinutes("13:18","14:48"),90);
  assert.equal(flightMinutes("23:40","00:20"),40);
  assert.equal(flightMinutes("invalid","14:48"),0);
});
