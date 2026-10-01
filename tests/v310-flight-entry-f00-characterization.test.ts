import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { allocatedFunctionTimes } from "../lib/easa-logbook.ts";
import { parseFlightInput,ROLES } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const gpsForm=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");
const flightForm=read("components/flight-form.tsx");
const dashboard=read("lib/data/dashboard.ts");
const insights=read("lib/data/pilot-insights.ts");
const exportRoute=read("app/api/export/route.ts");
const printPage=read("app/(protected)/print/page.tsx");
const recency=read("lib/recency-service.ts");
const characterization=read("docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md");

const importStart=actions.indexOf("export async function importKmlFlight");
const importEnd=actions.indexOf("\nexport async function",importStart+40);
const importAction=actions.slice(importStart,importEnd>importStart?importEnd:actions.length);

function validManualForm(role="PIC"){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-09-30",registration:"OK-F00",aircraftType:"B23",evidence:"EASA",
    aircraftClass:"SEP",regulatoryCategory:"AEROPLANE",role,
    offBlock:"10:00",takeoff:"10:05",landing:"10:55",onBlock:"11:00",
    starts:"1",operationType:"SP",engineType:"SE"
  }))form.set(key,value);
  return form;
}

test("F0.0 preserves the historical fail-open characterization in documentation",()=>{
  assert.match(characterization,/aircraft class → .*\|\| "ULL"/);
  assert.match(characterization,/evidence\/logbook → .*\|\| "ULL"/);
  assert.match(characterization,/form\.get\("evidence"\).*\|\| "ULL"/);
  assert.match(characterization,/form\.get\("aircraftClass"\).*\|\| "ULL"/);
  assert.match(characterization,/This is the confirmed F0\.1 fail-open defect/);
});

test("F0.0 preserves the historical GPS separate-write-path finding in documentation",()=>{
  assert.match(characterization,/GPS import has a separate server write path/);
  assert.match(characterization,/directly inserts `flights` \+ track rows/);
  assert.doesNotMatch(importAction,/parseFlightInput\(/);
  assert.match(importAction,/gpsFlightCandidate\(/);
  assert.match(importAction,/normalizeFlightDraft\(candidate\)/);
});

test("F0.0 preserves the historical GPS role surface and INSTRUKTOR mismatch in documentation",()=>{
  for(const role of ["PIC","DUAL","SAFETY PILOT","CO-PILOT","PAX","OBSERVER"])assert.ok(characterization.includes(`| \`${role}\``));
  assert.match(characterization,/INSTRUKTOR mismatch/);
  assert.equal(ROLES.includes("INSTRUKTOR" as (typeof ROLES)[number]),false);
  assert.equal(ROLES.includes("INSTRUCTOR" as (typeof ROLES)[number]),true);
  assert.deepEqual(allocatedFunctionTimes("INSTRUKTOR",60),{picMinutes:0,copilotMinutes:0,dualMinutes:0,instructorMinutes:0});
  assert.deepEqual(allocatedFunctionTimes("INSTRUCTOR",60),{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:60});
});

test("F0.0 characterizes current Manual role save boundaries before convergence",()=>{
  const dual=validManualForm("DUAL");
  const parsedDual=parseFlightInput(dual);
  assert.equal(parsedDual.error,undefined,"canonical parser currently permits an incomplete DUAL draft");
  assert.equal(parsedDual.data?.instructor,"");
  assert.match(flightForm,/name="instructor"[^>]*required=\{evidence==="EASA"\}/);

  const spic=validManualForm("SPIC");
  assert.equal(parseFlightInput(spic).data,undefined);
  spic.set("verificationName","Supervisor");
  spic.set("verificationReference","Signed ref");
  assert.equal(parseFlightInput(spic).data?.role,"SPIC");

  assert.match(actions,/f\.role==="SAFETY PILOT"&&f\.evidence==="EASA"/);
  assert.match(actions,/Actual PIC|actual PIC|accepted Connection/);
});

test("F0.0 characterizes duplicate protection and one-transaction GPS persistence",()=>{
  assert.match(importAction,/new Set\(prepared\.map\(item=>item\.fingerprint\)\)\.size!==prepared\.length/);
  assert.match(importAction,/At least one reviewed flight already exists\. The duplicate import was blocked\./);
  assert.match(importAction,/pg_advisory_xact_lock\(hashtextextended\(\$\{value\},0\)\)/);
  assert.match(importAction,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(importAction,/WHERE NOT EXISTS\(SELECT 1 FROM flights/);
  assert.match(importAction,/Import failed and the transaction was rolled back\. No partial flights were created\./);
});

test("F0.0 characterizes draft consumers versus certified-only recency",()=>{
  assert.match(dashboard,/FROM flights f WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(dashboard,/f\.certified_at IS NOT NULL/);

  assert.match(insights,/FROM flights f WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(insights,/f\.certified_at IS NOT NULL/);

  assert.match(exportRoute,/f\.certified_at/);
  assert.match(exportRoute,/WHERE f\.user_id=\$\{session\.userId\}/);
  assert.doesNotMatch(exportRoute,/WHERE f\.user_id=\$\{session\.userId\}\s+AND f\.certified_at IS NOT NULL/);

  assert.match(printPage,/f\.certified_at/);
  assert.match(printPage,/WHERE f\.user_id=\$\{userId\}/);
  assert.match(printPage,/if\(!row\.certified_at\)parts\.push\("DRAFT"\)/);
  assert.doesNotMatch(printPage,/WHERE f\.user_id=\$\{userId\}\s+AND f\.certified_at IS NOT NULL/);

  assert.match(recency,/f\.certified_at IS NOT NULL/);
});

test("F0.0 preserves the existing valid PIC semantic allocation baseline",()=>{
  assert.deepEqual(allocatedFunctionTimes("PIC",60),{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:0});
  const parsed=parseFlightInput(validManualForm("PIC"));
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.evidence,"EASA");
  assert.equal(parsed.data?.aircraftClass,"SEP");
  assert.equal(parsed.data?.role,"PIC");
});
