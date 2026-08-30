import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.40.0 exposes record and shared-workflow views on Flights",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.40.0");
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/name="status"/);
  assert.match(page,/name="workflow"/);
  assert.match(page,/Quick view/);
  assert.match(page,/Drafts/);
  assert.match(page,/Certified/);
  assert.match(page,/Waiting/);
  assert.match(page,/Shared with me/);
  assert.match(page,/Official locked logbook record/);
  assert.match(page,/Editable record not yet certified/);
  assert.match(page,/View flight/);
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
  assert.match(css,/\.flight-quick-filters/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.flights-table \.flight-list-row/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|sidebar nav|\.sidebar/);
});

test("v1.40.0 leaves stabilized GPS inference and certification direction unchanged",()=>{
  const roadmap=read("ROADMAP.md"),gps=read("lib/track-processing.ts");
  assert.match(roadmap,/v1\.41: Map & GPS UX/);
  assert.match(roadmap,/keep certification payloads\/hashes\/revisions, Recency Engine, GPS inference/);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(gps,/hasImplausibleAltitudeJump/);
});
