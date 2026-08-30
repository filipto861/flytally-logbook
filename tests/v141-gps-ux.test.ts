import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.41.0 lazy-loads detailed GPS data from the flight detail",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.41.0");
  const page=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(page,/getFlightTrackSummaries/);
  assert.match(page,/LazyFlightTrackReview/);
  assert.match(page,/flight-gps-summaries/);
  assert.doesNotMatch(page,/getFlightTracks/);
  assert.doesNotMatch(page,/FlightTrackPlayer/);
});

test("v1.41.0 GPS review endpoint is authenticated user scoped and non-cacheable",()=>{
  const route=read("app/api/flights/[id]/tracks/route.ts"),data=read("lib/data/flight-track-review.ts");
  assert.match(route,/requireUser/);
  assert.match(route,/getFlightTrackReview\(userId,id\)/);
  assert.match(route,/private, no-store/);
  assert.match(data,/t\.user_id=\$\{userId\}/);
  assert.match(data,/t\.flight_id=\$\{flightId\}/);
  assert.match(data,/JOIN flights f ON f\.id=t\.flight_id AND f\.user_id=t\.user_id/);
});

test("v1.41.0 makes derived GPS evidence explicit and reviewable",()=>{
  const component=read("components/lazy-flight-track-review.tsx"),manager=read("components/track-manager.tsx");
  assert.match(component,/Saved values vs GPS suggestion/);
  assert.match(component,/Saved logbook value/);
  assert.match(component,/GPS-derived suggestion/);
  assert.match(component,/advisory only/);
  assert.match(component,/never become logbook values automatically/);
  assert.match(manager,/Apply GPS time suggestions/);
  assert.match(manager,/Review the comparison above first/);
  assert.match(manager,/pointCount/);
  assert.match(manager,/fileName/);
});

test("v1.41.0 keeps GPS inference behavior unchanged while reusing it for advisory review",()=>{
  const review=read("lib/data/flight-track-review.ts"),processing=read("lib/track-processing.ts");
  assert.match(review,/flightEnvelope/);
  assert.match(review,/landingCount/);
  assert.match(review,/localParts/);
  assert.match(processing,/takeoffEvidenceIndex/);
  assert.match(processing,/hasImplausibleAltitudeJump/);
});

test("v1.41.0 GPS polish stays isolated from global navigation",()=>{
  const css=read("app/v141-gps-review.css"),layout=read("app/layout.tsx"),roadmap=read("ROADMAP.md");
  assert.match(layout,/v141-gps-review\.css/);
  assert.match(css,/\.gps-review-grid/);
  assert.match(css,/\.track-source-row/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|sidebar nav|\.sidebar/);
  assert.match(roadmap,/Current release — v1\.41\.0/);
  assert.match(roadmap,/v1\.42: Print & Export finalisation/);
});
