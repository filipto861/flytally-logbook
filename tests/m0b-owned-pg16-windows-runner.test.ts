import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const ps=readFileSync(new URL("../tooling/run-m0b-owned-pg16-windows.ps1",import.meta.url),"utf8");
test("M0-B Windows PG16 wrapper reuses canonical six-owned-cluster ledger, never remote DB",()=>{
  for(const marker of [
    "param(", "[switch]$PreflightOnly", "feat/logbook-m0b-v22-expand-candidate-20261104",
    "filipto861/flytally-logbook", "c9c2f60303236113a223942072311f5e37f876f7",
    "git fetch --no-tags origin", "refs/remotes/origin/", "git status --porcelain --untracked-files=all",
    "PG16:  $pgVersion", "tooling/validate-postgres-partition-registry.mjs",
    "FLYTALLY_OWNED_PG16_RELEASE", "FLYTALLY_OWNED_PG16_EXPECTED_REF",
    "npm.cmd run verify:postgres -- --base origin/main",
    "Require-Success \"Canonical six-partition PG16 acceptance\"",
    "LOCAL PG16 164/164 acceptance PASS", "DATABASE", "NEON", "POSTGRES",
    "PREFLIGHT PASS", "finally"
  ])assert.ok(ps.includes(marker),"missing mandatory safe-wrapper contract: "+marker);
  assert.match(ps,/if \(\$actualBranch -cne \$branch\)/);
  assert.match(ps,/if \(\$head -cne \$remoteHead\)/);
  assert.match(ps,/if \(\$remoteMain -cne \$mainSha\)/);
  assert.match(ps,/if \(\$nodeVersion -notmatch '\^v24\\\.'\)/);
  assert.match(ps,/PostgreSQL\\16\\bin/);
  assert.match(ps,/if \(\$PreflightOnly\)[\s\S]*?return[\s\S]*?npm.cmd ci/);
  assert.match(ps,/FLYTALLY_OWNED_PG16_RELEASE = "1"/);
  assert.doesNotMatch(ps,/\b(?:DROP DATABASE|DROP SCHEMA|TRUNCATE|DELETE FROM)\b/i);
  assert.doesNotMatch(ps,/(?:&\s*git|^\s*git)\s+(?:push|reset|clean|switch|checkout|merge)\b|(?:&\s*vercel|^\s*vercel)\s+deploy\b/mi);
});
