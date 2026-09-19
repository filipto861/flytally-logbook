import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const verify=fs.readFileSync(".github/workflows/verify-web.yml","utf8");
const browser=fs.readFileSync(".github/workflows/browser-smoke.yml","utf8");

test("v3.2 U9 keeps iterative PR verification lightweight",()=>{
  assert.match(verify,/name: Fast application gate/);
  assert.match(verify,/run: npm run typecheck/);
  assert.match(verify,/github\.event\.pull_request\.draft == true \|\| needs\.classify\.outputs\.full_tests != 'true'/);
  assert.doesNotMatch(verify,/Fast application gate[\s\S]*name: Production build/);
});

test("v3.2 U9 reserves PostgreSQL acceptance for final non-draft PRs",()=>{
  assert.match(verify,/if: github\.event\.pull_request\.draft == false && needs\.classify\.outputs\.postgres == 'true'/);
  assert.match(verify,/retention-days: 14/);
});

test("v3.2 U9 reserves browser smoke for final PRs and reduces scheduled usage",()=>{
  assert.match(browser,/if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.draft == false/);
  assert.match(browser,/cron: "23 3 \* \* 1"/);
  assert.doesNotMatch(browser,/cron: "23 3 \* \* 1,4"/);
  assert.match(browser,/retention-days: 7/);
});

test("v3.2 U9 keeps cancellation enabled for superseded CI",()=>{
  assert.match(verify,/cancel-in-progress: true/);
  assert.match(browser,/cancel-in-progress: true/);
});
