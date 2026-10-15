import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const runner=readFileSync(new URL("../tooling/run-v380-cost-summary-acceptance-local.ps1",import.meta.url),"utf8");
const generalPgRunner=readFileSync(new URL("../tooling/verify-postgres.mjs",import.meta.url),"utf8");
const flag="FLYTALLY_D2_FULL_V20_DISPOSABLE";

test("PR340 only enables destructive legacy-v20 integration after owning and verifying its new PG16 cluster",()=>{
  const init=runner.indexOf('& $initdb -D $dataDir -U flytally -A trust');
  const dbCreated=runner.indexOf('& $createdb -h 127.0.0.1');
  const observed=runner.indexOf('if ($identityRows.Count -ne 1 -or $identityRows[0] -cne $expectedIdentity)');
  const verified=runner.indexOf('Write-Host "Verified disposable DB identity."');
  const enabled=runner.indexOf('$env:'+flag+' = "1"');
  const preflight=runner.indexOf('Assert-Exit "Currency purpose environment preflight"');
  const gate=runner.indexOf('npm.cmd run verify:release:risk -- --base origin/main');
  assert.ok(init>=0&&dbCreated>init&&observed>dbCreated&&verified>observed&&enabled>verified&&preflight>enabled&&gate>preflight,
    "Full-v20 opt-in must follow verified fresh disposable database identity and precede only guarded test execution");
  assert.equal(runner.split('$env:'+flag+' = "1"').length-1,1,"Only one enablement point is permitted");
});

test("PR340 validates the legacy-v20 purpose flag in a real Node child and restores inherited environment",()=>{
  assert.match(runner,/\$oldD2FullV20 = \[Environment\]::GetEnvironmentVariable\("FLYTALLY_D2_FULL_V20_DISPOSABLE", "Process"\)/);
  assert.match(runner,/e\.FLYTALLY_D2_FULL_V20_DISPOSABLE!=='1'/);
  const cleanup=runner.slice(runner.lastIndexOf('} finally {'));
  assert.match(cleanup,/Restore-Env "FLYTALLY_D2_FULL_V20_DISPOSABLE" \$oldD2FullV20/);
  assert.match(cleanup,/pg_ctl\.exe"\) -D \$dataDir -m fast -w -t 30 stop/);
});

test("generic PostgreSQL verification does not turn on the destructive legacy-v20 fixture",()=>{
  assert.doesNotMatch(generalPgRunner,/FLYTALLY_D2_FULL_V20_DISPOSABLE/);
  assert.match(generalPgRunner,/FLYTALLY_POSTGRES_INTEGRATION:"1"/);
});

test("legacy v20 restore fixture validates the existing expense archive schema without duplicate DDL",()=>{
  const bootstrap=readFileSync(new URL("../tooling/bootstrap-browser-smoke-db.mjs",import.meta.url),"utf8");
  const restore=readFileSync(new URL("../tests/integration/postgres-v380-full-v20-restore.test.ts",import.meta.url),"utf8");
  assert.match(bootstrap,/expenses_data JSONB NOT NULL DEFAULT '\\[\\]'::jsonb/);
  assert.match(restore,/column_name='expenses_data'/);
  assert.match(restore,/jsonb\\|NO\\|/);
  assert.doesNotMatch(restore,/ALTER TABLE deleted_flights ADD COLUMN expenses_data/);
});
