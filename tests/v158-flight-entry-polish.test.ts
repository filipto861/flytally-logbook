import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const page=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const css=fs.readFileSync("app/v158-flight-entry-polish.css","utf8");
const layout=fs.readFileSync("app/layout.tsx","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const changelog=fs.readFileSync("CHANGELOG.md","utf8");
const audit=fs.readFileSync("FLIGHT_ENTRY_UX_V158.md","utf8");

test("v1.58 metadata and final UX layer are synchronized",()=>{
  const [major,minor]=String(pkg.version).split(".").map(Number);
  assert.ok(major>1||(major===1&&minor>=58));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  assert.ok(layout.indexOf("v158-flight-entry-polish.css")>layout.indexOf("v157-flight-entry-workflow.css"));
  assert.match(changelog,/## 1\.58\.0 — Flight Entry Polish & Smart Defaults/);
  assert.match(audit,/## Deliberately unchanged/);
});

test("v1.58 removes Quick Routes from the current flight-entry surface",()=>{
  assert.doesNotMatch(page,/getRecentRoutes/);
  assert.doesNotMatch(page,/recentRoutes/);
  assert.doesNotMatch(form,/Quick route/);
  assert.doesNotMatch(form,/recentRoutes/);
  assert.doesNotMatch(form,/route-shortcuts/);
});

test("v1.58 keeps local flight as a small explicit action",()=>{
  assert.match(form,/Use \{departure\} for local flight/);
  assert.match(form,/setArrival\(departure\)/);
  assert.match(form,/field-inline-action/);
  assert.match(css,/\.field-inline-action/);
});

test("v1.58 makes existing smart defaults transparent instead of guessing regulatory data",()=>{
  assert.match(form,/Aircraft profile applies type, logbook, class and billing defaults/);
  assert.match(form,/Aircraft default:/);
  assert.match(form,/shouldApplyAircraftProfileDefaults/);
  assert.doesNotMatch(fs.readFileSync("lib/flight-input.ts","utf8"),/FlyTally v1\.58/);
});

test("v1.58 provides inline guidance only for fields that are already required",()=>{
  for(const name of ["registration","role","evidence","aircraftClass","billingBasis"])assert.ok(form.includes(`aria-invalid={!${name==="aircraftClass"?"aircraftClass":name==="billingBasis"?"billing":name}}`));
  assert.match(form,/field-message-error/);
  assert.match(css,/\[aria-invalid="true"\]/);
});

test("v1.58 airport entry disables mobile autocorrect and spelling substitution",()=>{
  const matches=form.match(/autoCorrect="off" spellCheck=\{false\}/g)||[];
  assert.equal(matches.length,2);
});

test("v1.58 retains regulatory, aircraft-state and mobile safety nets",()=>{
  for(const path of [
    "tests/v151-regulatory-correctness.test.ts",
    "tests/v1511-legacy-recency.test.ts",
    "tests/v1512-recency-provenance.test.ts",
    "tests/v1513-automatic-ull-credit.test.ts",
    "tests/v1531-aircraft-state.test.ts",
    "tests/v1543-aircraft-catalog.test.ts",
    "tests/v155-flight-entry-layout.test.ts",
    "tests/v156-mobile-layout-audit.test.ts",
    "tests/v157-flight-entry-workflow.test.ts",
  ])assert.equal(fs.existsSync(path),true,`${path} must remain`);
});
