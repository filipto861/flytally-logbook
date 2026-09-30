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

test("manual entry keeps one completion surface and one primary save action",()=>{
  const source=read("components/flight-form.tsx");
  assert.doesNotMatch(source,/Manual flight entry progress/);
  assert.doesNotMatch(source,/Review before save|entry-review-summary|Ready to save|Save and add another/);
  assert.match(source,/Save & review/);
  assert.match(source,/Save changes/);
  assert.match(source,/Aircraft, logbook and regulatory context came from/);
  assert.match(source,/entry-save-state/);
  assert.match(source,/Complete before save/);
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

test("v1.25 legacy review styling remains isolated while current completion uses the canonical action bar",()=>{
  const legacy=read("app/globals.css"),current=read("app/ui-system.css");
  assert.match(legacy,/FlyTally 1\.25 — guided flight entry/);
  assert.match(legacy,/\.import-save-summary\{grid-template-columns:1fr\}/);
  assert.match(current,/\.form-actions\.field-actions\{/);
  assert.match(current,/grid-template-columns:minmax\(0,1fr\) auto/);
});
