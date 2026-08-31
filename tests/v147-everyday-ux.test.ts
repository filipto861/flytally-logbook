import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.47.0 simplifies everyday flight entry without adding another workflow",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,47,0));
  const page=read("app/(protected)/flights/new/page.tsx"),form=read("components/flight-form.tsx");
  assert.match(page,/params\.added==="1"/);
  assert.match(page,/saved-next-flight/);
  assert.match(page,/Flight saved\./);
  assert.doesNotMatch(form,/quick-tools|Speed up entry|Recent routes|Reverse route|fillTimes/);
  assert.match(form,/Save and add another/);
});

test("v1.47.0 removes duplicate Flights quick views while preserving exact filters",()=>{
  const page=read("app/(protected)/flights/page.tsx"),css=read("app/v140-flights.css");
  assert.doesNotMatch(page,/flight-quick-filters|Quick view/);
  assert.doesNotMatch(css,/flight-quick-filters/);
  assert.match(page,/Advanced filters/);
  assert.match(page,/name="status"/);
  assert.match(page,/name="workflow"/);
  assert.match(page,/active-filter-bar/);
});

test("v1.47.0 keeps secondary crew sharing available without dominating flight overview",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx"),css=read("app/v147-everyday.css");
  assert.match(detail,/<details className="panel flight-secondary-panel">/);
  assert.match(detail,/Crew & logbook sharing/);
  assert.match(detail,/inviteCrewMember/);
  assert.match(detail,/cancelSafetyInvitation/);
  assert.match(css,/\.flight-secondary-panel-body/);
});

test("v1.47.0 only surfaces technical data checks when action is required",()=>{
  const database=read("app/(protected)/database/page.tsx");
  assert.match(database,/\{data\.issues\.length\?<DataQualityPanel/);
  assert.match(database,/id="data-health"/);
  assert.match(database,/Data health summary/);
});

test("v1.47.0 remains presentation-only around protected flight evidence",()=>{
  const layout=read("app/layout.tsx"),roadmap=read("ROADMAP.md"),certification=read("lib/certification-integrity.ts"),gps=read("lib/track-processing.ts");
  assert.match(layout,/v147-everyday\.css/);
  assert.match(roadmap,/Current release — v1\.47\.0/);
  assert.match(certification,/flightCertificationHash/);
  assert.match(gps,/takeoffEvidenceIndex/);
  assert.match(roadmap,/does not change flight ownership, certification, recency or GPS inference/i);
});
