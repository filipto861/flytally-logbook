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
const audit=fs.readFileSync("docs/history/FLIGHT_ENTRY_UX_V158.md","utf8");

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

test("v1.58 smart defaults remain transparent after B4 helper-copy triage",()=>{
  assert.match(form,/profileSummary=profileNeedsConfiguration\?"Needs configuration":aircraftContextSummary/);
  assert.match(form,/Aircraft default · change if this flight differed\./);
  assert.doesNotMatch(form,/Aircraft profile applies type, logbook and class defaults/);
  assert.match(form,/shouldApplyAircraftProfileDefaults/);
  assert.doesNotMatch(fs.readFileSync("lib/flight-input.ts","utf8"),/FlyTally v1\.58/);
});

test("v1.58 required-field guidance stays scoped while B5 delays pristine error styling",()=>{
  for(const name of ["registration","role"]){
    const start=form.indexOf(`name="${name}"`),end=form.indexOf("</select>",start),control=form.slice(start,end);
    assert.ok(start>=0&&end>start,name);
    assert.ok(control.includes(" required "),name);
  }
  assert.match(form,/aria-invalid=\{submitAttempted&&!registration\|\|profileNeedsConfiguration\|\|undefined\}/);
  assert.ok(form.includes('aria-invalid={submitAttempted&&!role||undefined}'));
  assert.match(form,/type="hidden" name="evidence" value=\{submittedEvidence\}/);
  assert.match(form,/type="hidden" name="aircraftClass" value=\{submittedAircraftClass\}/);
  assert.doesNotMatch(form,/<select name="evidence"|<select name="aircraftClass"/);
  assert.doesNotMatch(form,/name="billingBasis"[^>]*aria-invalid/);
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
