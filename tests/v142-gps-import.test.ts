import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.42.0 puts an interactive GPS player into add-flight review",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,42,0));
  const form=read("components/kml-import-form.tsx"),player=read("components/gps-import-review-player.tsx");
  assert.match(form,/GpsImportReviewPlayer/);
  assert.match(form,/Review GPS track/);
  assert.match(form,/Takeoff, landing, touch-and-go and split detections/);
  assert.match(player,/GPS import review map/);
  assert.match(player,/Altitude, speed and detected events/);
  assert.match(player,/player-controls/);
  assert.match(player,/setCursor\(clamp\(position\)\*max\)/);
});

test("v1.42.0 marks takeoff landing touch-and-go and split on the profile",()=>{
  const form=read("components/kml-import-form.tsx"),player=read("components/gps-import-review-player.tsx");
  assert.match(form,/kind:"takeoff"/);
  assert.match(form,/kind:"landing"/);
  assert.match(form,/kind:"touch-and-go"/);
  assert.match(form,/kind:"split"/);
  assert.match(form,/touchAndGoEvents\(part\)/);
  assert.match(form,/flightEnvelope\(part\)/);
  assert.match(player,/profile-event-layer/);
  assert.match(player,/profile-event-marker/);
  assert.match(player,/import-event-strip/);
});

test("v1.42.0 removes parser point numbers from normal import review",()=>{
  const form=read("components/kml-import-form.tsx");
  assert.doesNotMatch(form,/GPS point \{detected/);
  assert.doesNotMatch(form,/GPS point \{event/);
  assert.match(form,/kind:"takeoff"/);
  assert.match(form,/kind:"landing"/);
  assert.match(form,/Detected on profile/);
});

test("v1.42.0 keeps stabilized GPS inference unchanged",()=>{
  const processing=read("lib/track-processing.ts"),roadmap=read("docs/history/ROADMAP_LEGACY_2026-09-26.md");
  assert.match(processing,/function takeoffEvidenceIndex/);
  assert.match(processing,/hasImplausibleAltitudeJump/);
  assert.match(processing,/export function suggestedSplits/);
  assert.match(processing,/export function touchAndGoEvents/);
  assert.match(roadmap,/retain the v1\.38\.1–v1\.38\.2 split\/landing\/take-off heuristics unchanged/);
});

test("v1.42 import-player styling stays isolated in later releases",()=>{
  const css=read("app/v142-gps-import.css"),layout=read("app/layout.tsx"),roadmap=read("docs/history/ROADMAP_LEGACY_2026-09-26.md");
  assert.match(layout,/v142-gps-import\.css/);
  assert.match(css,/\.import-player-review/);
  assert.match(css,/\.profile-event-marker/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|sidebar nav|\.sidebar/);
  assert.match(roadmap,/v1\.42\.0–v1\.42\.1: visual GPS import player/);
  assert.match(roadmap,/v1\.43: Print & Export finalisation/);
});

test("v1.42.1 keeps only the authoritative import player map",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,42,1));
  const form=read("components/kml-import-form.tsx");
  assert.match(form,/GpsImportReviewPlayer/);
  assert.doesNotMatch(form,/const TracksMap=/);
  assert.doesNotMatch(form,/className="kml-preview"/);
  assert.match(form,/parts\.length>1\?`FLIGHT \$\{index\+1\} OF \$\{parts\.length\}`:"FLIGHT"/);
  assert.match(form,/touch-review/);
  assert.match(form,/review-grid/);
});


test("D2-C.1 GPS import review does not fabricate altitude or leave stale file previews ready",()=>{
  const form=read("components/kml-import-form.tsx"),player=read("components/gps-import-review-player.tsx");
  assert.match(form,/fileEpoch=useRef\(0\)/);
  assert.match(form,/const epoch=\+\+fileEpoch\.current/);
  assert.match(form,/setAnalysis\(null\);setReviews\(\[\]\)/);
  assert.match(form,/if\(epoch!==fileEpoch\.current\)return/);
  assert.match(player,/interpolatedGpsAltitude\(a\.alt,b\.alt,fraction\)/);
  assert.match(player,/gpsAltitudeProfileGeometry\(alts,width,height\)/);
  assert.match(player,/Altitude unavailable/);
  assert.doesNotMatch(player,/alt:Number\(a\.alt\?\?0\)/);
  assert.doesNotMatch(player,/samples\.map\(point=>Number\(point\.alt\?\?0\)\)/);
  assert.doesNotMatch(player,/metersToFeet\(current\?\.alt\|\|0\)/);
});


test("D2-C.1 saved GPS track read/replay preserves unknown altitude and valid zero",()=>{
  const decoder=read("lib/data/tracks.ts"),saved=read("components/flight-track-player.tsx");
  assert.match(decoder,/optionalGpsNumber\(item\?\.lat\),lon=optionalGpsNumber\(item\?\.lon\)/);
  assert.match(decoder,/const alt=optionalGpsNumber\(item\?\.alt\); if\(alt!==null\)point\.alt=alt;/);
  assert.doesNotMatch(decoder,/const alt = Number\(item\?\.alt\)/);
  assert.match(saved,/interpolatedGpsAltitude\(a\.alt,b\.alt,fraction\)/);
  assert.match(saved,/gpsAltitudeProfileGeometry\(alts,w,h/);
  assert.match(saved,/Altitude unavailable/);
  assert.doesNotMatch(saved,/current\?\.alt\|\|0/);
});
