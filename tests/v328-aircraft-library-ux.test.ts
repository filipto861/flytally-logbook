import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manager=fs.readFileSync("components/aircraft-manager.tsx","utf8");
const page=fs.readFileSync("app/(protected)/database/page.tsx","utf8");
const actions=fs.readFileSync("app/(protected)/database/actions.ts","utf8");
const data=fs.readFileSync("lib/data/database.ts","utf8");

test("v3.2 U8 exposes safe permanent aircraft deletion",()=>{
  assert.match(page,/deleteAction=\{deleteAircraftWithResult\}/);
  assert.match(manager,/Delete aircraft…/);
  assert.match(manager,/Delete permanently/);
  assert.match(manager,/selectedFlightCount>0/);
  assert.match(actions,/export async function deleteAircraftWithResult/);
  assert.match(actions,/SELECT COUNT\(\*\)::int count FROM flights/);
  assert.match(actions,/Deactivate it instead so your logbook history stays intact/);
  assert.match(actions,/DELETE FROM rates/);
  assert.match(actions,/DELETE FROM aircraft/);
});

test("v3.2 U8 supplies aircraft flight usage to the delete guard",()=>{
  assert.match(data,/COALESCE\(flight_stats\.flight_count,0\)::int flight_count/);
  assert.match(data,/COUNT\(\*\)::int flight_count FROM flights/);
});
