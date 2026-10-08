import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const verify=fs.readFileSync(".github/workflows/verify-web.yml","utf8");
const browser=fs.readFileSync(".github/workflows/browser-smoke.yml","utf8");

test("v3.2 U9 keeps optional manual cloud verification lightweight",()=>{
  assert.match(verify,/name: Manual application diagnostic/);
  assert.match(verify,/run: npm run typecheck/);
  assert.match(verify,/inputs\.full_tests != true/);
  assert.match(verify,/inputs\.full_tests == true/);
  assert.doesNotMatch(verify,/Manual application diagnostic[\s\S]*name: Diagnostic production build/);
});

test("v3.2 U9 runs PostgreSQL acceptance only when explicitly requested",()=>{
  assert.match(verify,/if: inputs\.postgres == true/);
  assert.match(verify,/retention-days: 14/);
});

test("v3.2 U9 keeps browser smoke manual-only",()=>{
  assert.match(browser,/workflow_dispatch:/);
  assert.doesNotMatch(browser,/\n\s*pull_request:/);
  assert.doesNotMatch(browser,/\n\s*schedule:/);
  assert.match(browser,/retention-days: 7/);
});

test("v3.2 U9 keeps cancellation enabled for superseded CI",()=>{
  assert.match(verify,/cancel-in-progress: true/);
  assert.match(browser,/cancel-in-progress: true/);
});
