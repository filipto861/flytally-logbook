import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
test("voided-flight audit route is owner-scoped and read-only",()=>{
  const audit=read("app/(protected)/audit/voided-flights/[id]/page.tsx");
  assert.match(audit,/WHERE v\.id=\$\{id\} AND v\.user_id=\$\{userId\} LIMIT 1/);
  assert.match(audit,/VOIDED CERTIFIED RECORD AUDIT/);
  assert.match(audit,/Not active logbook data/);
  assert.match(audit,/contributes no totals, statistics, map, export or recency\/compliance credit/);
  assert.match(audit,/voidEvidenceSha256\(snapshot\)/);
  assert.match(audit,/verifyFlightCertification\(snapshot,userId\)/);
  assert.doesNotMatch(audit,/startCertifiedCorrection|certifyFlight|voidCertifiedFlight|updateFlight|shareFlight/);
});

test("legacy active-flight audit links fall back to the permanent void audit route",()=>{
  const audit=read("app/(protected)/flights/[id]/audit/page.tsx");
  assert.match(audit,/SELECT id FROM voided_certified_flights WHERE original_flight_id=\$\{id\} AND user_id=\$\{userId\} LIMIT 1/);
  assert.match(audit,/redirect\(.*audit\/voided-flights\/.*tombstoneId/);
});
