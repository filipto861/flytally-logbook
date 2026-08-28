import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.37 shared-flight notification actions remain supported",()=>{
  const page=read("app/(protected)/notifications/page.tsx"),actions=read("app/(protected)/notifications/actions.ts");
  assert.match(page,/\["flight_request","flight_invite"\]/);
  assert.match(page,/Review & add/);assert.match(page,/Review & sign/);assert.match(page,/>Decline</);
  assert.match(actions,/kind IN \('flight_request','flight_invite'\)/);
  assert.match(actions,/declineSharedFlight\(participation\)/);
});

test("v1.37 shared review keeps Review Add Certify workflow and derived states",()=>{
  const page=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.match(page,/shared-flight-progress/);assert.match(page,/>Review</);assert.match(page,/>Add</);assert.match(page,/>Certify</);
  assert.match(page,/participant_certified_at/);assert.match(page,/Certified in your logbook/);assert.match(page,/Added to your logbook/);assert.match(page,/Invitation declined/);assert.match(page,/Accepted · copy missing/);
  assert.match(page,/Add to my logbook/);assert.match(page,/>Decline</);
});

test("v1.37 certified ULL uses the protected logbook-entry grid",()=>{
  const entry=read("components/readonly-logbook-entry.tsx");
  assert.match(entry,/const caption=easa\?"FCL\.050 single-flight logbook preview":"ULL single-flight logbook preview"/);
  assert.match(entry,/readonly-fcl-table/);assert.match(entry,/Single-pilot time/);assert.match(entry,/Pilot function/);
  assert.doesNotMatch(entry,/<th>Route<\/th><th>Aircraft<\/th><th>Block UTC<\/th>/);
});

test("v1.37 mobile workflow polish remains isolated from global navigation",()=>{
  const layout=read("app/layout.tsx"),css=read("app/v137-shared-flights.css");
  assert.match(layout,/v137-shared-flights[.]css/);assert.match(css,/shared-flight-progress/);assert.match(css,/@media\(max-width:700px\)/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|\.sidebar nav/);
});
