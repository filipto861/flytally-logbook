import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.40.0 record and shared-workflow views remain available on Flights",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,40,0));
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/Advanced filters/);
  assert.match(page,/name="status"/);
  assert.match(page,/name="workflow"/);
  assert.match(page,/<option value="draft">Draft<\/option>/);
  assert.match(page,/<option value="certified">Certified<\/option>/);
  assert.match(page,/<option value="waiting">Waiting for response<\/option>/);
  assert.match(page,/<option value="received">Shared with me<\/option>/);
  assert.match(page,/Official locked logbook record/);
  assert.match(page,/Editable record not yet certified/);
  assert.match(page,/className="flight-route-link"/);
  assert.match(page,/className="flight-open-cta">Open flight/);
  assert.match(page,/className="flight-identity"/);
});

test("v1.40.0 keeps shared state user scoped and N+1 free",()=>{
  const source=read("lib/data/flights-fast.ts"),start=source.indexOf("export async function getFlightsPageFast"),end=source.indexOf("export async function getFlightFilterOptionsFast"),list=source.slice(start,end);
  assert.match(list,/FROM flight_tracks WHERE user_id=\$\{userId\} GROUP BY flight_id/);
  assert.match(list,/FROM flight_participations WHERE source_user_id=\$\{userId\}/);
  assert.match(list,/FROM flight_participations WHERE participant_user_id=\$\{userId\}/);
  assert.match(list,/LEFT JOIN outbound o ON o\.flight_id=f\.id LEFT JOIN received rc ON rc\.flight_id=f\.id/);
  assert.match(list,/WHERE f\.user_id=\$\{userId\}/);
  assert.doesNotMatch(list,/SELECT f\.\*/);
  assert.doesNotMatch(list,/coordinates_json|overview_coordinates_json/);
  assert.doesNotMatch(list,/rows\.map\([^)]*sql`/);
});

test("v1.40.0 record and workflow filters remain consistent in detail navigation",()=>{
  const source=read("lib/data/flights-fast.ts"),navigation=source.slice(source.indexOf("export async function getFlightNavigationFast"));
  assert.match(navigation,/!v\.status&&!v\.workflow/);
  assert.match(navigation,/flight-navigation-filtered/);
  assert.match(navigation,/\$\{status\}='certified'/);
  assert.match(navigation,/\$\{status\}='draft'/);
  assert.match(navigation,/\$\{workflow\}='waiting'/);
  assert.match(navigation,/\$\{workflow\}='received'/);
});

test("v1.40.0 mobile flight cards are scoped away from global navigation",()=>{
  const css=read("app/v140-flights.css"),layout=read("app/layout.tsx");
  assert.match(layout,/v140-flights\.css/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.flights-table \.flight-list-row/);
  assert.doesNotMatch(css,/flight-quick-filters/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|sidebar nav|\.sidebar/);
});

test("v1.40.0 leaves stabilized GPS inference and certification direction unchanged",()=>{
  const roadmap=read("docs/history/ROADMAP_LEGACY_2026-09-26.md"),gps=read("lib/track-processing.ts");
  assert.match(roadmap,/v1\.41\.0: lazy GPS detail payload|v1\.41\.0: lazy GPS detail payload/i);
  assert.match(roadmap,/certification baseline remains unchanged|Certification baseline/i);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(gps,/hasImplausibleAltitudeJump/);
});

test("Flights list exposes equally legible recorded BLOCK and AIR without claiming missing times are zero",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/<th>BLOCK<\/th><th>AIR<\/th>/);
  assert.match(page,/const flightClockPattern=/);
  assert.match(page,/hasCompleteClockPair\(f\.off_block,f\.on_block\)/);
  assert.match(page,/hasCompleteClockPair\(f\.takeoff,f\.landing\)/);
  assert.match(page,/data-label="BLOCK"/);
  assert.match(page,/data-label="AIR"/);
  assert.match(page,/blockKnown\?formatDuration\(f\.block_minutes\):"—"/);
  assert.match(page,/airKnown\?formatDuration\(f\.air_minutes\):"—"/);
  assert.doesNotMatch(page,/loggedMinutes=usesAir/);
  const css=read("app/ui-system.css");
  assert.match(css,/\.flights-table \.flight-list-row \.flight-time-ledger/);
  assert.match(css,/font-variant-numeric:tabular-nums/);
});

test("Flights country decoration uses only the source-backed airport catalog and never ICAO prefix guessing",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/getCatalogAirport\(ident\)\?\.country/);
  assert.match(page,/\/\^\[A-Z\]\{2\}\$\//);
  assert.match(page,/country==="ZZ"\|\|country==="XX"/);
  assert.match(page,/departureFlag=airportFlag\(f\.departure\)/);
  assert.match(page,/arrivalFlag=airportFlag\(f\.arrival\)/);
  assert.match(page,/className="flight-airport-flag" aria-hidden="true"/);
  assert.match(page,/className="flight-route-link"/);
  const catalog=read("lib/airport-catalog.ts");
  assert.match(catalog,/countryAt=at\("iso_country"\)/);
});

test("Flights mobile F2 uses compact scan rows without hiding route, clock provenance or certified status",()=>{
  const css=read("app/ui-system.css");
  const start=css.indexOf("/* Flights F2 — compact phone-only scan cards.");
  assert.ok(start>css.indexOf("/* Flights F1 —"),"F2 overrides must follow the F1 ledger");
  const mobile=css.slice(start);
  assert.match(mobile,/@media\(max-width:700px\)/);
  assert.match(mobile,/\.flights-table \.flight-list-row\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mobile,/\.flight-route-codes\s*\{[\s\S]*?flex-wrap:nowrap/);
  assert.match(mobile,/\.flight-open-cta\s*\{[\s\S]*?min-height:44px/);
  assert.match(mobile,/td\[data-label="BLOCK"\],[\s\S]*?td\[data-label="AIR"\]\s*\{[\s\S]*?grid-column:span 1/);
  assert.match(mobile,/\.flight-role-stack\s*\{[\s\S]*?flex-wrap:wrap/);
  assert.match(mobile,/td\[data-label="Landings"\],[\s\S]*?td\[data-label="GPS"\]\s*\{[\s\S]*?grid-column:span 1/);
  assert.match(mobile,/td\[data-label="Cost"\]\s*\{[\s\S]*?grid-column:1 \/ -1/);
  const page=read("app/(protected)/flights/page.tsx");
  for(const label of ["Flight","Route","BLOCK","AIR","Role / status","Landings","GPS","Cost"]){
    assert.ok(page.includes(`data-label="${label}"`),`Preserve the ${label} field`);
  }
});

test("Flights country assets render independently of OS emoji fonts, and cannot be inferred from ICAO",()=>{
  const page=read("app/(protected)/flights/page.tsx"),css=read("app/ui-system.css");
  const atlas=fs.readFileSync(path.join(root,"public/flags/iso-atlas.png"));
  assert.deepEqual([...atlas.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(atlas.readUInt32BE(16),936);
  assert.equal(atlas.readUInt32BE(20),702);
  assert.match(page,/supportedFlagCountries\.has\(country\)/);
  assert.match(page,/data-country=\{departureFlag\.country\}/);
  assert.match(page,/data-country=\{arrivalFlag\.country\}/);
  assert.doesNotMatch(page,/String\.fromCodePoint/);
  assert.match(css,/background-image:url\("\/flags\/iso-atlas\.png"\)/);
  assert.match(css,/background-size:468px 351px/);
});
