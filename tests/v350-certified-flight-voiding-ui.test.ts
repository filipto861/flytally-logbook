import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("certified flight detail exposes a destructive Remove certified flight action only for certified records",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(page,/voidCertifiedFlight\.bind\(null,id\)/);
  assert.match(page,/certified\?<VoidCertifiedFlightButton action=\{voidCertified\}/);
  assert.match(page,/Audit history/);
});

test("certified removal confirmation explains active-logbook exclusion and requires a reason",()=>{
  const component=read("components/void-certified-flight-button.tsx");
  assert.match(component,/Remove certified flight/);
  assert.match(component,/no longer appear in Flights, totals, statistics, map, exports or recency\/compliance calculations/);
  assert.match(component,/original certification, revision history and removal reason stay permanently preserved/);
  assert.match(component,/textarea name="reason" minLength=\{8\} maxLength=\{1000\} required/);
  assert.match(component,/aria-busy=\{pending\|\|undefined\}/);
  assert.match(component,/disabled=\{pending\}/);
});

test("successful certified removal redirects server-side to the active flight list with a permanent audit link",()=>{
  const component=read("components/void-certified-flight-button.tsx");
  const action=read("app/(protected)/flights/certification-actions.ts");
  const flights=read("app/(protected)/flights/page.tsx");
  assert.doesNotMatch(component,/useRouter|router\.replace|useEffect/);
  assert.match(action,/redirect\(\`\/flights\?voided=1&audit=\$\{result\.tombstoneId\}\`\)/);
  assert.match(flights,/Certified flight removed from the active logbook/);
  assert.match(flights,/View permanent audit record/);
  assert.match(flights,/\/audit\/voided-flights\/\$\{Number\(audit\)\}/);
});
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
