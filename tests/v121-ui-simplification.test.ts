import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("flight entry exposes one selected workflow and a dedicated aircraft dialog",()=>{
  const page=read("app/(protected)/flights/new/page.tsx"),workspace=read("components/flight-entry-workspace.tsx"),importer=read("components/kml-import-form.tsx"),player=read("components/gps-import-review-player.tsx");
  assert.match(page,/FlightEntryWorkspace/);
  assert.match(workspace,/Import GPS track/);
  assert.match(workspace,/Manual entry/);
  assert.match(workspace,/role="dialog"/);
  assert.match(workspace,/event\.key==="Escape"/);
  assert.match(importer,/dynamic\(\(\)=>import\("@\/components\/gps-import-review-player"\)/);
  assert.match(importer,/ssr:false/);
  assert.match(player,/GPS import review map/);
  assert.doesNotMatch(importer,/@\/components\/tracks-map/);
});

test("flight detail, data and settings use task-focused workspaces",()=>{
  assert.match(read("app/(protected)/flights/[id]/page.tsx"),/FlightDetailWorkspace/);
  assert.doesNotMatch(read("components/data-hub.tsx"),/BackupValidator/);
  const settings=read("app/(protected)/profile/page.tsx");
  assert.match(settings,/saveAccountSettings/);
  assert.doesNotMatch(settings,/Profile #/);
});

test("navigation and styling use the consolidated 1.21 information architecture",()=>{
  const sidebar=read("components/sidebar.tsx"),layout=read("app/layout.tsx");
  assert.match(sidebar,/Aircraft & airports/);
  assert.match(sidebar,/Print & data/);
  assert.doesNotMatch(layout,/v119\.css|v121\.css/);
  assert.match(read("app/globals.css"),/FlyTally 1\.21 — task-first interface/);
});
