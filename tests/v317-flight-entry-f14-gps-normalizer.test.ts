import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const actions=fs.readFileSync(path.join(root,"app/(protected)/flights/actions.ts"),"utf8");
const start=actions.indexOf("export async function importKmlFlight");
const end=actions.indexOf("\nexport async function",start+40);
const importAction=actions.slice(start,end>start?end:actions.length);

test("F1.4 GPS reviewed parts are routed through the shared candidate and normalizer",()=>{
  assert.match(importAction,/gpsFlightCandidate\(\{/);
  assert.match(importAction,/profile:profileResult\.profile/);
  assert.match(importAction,/operationType,/);
  assert.match(importAction,/engineType,/);
  assert.match(importAction,/reviewedPart:\{/);
  assert.match(importAction,/normalizeFlightDraft\(candidate\)/);
  assert.match(importAction,/const flight=normalized\.data/);
});

test("F1.4 persistence consumes normalized FlightInput semantics rather than reviewed/source variables",()=>{
  assert.match(importAction,/const f=item\.flight;return sql`WITH inserted AS \(/);
  for(const field of [
    "date","evidence","registration","aircraftType","aircraftClass","regulatoryCategory",
    "balloonClass","balloonGroup","balloonOperation","launchMethod","launches",
    "departure","arrival","offBlock","takeoff","landing","onBlock","starts",
    "commander","instructor","role","task","purposeCode","billingBasis","note",
    "operationType","engineType","operatorName","flightNumber","operationContext",
    "landingsDay","landingsNight","movementEvidenceRecorded","takeoffsDay","takeoffsNight",
    "approachesDay","approachesNight","nightMinutes","ifrMinutes",
    "picMinutes","copilotMinutes","dualMinutes","instructorMinutes",
    "verificationName","verificationReference",
  ])assert.match(importAction,new RegExp(`\\$\\{f\\.${field}\\}`),field);

  assert.doesNotMatch(importAction,/item\.values\./);
  assert.doesNotMatch(importAction,/item\.allocation\./);
});

test("F1.4 duplicate identity is built from normalized fields",()=>{
  assert.match(importAction,/flightFingerprint\(userId,\{date:flight\.date,registration:flight\.registration,offBlock:flight\.offBlock,departure:flight\.departure,arrival:flight\.arrival\}\)/);
  assert.match(importAction,/date::text=\$\{item\.flight\.date\}/);
  assert.match(importAction,/UPPER\(TRIM\(registration\)\)=\$\{item\.flight\.registration\}/);
});

test("F1.4 preserves atomic multi-part locking and flight+track transaction",()=>{
  assert.match(importAction,/new Set\(prepared\.map\(item=>item\.fingerprint\)\)\.size!==prepared\.length/);
  assert.match(importAction,/pg_advisory_xact_lock\(hashtextextended\(\$\{value\},0\)\)/);
  assert.match(importAction,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(importAction,/INSERT INTO flight_tracks/);
  assert.match(importAction,/rolled back\. No partial flights were created/);
});

test("F1.4 keeps source-fidelity review before normalization instead of inferring evidence",()=>{
  assert.match(importAction,/needs explicit landing evidence matching the reviewed total/);
  assert.match(importAction,/needs an explicit pilot-flying movement decision/);
  assert.match(importAction,/requires explicit sailplane launch method and count/);
  assert.match(importAction,/Night \/ IFR time cannot exceed BLOCK time/);
  assert.match(importAction,/movementEvidenceRecorded:values\.movementEvidenceRecorded/);
  assert.match(importAction,/launchMethod:values\.launchMethod/);
  assert.match(importAction,/nightTime:values\.nightMinutes/);
});

test("F1.4 keeps GPS role boundary PIC-only",()=>{
  assert.match(importAction,/validateGpsImportRole\(form\.get\("role"\)\)/);
  assert.doesNotMatch(importAction,/connectedPicSelection/);
});
