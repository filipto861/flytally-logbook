import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F3.5 Manual mutation boundary re-resolves PROFILE and preserves SNAPSHOT server-side",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/aircraftAuthorityProfile\(userId,f\.registration,false\)/);
  assert.match(actions,/authorizeProfileFlightContext\(profile,flightAircraftContextFromForm\(form\)\)/);
  assert.match(actions,/resolveFlightAircraftContextAuthority\(\{mode:"UPDATE",storedRegistration:existing\.registration,submittedRegistration:f\.registration\}\)/);
  assert.match(actions,/authorizeUnchangedSnapshotFlightContext\(storedContext,submittedForSnapshot\)/);
  assert.match(actions,/evidence=\$\{persistedAircraftContext\.evidence\}/);
  assert.match(actions,/regulatory_category=\$\{persistedAircraftContext\.regulatoryCategory\}/);
});

test("F3.5 GPS keeps active PROFILE authority and canonical context persistence",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/aircraftAuthorityProfile\(userId,registration,true\)/);
  assert.match(actions,/authorizeProfileFlightContext\(selectedAircraft,flightAircraftContextFromForm\(form\)\)/);
  assert.match(actions,/authorityProfile=authority\.profile,authorityContext=authority\.context/);
  assert.match(actions,/evidence=authorityContext\.evidence/);
  assert.match(actions,/aircraftClass=authorityContext\.aircraftClass/);
  assert.match(actions,/regulatoryCategory=authorityContext\.regulatoryCategory/);
});

test("F3.5 export regulatory context comes from stored flights rather than mutable aircraft profiles",()=>{
  const route=read("app/api/export/route.ts");
  assert.match(route,/SELECT f\.date,f\.evidence,/);
  assert.match(route,/f\.regulatory_category/);
  assert.match(route,/f\.aircraft_type,f\.aircraft_class/);
  assert.doesNotMatch(route,/JOIN\s+aircraft\s+/i);
});

test("F3.5 Statistics regulatory context comes from stored flights",()=>{
  const data=read("lib/data/pilot-insights.ts");
  assert.match(data,/TRIM\(COALESCE\(f\.aircraft_type,''\)\) aircraft_type/);
  assert.match(data,/UPPER\(TRIM\(COALESCE\(f\.aircraft_class,''\)\)\) aircraft_class/);
  assert.match(data,/UPPER\(TRIM\(COALESCE\(f\.evidence,''\)\)\) evidence/);
  assert.match(data,/COALESCE\(f\.regulatory_category,''\)/);
  assert.match(data,/FROM flights f WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(data,/JOIN\s+aircraft\s+/i);
});

test("F3.5 Print keeps F3 authority context on the flight snapshot",()=>{
  const page=read("app/(protected)/print/page.tsx");
  assert.match(page,/SELECT f\.date,f\.evidence,f\.regulatory_category,f\.registration,f\.aircraft_type,f\.aircraft_make,f\.aircraft_model,f\.aircraft_variant,f\.aircraft_class/);
  assert.match(page,/NULLIF\(TRIM\(a\.icao_type\),''\) icao_type/);
  assert.doesNotMatch(page,/a\.evidence|a\.regulatory_category|a\.aircraft_class|a\.aircraft_type/);
});

test("F3.5 trash restore round-trips raw stored aircraft context without profile validation",()=>{
  const trash=read("lib/flight-trash.ts");
  assert.match(trash,/to_jsonb\(f\)/);
  assert.match(trash,/COALESCE\(flight_data->>'evidence',''\)/);
  assert.match(trash,/COALESCE\(flight_data->>'aircraft_type',''\)/);
  assert.match(trash,/COALESCE\(flight_data->>'aircraft_class',''\)/);
  assert.match(trash,/COALESCE\(flight_data->>'regulatory_category',''\)/);
  assert.match(trash,/COALESCE\(flight_data->>'balloon_class',''\)/);
  assert.match(trash,/COALESCE\(flight_data->>'balloon_group',''\)/);
  assert.doesNotMatch(trash,/validateAircraftProfile|allowedFlightContexts/);
});

test("F3.5 browser aircraft fixture supports the current aircraft mutation schema",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  assert.match(bootstrap,/note TEXT NOT NULL DEFAULT ''/);
  assert.match(bootstrap,/created_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(bootstrap,/updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  assert.match(bootstrap,/UNIQUE\(user_id,registration\)/);
  const flightsBlock=bootstrap.slice(bootstrap.indexOf("CREATE TABLE flights("),bootstrap.indexOf("CREATE TABLE flight_expenses("));
  assert.match(flightsBlock,/price_per_hour NUMERIC DEFAULT 0/);
  assert.doesNotMatch(flightsBlock,/price_per_hour NUMERIC NOT NULL DEFAULT 0/);
});

test("F3.5 Quick Add commits canonical aircraft before refreshing the entry workspace",()=>{
  const quick=read("components/quick-aircraft-form.tsx");
  const actions=read("app/(protected)/database/actions.ts");
  assert.match(quick,/const result=await action\(form\)/);
  assert.match(quick,/if\(result\.ok\)\{router\.refresh\(\);onSaved\?\.\(\)\}/);
  assert.match(actions,/validateAircraftProfile\(\{/);
  assert.match(actions,/await sql\.transaction\(queries\)/);
  assert.match(actions,/Aircraft profile could not be verified after save/);
});

test("F3.5 browser closeout targets historical SNAPSHOT, submit-time PROFILE, A+ and Quick Add",()=>{
  const browser=read("e2e/manual-authority-certification.spec.mjs");
  for(const title of [
    "F3.5 same-registration SNAPSHOT survives invalid current profile and rejects crafted drift",
    "F3.5 PROFILE authority re-resolves on submit and persists only allowed TMG context",
    "F3.5 OTHER and Balloon keep profile-owned context separate from flight-specific choices",
    "F3.5 Quick Add refreshes aircraft authority before immediate flight Save",
  ])assert.ok(browser.includes(title),title);
  assert.match(browser,/browserSqlScalar\(/);
});
