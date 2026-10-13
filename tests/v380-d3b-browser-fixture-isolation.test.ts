import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const runner=readFileSync(new URL("../tooling/run-v380-d3b1-browser-local.ps1",import.meta.url),"utf8");
const fixture=readFileSync(new URL("../tooling/bootstrap-browser-smoke-db.mjs",import.meta.url),"utf8");
const spec=readFileSync(new URL("../e2e/trash-integrity.spec.mjs",import.meta.url),"utf8");
const baseline=JSON.parse(readFileSync(new URL("../tooling/browser-suite-baseline.json",import.meta.url),"utf8"));
const registry=JSON.parse(readFileSync(new URL("../tooling/development-modules.json",import.meta.url),"utf8"));

test("D3b-1 browser runner exclusively creates its own disposable localhost database before destructive bootstrap",()=>{
  assert.match(runner,/\$expectedBranch = "fix\/3\.8\.0-d3b1-atomic-fail-closed-trash"/);
  assert.match(runner,/Git tracked-file status/);
  assert.match(runner,/Untracked TypeScript files may affect/);
  assert.match(runner,/flytally-d3b1-browser-/);
  assert.match(runner,/\$initdb -D \$dataDir -U flytally -A trust/);
  assert.match(runner,/\$pgctl -D \$dataDir -l \$logPath -o "-h 127\.0\.0\.1 -p \$port"/);
  assert.match(runner,/\$env:DATABASE_URL = "postgresql:\/\/flytally@127\.0\.0\.1:\$port\/flytally_currency_test"/);
  assert.match(runner,/\$observedIdentity/);
  assert.match(runner,/Verified disposable DB identity/);
  assert.ok(runner.indexOf("Verified disposable DB identity")<runner.indexOf("npm.cmd run test:browser -- e2e/trash-integrity.spec.mjs"));
  assert.match(runner,/port 3000 is already occupied/);
  assert.match(runner,/pg_ctl\.exe"\) -D \$dataDir -m fast -w -t 30 stop/);
  assert.match(runner,/Restore-Env "DATABASE_URL" \$oldDatabaseUrl/);
  assert.match(runner,/Restore-Env "FLYTALLY_AUTH_BROWSER" \$oldAuthBrowser/);
  assert.match(runner,/Restore-Env "FLYTALLY_LOCAL_POSTGRES" \$oldLocalPostgres/);
  assert.match(runner,/\$env:SESSION_SECRET = \(\[guid\]::NewGuid\(\)\.ToString\("N"\)/);
  assert.match(runner,/\$env:SIGNING_SECRET = \(\[guid\]::NewGuid\(\)\.ToString\("N"\)/);
  assert.match(runner,/Restore-Env "SESSION_SECRET" \$oldSessionSecret/);
  assert.match(runner,/Restore-Env "SIGNING_SECRET" \$oldSigningSecret/);
  assert.doesNotMatch(runner,/\bRemove-Item\b[^\n]*\$env:USERPROFILE/);
});

test("D3b-1 browser fixture retains the deleted-flights expense snapshot and legacy points needed by A+ SQL",()=>{
  assert.match(fixture,/DROP SCHEMA public CASCADE;/);
  assert.match(fixture,/CREATE TABLE track_points\(/);
  assert.match(fixture,/CREATE TABLE deleted_flights \([\s\S]*expenses_data JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(fixture,/CREATE TABLE flight_expenses\(/);
  assert.match(fixture,/CREATE TABLE flight_tracks\(/);
  assert.match(fixture,/CREATE TABLE airports\(\s*id BIGSERIAL PRIMARY KEY,/);
  assert.match(fixture,/CREATE TABLE fstd_sessions\s*\(/);
  assert.match(fixture,/CREATE TABLE fstd_certified_revisions\s*\(/);
  assert.match(fixture,/CREATE TABLE account_backups\s*\(/);
});

test("D3b-1 browser spec asserts authenticated preserved evidence for both accepted and refused Trash",()=>{
  assert.match(spec,/FLYTALLY_AUTH_BROWSER==="1"/);
  assert.match(spec,/FLYTALLY_LOCAL_POSTGRES==="1"/);
  assert.match(spec,/deleting one GPS track preserves the other/);
  assert.match(spec,/pending collaboration refuses ordinary Trash/);
  assert.match(spec,/jsonb_array_length\(tracks_data\)/);
  assert.match(spec,/jsonb_array_length\(expenses_data\)/);
  assert.match(spec,/backupsBefore\+1/);
  assert.match(spec,/p\.form-error\[role=alert\]/);
  assert.match(spec,/SELECT COUNT\(\*\) FROM flight_participations/);
  assert.equal(baseline.acceptanceLogicalTests.length,55);
  const expected=[
    ["flight-trash-track-desktop","desktop-chromium",baseline.acceptanceLogicalTests[53]],
    ["flight-trash-track-mobile","mobile-chromium",baseline.acceptanceLogicalTests[53]],
    ["flight-trash-protected-desktop","desktop-chromium",baseline.acceptanceLogicalTests[54]],
    ["flight-trash-protected-mobile","mobile-chromium",baseline.acceptanceLogicalTests[54]],
  ];
  for(const [id,project,title] of expected){
    const target=registry.browserAcceptance.targets[id];
    assert.equal(target?.spec,"e2e/trash-integrity.spec.mjs");
    assert.equal(target?.project,project);
    assert.equal(target?.title,title);
    assert.ok(registry.browserAcceptance.harnessTargets.includes(id));
    assert.ok(registry.browserAcceptance.moduleTargets["flight-records"].includes(id));
    assert.ok(registry.browserAcceptance.moduleTargets["gps-tracks"].includes(id));
  }
});
