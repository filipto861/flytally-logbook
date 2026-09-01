import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");

test("v1.55 flight essentials keep route and timeline fields paired",()=>{
  const essentials=form.slice(form.indexOf('entry-section entry-section-primary'),form.indexOf('open={pilotSectionOpen}'));
  const order=[
    'name="date"','name="registration"',
    'name="departure"','name="arrival"',
    'name="offBlock"','name="onBlock"',
    'name="takeoff"','name="landing"',
    'name="role"','name="landingsDay"'
  ].map(token=>essentials.indexOf(token));
  assert.ok(order.every(index=>index>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
});

test("v1.55 essentials are equal-width on desktop and single-column on mobile",()=>{
  assert.match(css,/FlyTally v1\.55 — aligned flight essentials/);
  assert.match(css,/\.flight-form \.essential-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:700px\)\{\.flight-form \.essential-grid\{grid-template-columns:1fr!important/);
  assert.match(css,/height:48px;min-height:48px/);
});
