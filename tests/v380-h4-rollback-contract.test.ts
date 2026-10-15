import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const runner=readFileSync(new URL("../tooling/run-currency-380-h4-v20-rollback-local.ps1",import.meta.url),"utf8");
const spec=readFileSync(new URL("../e2e/v380-h4-frozen-v20.spec.mjs",import.meta.url),"utf8");

test("H4 exercise pins the last deployed v20 code, never mutable main",()=>{
  assert.ok(runner.includes('$frozenV20Sha = "dcc8ebbfda0eadfa01345cd875ef1db806a19e26"'));
  assert.ok(runner.includes('git worktree add --detach $oldWorktree $frozenV20Sha'));
  assert.ok(runner.includes('$actualV20Sha -cne $frozenV20Sha'));
  assert.ok(runner.includes("DATABASE_SCHEMA_VERSION=20;"));
  assert.ok(runner.includes("npm.cmd ci"));
  assert.ok(runner.includes("npm.cmd run build"));
});

test("H4 preparation stages canonical v21 on a fresh verified disposable local DB before old runtime",()=>{
  for(const marker of [
    "127.0.0.1:$port/flytally_currency_test",
    "Verified disposable DB identity.",
    "tooling\\bootstrap-browser-smoke-db.mjs",
    "tooling\\apply-currency-v21-disposable.mjs",
    '"1|12|4"',
    "Remove-Item Env:FLYTALLY_CURRENCY_V21_BROWSER",
    'if (Test-Path Env:VERCEL)',
    'if (Test-Path Env:VERCEL_ENV)',
  ])assert.ok(runner.includes(marker),`Missing H4 safety marker: ${marker}`);
  const bootstrap=runner.indexOf('tooling\\bootstrap-browser-smoke-db.mjs');
  const v21=runner.indexOf('tooling\\apply-currency-v21-disposable.mjs');
  const build=runner.indexOf("npm.cmd run build");
  const browser=runner.indexOf('test --config=playwright.h4.config.mjs');
  assert.ok(bootstrap<v21&&v21<build&&build<browser,"H4 staging/build/browser ordering changed");
  assert.ok(runner.includes("reuseExistingServer:false"));
  assert.ok(runner.includes("retries:0"));
});

test("H4 frozen browser exercises real authenticated reads, certified evidence and legacy write/Trash tests",()=>{
  assert.ok(runner.includes("e2e/trash-integrity.spec.mjs"));
  assert.ok(runner.includes("e2e/v380-h4-frozen-v20.spec.mjs"));
  assert.ok(spec.includes('loginBrowserPilot(page,"/flights")'));
  assert.ok(spec.includes('await page.goto("/database")'));
  assert.ok(spec.includes("certified_at IS NOT NULL"));
  assert.ok(spec.includes("price_currency_code IS NULL"));
  assert.ok(spec.includes("FLYTALLY_CURRENCY_V21_BROWSER===undefined"));
});

test("H4 preserves all owner resources and cleans up only its unique worktree and cluster",()=>{
  assert.ok(runner.includes('git worktree remove --force $oldWorktree'));
  assert.ok(runner.includes('pg_ctl.exe'));
  assert.ok(runner.includes('$mayDeleteTemporaryRoot'));
  assert.ok(runner.includes('Restore-Env "DATABASE_URL"'));
  assert.ok(runner.includes('Restore-Env "FLYTALLY_CURRENCY_V21_BROWSER"'));
  assert.doesNotMatch(runner,/restore_snapshot|delete_branch|DROP DATABASE|VERCEL_DEPLOY/);
});
