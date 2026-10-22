// Local-only convenience facade. Canonical gate/fixture logic remains in existing tooling.
// This file intentionally works identically in BOTH separate FlyTally repositories.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve, dirname, delimiter } from "node:path";
import { nativePg16Tools, nativeMarkerExists, nativeClusterStatus, ensureNativePg16, createNativePg16 } from "./local-native-pg16.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const logbook = packageInfo.name === "pilot-logbook-web";
if (!logbook && packageInfo.name !== "flytally-training") {
  throw new Error("Unsupported repository; refusing local environment operations.");
}
const db = logbook
  ? { container: "flytally-logbook-local-pg16", database: "flytally_logbook_test", port: "55439", key: "DATABASE_URL" }
  : { container: "flytally-training-local-pg16", database: "flytally_training_acceptance_test", port: "55440", key: "TRAINING_ACCEPTANCE_DATABASE_URL" };
const localFile = join(root, ".env.test.local");

function exec(binary, args, { env = process.env, quiet = false } = {}) {
  const result = spawnSync(binary, args, {
    cwd: root, env, encoding: "utf8", stdio: quiet ? "pipe" : "inherit",
    windowsHide: true,
  });
  return result;
}
function npm(args, env = process.env, quiet = false) {
  // npm_execpath avoids Windows .cmd / shell quoting when invoked from npm run.
  const npmCli = process.env.npm_execpath;
  if (npmCli && existsSync(npmCli)) return exec(process.execPath, [npmCli, ...args], { env, quiet });
  return spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: root, env, encoding: "utf8", stdio: quiet ? "pipe" : "inherit",
    shell: process.platform === "win32", windowsHide: true,
  });
}
function checked(result, label) {
  if (result.error) throw new Error(label + ": " + result.error.message);
  if (result.status !== 0) throw new Error(label + " failed (exit " + result.status + ").");
}
function has(binary, args = ["--version"]) {
  const result = exec(binary, args, { quiet: true });
  return !result.error && result.status === 0;
}
function testUrl() {
  if (!existsSync(localFile)) return null;
  const matching = readFileSync(localFile, "utf8")
    .split(/\r?\n/).filter(line => line.startsWith(db.key + "="));
  if (matching.length !== 1) throw new Error(".env.test.local needs exactly one " + db.key + " assignment.");
  const raw = matching[0].slice(db.key.length + 1).trim();
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid local test database URL."); }
  // No wildcard, production name, default port or remote endpoint is accepted.
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || url.port !== db.port
    || url.pathname !== "/" + db.database || url.username !== "flytally_local"
    || !url.password || url.search || url.hash) {
    throw new Error("Local fixture identity mismatch. Refusing any database operation.");
  }
  if (!logbook && process.env.TRAINING_DATABASE_URL === raw) {
    throw new Error("Acceptance URL matches TRAINING_DATABASE_URL; refusing.");
  }
  return raw;
}
export function assertLocalFixtureUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Invalid URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || url.port !== db.port
    || url.pathname !== "/" + db.database || url.username !== "flytally_local"
    || !url.password || url.search || url.hash) {
    throw new Error("Not the dedicated local disposable database.");
  }
  return true;
}
function findPsql() {
  const native = nativePg16Tools();
  if (native) return native.psql;
  if (process.env.FLYTALLY_PSQL && has(process.env.FLYTALLY_PSQL)) return process.env.FLYTALLY_PSQL;
  if (has("psql")) return "psql";
  if (process.platform === "win32") {
    const base = process.env.ProgramFiles || "C:\\Program Files";
    for (const v of ["18", "17", "16", "15"]) {
      const candidate = join(base, "PostgreSQL", v, "bin", "psql.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}
function safeEnv({ database = false, browser = false } = {}) {
  const env = { ...process.env };
  for (const name of [
    "DATABASE_URL", "TRAINING_DATABASE_URL", "TRAINING_ACCEPTANCE_DATABASE_URL",
    "TRAINING_ACCEPTANCE_CONFIRM_DISPOSABLE",
    "FLYTALLY_OWNED_PG16_RELEASE", "FLYTALLY_PR340_PARTITION_RELEASE",
    "FLYTALLY_CURRENCY_V21_BROWSER", "FLYTALLY_V21_RISK_BROWSER",
    "FLYTALLY_BROWSER_EVIDENCE_FILE", "FLYTALLY_PORTABLE_LOCAL_BROWSER",
    "FLYTALLY_AUTH_BROWSER", "FLYTALLY_LOCAL_POSTGRES", "VERCEL", "VERCEL_ENV",
  ]) delete env[name];
  // Inherited libpq/psql routing settings must never redirect or mutate acceptance.
  // The inspected fixture URL supplies all necessary host/user/database credentials.
  for (const name of Object.keys(env)) {
    if (/^PG[A-Z0-9_]+$/i.test(name)) delete env[name];
  }
  // Explicit empty process variables prevent Next.js from loading a remote .env.local DB URL.
  env.DATABASE_URL = "";
  env.TRAINING_DATABASE_URL = "";
  env.TRAINING_ACCEPTANCE_DATABASE_URL = "";
  if (logbook && findPsql()) {
    const psql = findPsql();
    env.FLYTALLY_PSQL = psql;
    // Production local adapter and several legacy PG tests spawn literal "psql".
    // Put the existing psql.exe folder on PATH; don't modify machine PATH.
    if (psql !== "psql") {
      const key = Object.keys(env).find(k => k.toLowerCase() === "path") || "PATH";
      env[key] = dirname(psql) + delimiter + (env[key] || "");
    }
  }
  if (database) {
    const url = testUrl();
    if (!url) throw new Error("Missing .env.test.local. Run npm run setup:db first.");
    verifyOwnedFixture(url); // required before any database-writing test command
    env[db.key] = url;
    if (!logbook) {
      env.TRAINING_DATABASE_URL = url; // only the verified dedicated local fixture
      env.TRAINING_ACCEPTANCE_CONFIRM_DISPOSABLE = "I_UNDERSTAND_THIS_IS_DISPOSABLE";
    } else if (browser) {
      env.FLYTALLY_AUTH_BROWSER = "1";
      env.FLYTALLY_LOCAL_POSTGRES = "1";
      env.FLYTALLY_PORTABLE_LOCAL_BROWSER = "1"; // never reuse an unrelated server on port 3000
    }
  }
  return env;
}
export function isLocalDockerEndpoint(value) {
  const endpoint = String(value ?? "").trim().replaceAll("\\", "/").toLowerCase();
  return endpoint.startsWith("unix:///") ||
    (endpoint.startsWith("npipe:") && endpoint.includes("/./pipe/"));
}
function dockerInfo() {
  const context = exec("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { quiet: true });
  const endpoint = String(process.env.DOCKER_HOST ?? "").trim() || (context.status === 0 ? context.stdout.trim() : "");
  if (!isLocalDockerEndpoint(endpoint)) return false; // remote Docker contexts are NOT local fixtures
  return has("docker", ["info", "--format", "{{.ServerVersion}}"]);
}
export function assertOwnedContainerMetadata(container, raw, { requireRunning = true } = {}) {
  assertLocalFixtureUrl(raw);
  const binding = container?.HostConfig?.PortBindings?.["5432/tcp"] ?? [];
  const environment = new Set(container?.Config?.Env ?? []);
  const expectedPassword = new URL(raw).password;
  if (container?.Name !== "/" + db.container
    || container?.Config?.Image !== "postgres:16"
    || !environment.has("POSTGRES_DB=" + db.database)
    || !environment.has("POSTGRES_USER=flytally_local")
    || !environment.has("POSTGRES_PASSWORD=" + expectedPassword)
    || binding.length !== 1 || binding[0].HostIp !== "127.0.0.1"
    || binding[0].HostPort !== db.port
    || (requireRunning && container?.State?.Running !== true)) {
    throw new Error("Database container identity, credentials, binding or running state do not match the owned disposable fixture.");
  }
  return true;
}
function ownedContainerInfo() {
  const inspected = exec("docker", ["container", "inspect", db.container], { quiet: true });
  if (inspected.error) throw new Error("Docker inspect failed: " + inspected.error.message);
  if (inspected.status !== 0) return null;
  try { return JSON.parse(inspected.stdout)[0] ?? null; }
  catch { throw new Error("Docker inspect returned invalid output."); }
}
function verifyOwnedFixture(raw) {
  if (nativeMarkerExists()) {
    ensureNativePg16(raw); // start only our owned persistent PG16, then prove physical identity
    return;
  }
  if (!dockerInfo()) throw new Error("Local Docker engine is required to prove fixture ownership before database-writing tests.");
  const container = ownedContainerInfo();
  if (!container) throw new Error("Dedicated disposable container missing. Run npm run setup:db first.");
  assertOwnedContainerMetadata(container, raw);
  let ready = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const check = exec("docker", ["exec", db.container, "pg_isready",
      "-U", "flytally_local", "-d", db.database], { quiet: true });
    if (!check.error && check.status === 0) { ready = true; break; }
    if (attempt < 24) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!ready) {
    throw new Error("Owned disposable PostgreSQL is not ready; no acceptance test executed.");
  }
}
function ensureDatabase() {
  const existingUrl = testUrl(); // validates before any operation
  if (nativeMarkerExists()) {
    if (!existingUrl) throw new Error("Owned native PG16 exists without .env.test.local. No recovery or overwrite performed.");
    const status = ensureNativePg16(existingUrl);
    console.log("[DB] " + status + " dedicated persistent Windows PG16 cluster; data preserved.");
    return;
  }
  if (!existingUrl && nativePg16Tools()) {
    const status = createNativePg16();
    console.log("[DB] " + status + " persistent native PG16. Next reboot only requires setup:local.");
    return;
  }
  if (!dockerInfo()) {
    throw new Error("Local Docker engine unavailable. No test DB was accessed; non-DB verification remains possible.");
  }
  const container = ownedContainerInfo();
  if (container) {
    if (!existingUrl) throw new Error("Reserved Docker container exists but .env.test.local is missing. Refusing automatic recovery.");
    assertOwnedContainerMetadata(container, existingUrl, { requireRunning: false });
    if (!container.State.Running) checked(exec("docker", ["start", db.container]), "Docker start");
    verifyOwnedFixture(existingUrl);
    console.log("[DB] Reusing verified dedicated PG16 container; no reset or migration.");
    return;
  }
  if (existingUrl) {
    throw new Error("Local configuration exists without its owned Docker container. Refusing to use an unverified database.");
  }
  const volumeName = "flytally-logbook-local-pg16-data";
  const volumeProbe = exec("docker", ["volume", "inspect", volumeName], { quiet: true });
  if (volumeProbe.error) throw new Error("Unable to inspect existing local Docker volume.");
  if (volumeProbe.status === 0) {
    throw new Error("Reserved Docker volume already exists without the matching owned container. Refusing unverified volume reuse.");
  }
  if (!/no such volume/i.test(String(volumeProbe.stderr ?? ""))) {
    throw new Error("Docker volume inspection was inconclusive. No container will be created.");
  }
  const password = randomBytes(24).toString("hex");
  const url = "postgresql://flytally_local:" + password + "@127.0.0.1:" + db.port + "/" + db.database;
  const result = exec("docker", [
    "run", "--detach", "--name", db.container, "--restart", "unless-stopped",
    "--publish", "127.0.0.1:" + db.port + ":5432",
    "--mount", "type=volume,source=" + volumeName + ",target=/var/lib/postgresql/data",
    "--env", "POSTGRES_USER=flytally_local",
    "--env", "POSTGRES_DB=" + db.database,
    "--env", "POSTGRES_PASSWORD=" + password,
    "postgres:16",
  ], { quiet: true });
  if (result.status !== 0 || result.error) throw new Error("Could not create isolated local PG16 container: " + (result.stderr || result.error?.message || "unknown error"));
  // Exclusive write: never overwrite a user's pre-existing machine configuration.
  writeFileSync(localFile, "# GENERATED LOCAL DISPOSABLE TEST FIXTURE. NEVER COMMIT.\n" + db.key + "=" + url + "\n",
    { flag: "wx", mode: 0o600 });
  verifyOwnedFixture(url); // wait for startup and prove new fixture is usable
  console.log("[DB] Created and verified isolated localhost PG16 fixture and .env.test.local (credentials not printed).");
  if (!logbook) {
    // Newly created, dedicated localhost Training DB only. Never initialize a remote or reused DB here.
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (exec("docker", ["exec", db.container, "pg_isready", "-U", "flytally_local", "-d", db.database], { quiet: true }).status === 0) {
        ready = true; break;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
    if (!ready) throw new Error("New Training PG16 container did not become ready; no schema bootstrap was attempted.");
    checked(npm(["run", "db:init"], safeEnv({ database: true })), "Training local DB bootstrap");
    console.log("[DB] Training-local schema initialized and verified.");
  }
}
async function browserInstalled() {
  try {
    const { chromium } = await import("@playwright/test");
    return existsSync(chromium.executablePath());
  } catch { return false; }
}
async function doctor() {
  console.log("FlyTally " + (logbook ? "Logbook" : "Training") + " — read-only local diagnostics");
  const version = Number(process.versions.node.split(".")[0]);
  console.log("Node >=24: " + (version >= 24 ? "OK" : "MISSING (installed: " + process.version + ")"));
  console.log("Git: " + (has("git") ? "OK" : "MISSING"));
  console.log("npm dependencies: " + (npm(["ls", "--depth=0"], process.env, true).status === 0 ? "OK" : "MISSING/INCOMPLETE"));
  console.log("Playwright Chromium: " + (await browserInstalled() ? "OK" : "MISSING"));
  console.log("Native PG16 tools: " + (nativePg16Tools() ? "AVAILABLE" : "NOT FOUND"));
  console.log("Native PG16 owned cluster: " + nativeClusterStatus());
  console.log("Docker engine: " + (dockerInfo() ? "READY" : "NOT AVAILABLE (native PG16 may be used instead)"));
  if (logbook) {
    console.log("psql client: " + (findPsql() ? "OK" : "MISSING (set FLYTALLY_PSQL or install PostgreSQL client)"));
  }
  try {
    const configured = testUrl();
    console.log("Dedicated local database: " + (configured ? "URL VERIFIED (connectivity not checked)" : "NOT CONFIGURED"));
  } catch (e) { console.log("Dedicated local database: BLOCKED — " + e.message); }
}
async function setup({ requireDb = false } = {}) {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node.js 24 is required. No changes made.");
  if (npm(["ls", "--depth=0"], process.env, true).status !== 0) {
    console.log("[Dependencies] Incomplete; running npm ci once.");
    checked(npm(["ci"]), "npm ci");
  } else console.log("[Dependencies] Existing installation retained.");
  if (!(await browserInstalled())) {
    console.log("[Playwright] Chromium missing; installing browser once.");
    checked(npm(["exec", "--", "playwright", "install", "chromium"]), "Playwright browser install");
  } else console.log("[Playwright] Existing Chromium retained.");
  if (nativeMarkerExists() || nativePg16Tools() || dockerInfo()) {
    ensureDatabase();
  } else if (requireDb) {
    throw new Error("Neither native PostgreSQL 16 server tools nor local Docker are available; database setup is blocked.");
  } else {
    console.log("[DB] No owned database configured and no native PG16/Docker engine found. Non-DB tests remain available.");
  }
  await doctor();
  checked(npm(["run", "test:local-workflow"], safeEnv()), "local workflow safety contract");
  console.log("[Setup] Local dependency and safety-contract setup completed. Use test:quick or test:full for candidate evidence.");
}
function releaseNeedsDatabase(args) {
  const candidate = args.length ? args : ["--base", "origin/main"];
  const result = exec(process.execPath, [join(root, "tooling", "verify-plan.mjs"), ...candidate, "--json"], {
    env: safeEnv(), quiet: true,
  });
  if (result.error || (result.status !== 0 && result.status !== 3)) {
    throw new Error("Unable to determine release risk: " + (result.error?.message || String(result.stderr).trim() || "unknown planner error"));
  }
  let plan;
  try { plan = JSON.parse(result.stdout).plan; }
  catch { throw new Error("Invalid JSON from authoritative release risk planner."); }
  return Boolean(plan?.postgres || plan?.scale || plan?.browser);
}
function delegate(action, args = []) {
  if (action === "quick" && args.includes("--with-browser")) {
    throw new Error("Browser acceptance requires the guarded full gate or test:browser:local.");
  }
  if (action === "quick" || action === "full") checked(npm(["run", "test:local-workflow"], safeEnv()), "local workflow safety tests");
  if (action === "db-init") {
    if (logbook) throw new Error("db-init:local is a Training-only operation.");
    checked(npm(["run", "db:init"], safeEnv({ database: true })), "Training local DB bootstrap");
    return;
  }
  const selected = action === "quick"
    ? (logbook ? ["run", "verify:iterate", "--", ...(args.length ? args : ["--base", "origin/main"])]
      : ["run", "typecheck"])
    : action === "full"
      ? (logbook ? ["run", "verify:release:risk", "--", ...(args.length ? args : ["--base", "origin/main"])]
        : ["run", "verify"])
      : action === "db-test"
        ? (logbook ? ["run", "test:postgres:full"] : ["run", "test:no-code-aircraft"])
        : action === "browser-test"
          ? (logbook ? ["run", "test:browser"] : ["exec", "--", "playwright", "test", ...args])
          : null;
  if (!selected) throw new Error("Unknown test command.");
  const needsDb = action === "db-test" || action === "browser-test"
    || (action === "full" && releaseNeedsDatabase(args));
  // The authoritative risk planner decides whether the release needs a DB.
  // No Docker requirement or connection for docs-only / source-only releases.
  const env = safeEnv({ database: needsDb, browser: needsDb && action !== "db-test" });
  if (needsDb) console.log("[DB] Verified owned localhost fixture before test execution.");
  checked(npm(selected, env), selected.join(" "));
  if (!logbook && action === "quick") checked(npm(["run", "test:ui"], env), "Training focused UI tests");
  if (!logbook && action === "full") checked(npm(["exec", "--", "playwright", "test"], env), "Training responsive Playwright");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2);
  try {
    switch (action) {
      case "doctor": await doctor(); break;
      case "setup": await setup({ requireDb: args.includes("--with-db") }); break;
      case "db": ensureDatabase(); break;
      case "quick": case "full": case "db-test": case "browser-test": case "db-init": delegate(action, args); break;
      default: throw new Error("Usage: node tooling/local-workflow.mjs doctor|setup [--with-db]|db|quick|full|db-test|browser-test|db-init");
    }
  } catch (e) { console.error("[BLOCKED] " + (e instanceof Error ? e.message : String(e))); process.exitCode = 2; }
}
