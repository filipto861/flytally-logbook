import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form=fs.readFileSync("components/flight-form.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");

test("v1.55 flight essentials preserve grouped route and timeline semantics under the B2 hierarchy",()=>{
  const essentials=form.slice(form.indexOf('entry-section entry-section-primary'),form.indexOf('entry-section entry-section-experience'));
  const order=[
    'name="date"','name="registration"','name="role"',
    'essential-route-group','name="departure"','name="arrival"',
    'essential-time-group','name="offBlock"','name="takeoff"','name="landing"','name="onBlock"'
  ].map(token=>essentials.indexOf(token));
  assert.ok(order.every(index=>index>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b),order);
});

test("v1.55 legacy equal-width essentials remain available beneath the later B2 layout override",()=>{
  assert.match(css,/FlyTally v1\.55 — aligned flight essentials/);
  assert.match(css,/\.flight-form \.essential-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:700px\)\{\.flight-form \.essential-grid\{grid-template-columns:1fr!important/);
  assert.match(css,/height:48px;min-height:48px/);
  const current=fs.readFileSync("app/ui-system.css","utf8");
  assert.match(current,/\.flight-form \.essential-identity-grid\{grid-template-columns:minmax\(0,\.8fr\)/);
  assert.match(current,/\.flight-form \.essential-time-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
