import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.25 preserves both entry modes when the user switches source",()=>{
  const source=read("components/flight-entry-workspace.tsx");
  assert.match(source,/<div hidden=\{mode!=="gps"\}>\{gps\}<\/div>/);
  assert.match(source,/<div hidden=\{mode!=="manual"\}>\{manual\}<\/div>/);
});

test("manual entry has a live pre-save summary and explicit save actions without fake wizard progress",()=>{
  const source=read("components/flight-form.tsx");
  assert.doesNotMatch(source,/Manual flight entry progress/);
  assert.match(source,/Review before save/);
  assert.match(source,/BLOCK \/ AIR/);
  assert.match(source,/Save & review/);
  assert.match(source,/Save changes/);
  assert.match(source,/Aircraft, logbook.*billing defaults came from/);
  assert.match(source,/entry-save-state/);
});

test("GPS import guides review before enabling the final save",()=>{
  const source=read("components/kml-import-form.tsx");
  assert.match(source,/GPS import progress/);
  assert.match(source,/Review imported flights/);
  assert.match(source,/Save reviewed flights/);
  assert.match(source,/flights reviewed/);
  assert.match(source,/GPS supplied the times, split and landing suggestions/);
});

test("flight forms warn before abandoning unsaved data",()=>{
  const guard=read("components/use-unsaved-form-guard.ts");
  const manual=read("components/flight-form.tsx");
  const gps=read("components/kml-import-form.tsx");
  assert.match(guard,/beforeunload/);
  assert.match(guard,/unsaved flight changes/);
  assert.match(manual,/useUnsavedFormGuard/);
  assert.match(gps,/useUnsavedFormGuard/);
});

test("v1.25 review UI has desktop and narrow-screen layouts",()=>{
  const css=read("app/globals.css");
  assert.match(css,/FlyTally 1\.25 — guided flight entry/);
  assert.match(css,/\.entry-review-summary dl\{display:grid;grid-template-columns:repeat\(5/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/\.import-save-summary\{grid-template-columns:1fr\}/);
});
