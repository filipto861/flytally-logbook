import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const page=fs.readFileSync("app/(protected)/flights/new/page.tsx","utf8");
const css=fs.readFileSync("app/v157-flight-entry-workflow.css","utf8");
const layout=fs.readFileSync("app/layout.tsx","utf8");
const changelog=fs.readFileSync("CHANGELOG.md","utf8");
const audit=fs.readFileSync("FLIGHT_ENTRY_UX_V157.md","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));

test("v1.57 package metadata, UX layer and release records remain synchronized",()=>{
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  const [major,minor]=String(pkg.version).split(".").map(Number);
  assert.ok(major>1||(major===1&&minor>=57));
  assert.ok(layout.indexOf('v157-flight-entry-workflow.css')>layout.indexOf('v156-mobile-hardening.css'));
  assert.match(changelog,/## 1\.57\.0 — Flight Entry Workflow Simplification/);
  assert.match(audit,/## Deliberately unchanged/);
});

test("v1.57 release record preserves the original route-shortcut rationale",()=>{
  assert.match(changelog,/Recent-route shortcuts/);
  assert.match(audit,/Route repetition/);
  assert.match(audit,/Local · DEP → DEP/);
});

test("v1.57 exposes live BLOCK and AIR feedback without changing flight parsing",()=>{
  assert.match(form,/className="flight-time-summary"/);
  assert.match(form,/>BLOCK</);
  assert.match(form,/>AIR</);
  assert.match(form,/durationLabel\(blockMinutes\)/);
  assert.match(form,/durationLabel\(airMinutes\)/);
  const parser=fs.readFileSync("lib/flight-input.ts","utf8");
  assert.doesNotMatch(parser,/FlyTally v1\.57/);
});

test("v1.57 names missing required choices and keeps them discoverable",()=>{
  assert.match(form,/Complete before save:/);
  for(const label of ["Date","Aircraft","Role","Logbook","Aircraft class","Billing"])assert.ok(form.includes(`"${label}"`));
  assert.match(audit,/Auto-open is one-way assistance/);
});

test("v1.57 keeps mobile source selection compact",()=>{
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.entry-choice\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("v1.57 retains prior regulatory, aircraft and responsive safety nets",()=>{
  for(const path of [
    "tests/v151-regulatory-correctness.test.ts",
    "tests/v1511-legacy-recency.test.ts",
    "tests/v1512-recency-provenance.test.ts",
    "tests/v1513-automatic-ull-credit.test.ts",
    "tests/v1531-aircraft-state.test.ts",
    "tests/v1543-aircraft-catalog.test.ts",
    "tests/v155-flight-entry-layout.test.ts",
    "tests/v156-mobile-layout-audit.test.ts",
  ])assert.equal(fs.existsSync(path),true,`${path} must remain`);
});