import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { assertLocalFixtureUrl, isLocalDockerEndpoint, assertOwnedContainerMetadata } from "../tooling/local-workflow.mjs";
import { nativeManifestValid, nativePg16Tools } from "../tooling/local-native-pg16.mjs";

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
  assert.match(source, /verifyOwnedFixture\(existingUrl\)/);
  assert.doesNotMatch(source, /docker", \["rm"|docker", \["volume", "rm"/);
});

test("test runner sanitizes inherited libpq routing and never trusts remote env DB", () => {
  const source = readFileSync(new URL("../tooling/local-workflow.mjs", import.meta.url), "utf8");
  assert.match(source, /\/\^PG\[A-Z0-9_\]\+\$\/i/);
  assert.match(source, /env\.DATABASE_URL = ""/);
  assert.match(source, /verifyOwnedFixture\(url\)/);
});
