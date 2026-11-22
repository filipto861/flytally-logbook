import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

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


test("Flights F2.1 folds all eight cells into five mobile scan bands without dropping evidence",()=>{
  const css=read("app/ui-system.css");
  const start=css.indexOf("/* Flights F2.1 — owner iPhone review:");
  assert.ok(start>css.indexOf("/* Flights F2 — compact phone-only"),"F2.1 must override the verified F2 cascade");
  const mobile=css.slice(start);
  assert.match(mobile,/@media\(max-width:700px\)/);
  assert.match(mobile,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(mobile,/td\[data-label="BLOCK"\],[\s\S]*?td\[data-label="AIR"\]\s*\{[\s\S]*?grid-column:span 6/);
  assert.match(mobile,/td\[data-label="Role \/ status"\]\s*\{[\s\S]*?grid-column:1 \/ -1/);
  assert.match(mobile,/td\[data-label="Landings"\]\s*\{[\s\S]*?grid-column:span 3/);
  assert.match(mobile,/td\[data-label="GPS"\]\s*\{[\s\S]*?grid-column:span 3/);
  assert.match(mobile,/td\[data-label="Cost"\]\s*\{[\s\S]*?grid-column:span 6/);
  assert.match(mobile,/\.flight-identity > small:nth-of-type\(1\)/);
  assert.match(mobile,/\.flight-identity > small:nth-of-type\(2\)/);
  assert.match(mobile,/\.gps-badge\s*\{[\s\S]*?min-height:44px/);
  assert.doesNotMatch(mobile,/display:none[^}]*?(?:record-status|workflow-status|flight-time-ledger)/);
  const page=read("app/(protected)/flights/page.tsx");
  for(const label of ["Flight","Route","BLOCK","AIR","Role / status","Landings","GPS","Cost"]){
    assert.ok(page.includes('data-label="'+label+'"'),"F2.1 must preserve "+label);
  }
  assert.match(page,/tab=gps/);
  assert.match(page,/hasCompleteClockPair\(f\.off_block,f\.on_block\)/);
  assert.match(page,/hasCompleteClockPair\(f\.takeoff,f\.landing\)/);
  assert.ok(page.includes("record-status "), "Status badge is still rendered");
});
