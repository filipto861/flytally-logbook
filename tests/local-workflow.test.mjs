import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assertLocalFixtureUrl, isLocalDockerEndpoint, assertOwnedContainerMetadata } from "../tooling/local-workflow.mjs";
import { nativeManifestValid, nativePg16Tools, nativeIdentityMismatches, nativeCoreIdentityMismatches } from "../tooling/local-native-pg16.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const isLogbook = pkg.name === "pilot-logbook-web";
const database = isLogbook ? "flytally_logbook_test" : "flytally_training_acceptance_test";
const port = isLogbook ? "55439" : "55440";
const fixture = "postgresql://flytally_local:testpassword@127.0.0.1:" + port + "/" + database;

test("dedicated local disposable PostgreSQL identity is accepted", () => {
  assert.equal(assertLocalFixtureUrl(fixture), true);
});

test("remote production, Docker-host aliases and the other FlyTally repo are rejected", () => {
  const wrongDatabase = isLogbook ? "flytally_training_acceptance_test" : "flytally_logbook_test";
  const invalid = [
    fixture.replace("127.0.0.1", "remote.neon.tech"),
    fixture.replace("127.0.0.1", "localhost"),
    fixture.replace("127.0.0.1", "host.docker.internal"),
    fixture.replace(database, wrongDatabase),
    fixture.replace(port, "5432"),
    fixture.replace("flytally_local", "postgres"),
    fixture.replace("testpassword@", "@"),
    fixture.replace("postgresql:", "https:"),
    fixture + "?sslmode=require",
    "not-a-url",
  ];
  for (const value of invalid) {
    assert.throws(() => assertLocalFixtureUrl(value), { message: /local disposable|Invalid URL/ });
  }
});

test("one-command scripts exist without replacing canonical product release gates", () => {
  for (const key of ["doctor", "setup:local", "setup:db", "test:quick", "test:full", "test:db:local", "test:browser:local"]) {
    assert.match(pkg.scripts[key], /tooling\/local-workflow\.mjs/);
  }
  assert.ok(pkg.scripts.verify);
  if (isLogbook) assert.ok(pkg.scripts["verify:release:risk"]);
  else assert.ok(pkg.scripts["test:no-code-aircraft"]);
});

test("remote Docker contexts are not accepted as localhost-owned test fixtures", () => {
  assert.equal(isLocalDockerEndpoint("unix:///var/run/docker.sock"), true);
  assert.equal(isLocalDockerEndpoint("npipe:////./pipe/docker_engine"), true);
  assert.equal(isLocalDockerEndpoint("ssh://remote.example"), false);
  assert.equal(isLocalDockerEndpoint("tcp://10.0.0.20:2375"), false);
  assert.equal(isLocalDockerEndpoint("tcp://127.0.0.1:2375"), false);
});


function ownedContainer() {
  return {
    Name: "/flytally-logbook-local-pg16",
    Config: { Image: "postgres:16", Env: [
      "POSTGRES_DB=flytally_logbook_test",
      "POSTGRES_USER=flytally_local",
      "POSTGRES_PASSWORD=testpassword",
    ] },
    HostConfig: { PortBindings: { "5432/tcp": [
      { HostIp: "127.0.0.1", HostPort: "55439" },
    ] } },
    State: { Running: true },
  };
}

test("DB acceptance requires matching Docker identity, password, port, running state and no other bindings", () => {
  const original = ownedContainer();
  assert.equal(assertOwnedContainerMetadata(original, fixture), true);
  const mutations = [
    { ...original, Name: "/unrelated-database" },
    { ...original, Config: { ...original.Config, Image: "postgres:17" } },
    { ...original, Config: { ...original.Config,
      Env: original.Config.Env.map(v => v.startsWith("POSTGRES_PASSWORD=") ? "POSTGRES_PASSWORD=wrong" : v) } },
    { ...original, HostConfig: { PortBindings: { "5432/tcp": [
      { HostIp: "0.0.0.0", HostPort: "55439" },
    ] } } },
    { ...original, HostConfig: { PortBindings: { "5432/tcp": [
      { HostIp: "127.0.0.1", HostPort: "55439" },
      { HostIp: "0.0.0.0", HostPort: "5432" },
    ] } } },
    { ...original, State: { Running: false } },
  ];
  for (const value of mutations) {
    assert.throws(() => assertOwnedContainerMetadata(value, fixture), /container identity/);
  }
  assert.equal(assertOwnedContainerMetadata(
    { ...original, State: { Running: false } }, fixture, { requireRunning: false },
  ), true); // setup may restart only after proving all other metadata
});

test("database guard must not accept missing Docker ownership as a source-only PASS", () => {
  assert.throws(() => assertOwnedContainerMetadata(null, fixture), /container identity/);
  assert.throws(() => assertOwnedContainerMetadata(ownedContainer(),
    "postgresql://flytally_local:testpassword@neon.tech:55439/flytally_logbook_test"), /local disposable/);
});

test("release convenience command keeps exact authoritative risk planner", () => {
  const script = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(script, /verify-plan\.mjs/);
  assert.match(script, /plan\?\.postgres\s*\|\|\s*plan\?\.scale\s*\|\|\s*plan\?\.browser/);
  assert.match(script, /verifyOwnedFixture\(url\)/);
});


test("native owned PostgreSQL marker accepts exact Logbook identity only", () => {
  const good = {
    schemaVersion: 1,
    owner: "flytally-logbook-local-acceptance",
    engine: "native-pg16",
    hostname: "127.0.0.1",
    port: "55439",
    user: "flytally_local",
    database: "flytally_logbook_test",
  };
  assert.equal(nativeManifestValid(good), true);
  for (const modified of [
    { ...good, database: "flytally_training_acceptance_test" },
    { ...good, engine: "docker" },
    { ...good, port: "5432" },
    { ...good, hostname: "remote.neon.tech" },
    { ...good, user: "postgres" },
    { ...good, extras: true },
    null,
  ]) assert.equal(nativeManifestValid(modified), false);
});

test("reboot-safe native mode is cluster reuse, not data deletion or unverified adoption", () => {
  const source = readFileSync(new URL("../tooling/local-native-pg16.mjs", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(!readMarker\(\)\)/);
  assert.match(source, /if \(!allowCreate\)/);
  assert.match(source, /Native PG16 ownership marker/);
  assert.match(source, /"PG_VERSION"/);
  assert.match(source, /current_setting\('data_directory'\)/);
  assert.match(source, /"pg_ctl"/);
  assert.match(facade, /nativeMarkerExists\(\)/);
  assert.match(facade, /ensureNativePg16\(existingUrl\)/);
  assert.doesNotMatch(source, /DROP DATABASE|DROP SCHEMA|rmSync\(dataDir/);
});

test("native PG16 is optional and never assumes that psql alone is the server", () => {
  if (process.platform !== "win32") assert.equal(nativePg16Tools(), null);
  const source = readFileSync(new URL("../tooling/local-native-pg16.mjs", import.meta.url), "utf8");
  assert.match(source, /"initdb", "pg_ctl", "psql", "createdb"/);
  assert.match(source, /"16", "bin"/);
  assert.match(source, /scram-sha-256/);
});

test("Docker fallback persists PG16 data and restarts the owned container", () => {
  const source = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /"--restart", "unless-stopped"/);
  assert.match(source, /flytally-logbook-local-pg16-data/);
  assert.match(source, /"volume", "inspect", volumeName/);
  assert.match(source, /Reserved Docker volume already exists without the matching owned container/);
  assert.match(source, /Docker volume inspection was inconclusive/);
  assert.match(source, /verifyOwnedFixture\(existingUrl\)/);
  assert.doesNotMatch(source, /docker", \["rm"|docker", \["volume", "rm"/);
});

test("test runner sanitizes inherited libpq routing and never trusts remote env DB", () => {
  const source = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /\/\^PG\[A-Z0-9_\]\+\$\/i/);
  assert.match(source, /env\.DATABASE_URL = ""/);
  assert.match(source, /verifyOwnedFixture\(url\)/);
});


test("native PG16 subprocesses have time limits and stream slow bootstrap progress", () => {
  const source = readFileSync(new URL("../tooling/local-native-pg16.mjs", import.meta.url), "utf8");
  const facade = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /timeout, maxBuffer:/);
  assert.match(source, /showProgress \? \["ignore", "inherit", "inherit"\]/);
  assert.match(source, /90_000, \{ showProgress: true \}/);
  assert.match(source, /run\(bin\[name\], \["--version"\], env, 7_000\)/);
  assert.match(source, /Interrupted native PG16|INCOMPLETE \(manual inspection required/);
  assert.match(facade, /nativePartialClusterExists\(\)/);
  assert.match(facade, /\[DB\] Checking owned local PostgreSQL fixtures/);
  assert.match(facade, /diagnostic: true/);
});


test("Docker context and daemon detection must not block a disconnected workstation indefinitely", () => {
  const source = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /function dockerInfo\(\)/);
  assert.match(source, /"docker", \["context", "inspect"[\s\S]{0,150}timeout: 8_000/);
  assert.match(source, /"docker", \["info"[\s\S]{0,120}timeout: 8_000/);
  assert.match(source, /info\.status === 0/);
});


test("partial native PG16 recovery is read-only by default and physically pinned to one owned cluster", () => {
  const source = readFileSync(new URL("../tooling/recover-incomplete-local-pg16.ps1", import.meta.url), "utf8");
  assert.match(source, /param\(\[switch\]\$ArchiveIncompleteOwnedCluster\)/);
  assert.match(source, /if \(-not \$ArchiveIncompleteOwnedCluster\)/);
  assert.match(source, /README|READ-ONLY audit complete/);
  assert.match(source, /\$target = Join-Path \$root "\.flytally\\persistent-local-pg16"/);
  assert.match(source, /\$marker = Join-Path \$target "owner\.json"/);
  assert.match(source, /\$envFile = Join-Path \$root "\.env\.test\.local"/);
  assert.match(source, /Get-Content -LiteralPath \$pidPath -TotalCount 4/);
  assert.match(source, /\$postmasterPort -eq \$port/);
  assert.match(source, /\(Canonical \$lines\[1\]\) -ieq \(Canonical \$data\)/);
  assert.match(source, /\$listeners\[0\]\.OwningProcess -eq \$postmasterPid/);
  assert.match(source, /\$listeners\[0\]\.LocalAddress -eq \$expectedIp/);
  assert.match(source, /Assert-NotReparse \$data/);
  assert.match(source, /Assert-NotReparse \(Split-Path -Parent \$target\)/);
  assert.match(source, /& \$pgCtl -D \$data status \| Out-Null/);
  const guard = source.match(/\$LASTEXITCODE -eq 0 -and \$v -match '([^']+)'/);
  assert.ok(guard, "missing pinned native pg_ctl version preflight");
  const versionPattern = new RegExp(guard[1]);
  assert.equal(versionPattern.test("pg_ctl (PostgreSQL) 16.15"), true);
  assert.equal(versionPattern.test("pg_ctl (PostgreSQL) 16.0"), true);
  assert.equal(versionPattern.test("pg_ctl (PostgreSQL) 15.17"), false);
  assert.equal(versionPattern.test("pg_ctl (PostgreSQL) 17.1"), false);
  assert.equal(versionPattern.test("psql (PostgreSQL) 16.15"), false);
  assert.equal(versionPattern.test("pg_ctl (PostgreSQL) 16.15 malicious-extra"), false);
  assert.equal(versionPattern.test("PostgreSQL 16.15"), false);
  assert.match(source, /& \$pgCtl -D \$data -m fast -w -t 30 stop/);
  assert.match(source, /Move-Item -LiteralPath \$target -Destination \$archive/);
  assert.doesNotMatch(source, /Remove-Item|Stop-Process|taskkill|docker rm|rmSync/);
  assert.doesNotMatch(source, /DROP DATABASE|DROP SCHEMA|initdb/);
});


test("recovery script has one complete PowerShell body; Windows parser accepts it", () => {
  const source = readFileSync(new URL("../tooling/recover-incomplete-local-pg16.ps1", import.meta.url), "utf8");
  assert.equal((source.match(/\}\s*finally\s*\{/g) ?? []).length, 1,
    "PowerShell recovery script must have exactly one finally block");
  assert.equal((source.match(/Move-Item -LiteralPath \$target -Destination \$archive/g) ?? []).length, 1,
    "The optional nondeleting archival action must occur exactly once");
  assert.equal((source.match(/READ-ONLY audit complete/g) ?? []).length, 1,
    "The default no-mutation completion must be unique");
  assert.match(source, /\}\s*finally\s*\{\s*Pop-Location\s*\}\s*$/,
    "No duplicated statements may follow the script's finally block");
  if (process.platform === "win32") {
    // Native PowerShell parser is the authoritative syntax check, not JS regex.
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      '$tokens = $null; $parseErrors = $null; ' +
      '[System.Management.Automation.Language.Parser]::ParseFile(' +
      '$env:FLYTALLY_RECOVERY_PS_PATH, [ref]$tokens, [ref]$parseErrors) | Out-Null; ' +
      'if ($parseErrors.Count -ne 0) { ' +
      '$parseErrors | ForEach-Object { Write-Error $_.Message }; exit 1 }',
    ], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        FLYTALLY_RECOVERY_PS_PATH:
          fileURLToPath(new URL("../tooling/recover-incomplete-local-pg16.ps1", import.meta.url)),
      },
      encoding: "utf8", timeout: 15_000, windowsHide: true,
    });
    assert.equal(result.status, 0,
      "PowerShell recovery script parse failed: " + (result.stderr || result.error?.message || ""));
  }
});


test("PG16 physical identity survives accented Czech directory names via hex UTF8", () => {
  const dir = resolve(".flytally", "fixture-prilis-žluťoučký-kůň", "data");
  const encodedDir = Buffer.from(dir, "utf8").toString("hex");
  const valid = "flytally_logbook_test|flytally_local|" + encodedDir + "|127.0.0.1|55439|160015";
  assert.deepEqual(nativeIdentityMismatches(valid, dir), []);
  assert.deepEqual(nativeIdentityMismatches(valid.replace("|160015", "|170001"), dir), ["server-version"]);
  assert.deepEqual(nativeIdentityMismatches(valid.replace("127.0.0.1", "10.0.0.1"), dir), ["server-address"]);
  assert.deepEqual(nativeIdentityMismatches(valid.replace("flytally_local", "postgres"), dir), ["database-user"]);
  assert.deepEqual(nativeIdentityMismatches(valid.replace(encodedDir, "zz"), dir), ["data-directory-encoding"]);
  assert.deepEqual(nativeIdentityMismatches(valid.replace(encodedDir, Buffer.from(resolve(".flytally", "wrong", "data"), "utf8").toString("hex")), dir), ["data-directory"]);
  assert.deepEqual(nativeIdentityMismatches("broken shape", dir), ["column-count"]);
});

test("PG16 SQL identity uses ASCII hex for Unicode data paths and retains bootstrap credential on failure", () => {
  const source = readFileSync(new URL("../tooling/local-native-pg16.mjs", import.meta.url), "utf8");
  assert.match(source, /encode\(convert_to\(current_setting\('data_directory'\), 'UTF8'\), 'hex'\)/);
  assert.match(source, /Buffer\.from\(encodedPath, "hex"\)\.toString\("utf8"\)/);
  assert.match(source, /env\.PGCLIENTENCODING = "UTF8"/);
  assert.match(source, /Native PG16 physical identity mismatch \[/);
  const secretCreated = source.indexOf('writeFileSync(pwfile, parsed.password');
  const dbVerified = source.indexOf('observedIdentity(bin, parsed.password);', secretCreated);
  const markerWritten = source.indexOf('writeFileSync(marker,', dbVerified);
  const envWritten = source.indexOf('writeFileSync(envFile,', markerWritten);
  const secretRemoved = source.indexOf('rmSync(pwfile, { force: true })', envWritten);
  assert.ok(secretCreated >= 0 && secretCreated < dbVerified && dbVerified < markerWritten &&
    markerWritten < envWritten && envWritten < secretRemoved,
    "bootstrap password must survive failures and be removed only after the config has been saved");
});


test("read-only Windows PG16 diagnosis never writes or leaks SQL/credentials", () => {
  const source = readFileSync(new URL("../tooling/diagnose-incomplete-local-pg16.mjs", import.meta.url), "utf8");
  assert.match(source, /const pwfile = join\(home, "bootstrap-pwfile"\)/);
  assert.match(source, /nativePg16Tools\(\)/);
  assert.match(source, /PGCLIENTENCODING = "UTF8"/);
  assert.match(source, /VERBOSITY=sqlstate/);
  assert.match(source, /new TextDecoder\(encoding, \{ fatal: true \}\)/);
  assert.match(source, /\["utf-8", "windows-1250"\]/);
  assert.match(source, /nativeIdentityMismatches\(full\)/);
  assert.match(source, /nativeCoreIdentityMismatches\(core\)/);
  assert.match(source, /READ-ONLY COMPLETE/);
  assert.match(source, /existsSync\(join\(home, "owner.json"\)\)/);
  assert.match(source, /existsSync\(join\(root, "\.env.test.local"\)\)/);
  assert.doesNotMatch(source, /\b(?:writeFileSync|appendFileSync|rmSync|unlinkSync|mkdirSync|renameSync|Move-Item)\b/);
  assert.doesNotMatch(source, /\b(?:ALTER|DROP|CREATE|UPDATE|DELETE|INSERT|TRUNCATE)\b/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^;\n]*(?:password|stdout|stderr|pwfile)/);
  const check = spawnSync(process.execPath, ["--check",
    fileURLToPath(new URL("../tooling/diagnose-incomplete-local-pg16.mjs", import.meta.url))], {
    encoding: "utf8", timeout: 15000, windowsHide: true,
  });
  assert.equal(check.status, 0,
    "Node parser failed on read-only PG16 diagnostic: " + (check.stderr || check.error?.message || ""));
});


test("native PG16 core identity failure identifies only the mismatching field", () => {
  const expected = "flytally_logbook_test|flytally_local|127.0.0.1|55439|160015";
  assert.deepEqual(nativeCoreIdentityMismatches(expected), []);
  assert.deepEqual(nativeCoreIdentityMismatches(expected.replace("flytally_logbook_test", "different_database")), ["database"]);
  assert.deepEqual(nativeCoreIdentityMismatches(expected.replace("flytally_local", "postgres")), ["database-user"]);
  assert.deepEqual(nativeCoreIdentityMismatches(expected.replace("127.0.0.1", "10.0.0.8")), ["server-address"]);
  assert.deepEqual(nativeCoreIdentityMismatches(expected.replace("55439", "5432")), ["server-port"]);
  assert.deepEqual(nativeCoreIdentityMismatches(expected.replace("160015", "170001")), ["server-version"]);
  assert.deepEqual(nativeCoreIdentityMismatches(expected + "|extra"), ["field-count"]);
  assert.deepEqual(nativeCoreIdentityMismatches("unexpected"), ["field-count"]);
  assert.deepEqual(nativeCoreIdentityMismatches(""), ["field-count"]);
});
