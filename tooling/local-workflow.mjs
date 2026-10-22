// Local-only convenience facade. Canonical gate/fixture logic remains in existing tooling.
// This file intentionally works identically in BOTH separate FlyTally repositories.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

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
    "FLYTALLY_BROWSER_EVIDENCE_FILE", "VERCEL", "VERCEL_ENV",
  ]) delete env[name];
  if (logbook && findPsql()) env.FLYTALLY_PSQL = findPsql();
  if (database) {
    const url = testUrl();
    if (!url) throw new Error("Missing .env.test.local. Run npm run setup:db first.");
    assertLocalFixtureUrl(url);
    env[db.key] = url;
    if (!logbook) {
      env.TRAINING_DATABASE_URL = url; // only the verified dedicated local fixture
      env.TRAINING_ACCEPTANCE_CONFIRM_DISPOSABLE = "I_UNDERSTAND_THIS_IS_DISPOSABLE";
    } else if (browser) {
      env.FLYTALLY_AUTH_BROWSER = "1";
      env.FLYTALLY_LOCAL_POSTGRES = "1";
    }
  }
  return env;
}
function dockerInfo() {
  return has("docker", ["info", "--format", "{{.ServerVersion}}"]);
}
function ownedContainerInfo() {
  const inspected = exec("docker", ["container", "inspect", db.container], { quiet: true });
  if (inspected.status !== 0) return null;
  let c;
  try { c = JSON.parse(inspected.stdout)[0]; } catch { throw new Error("Docker inspect returned invalid output."); }
  const binding = c?.HostConfig?.PortBindings?.["5432/tcp"] ?? [];
  if (c?.Config?.Image !== "postgres:16"
    || binding.length !== 1 || binding[0].HostIp !== "127.0.0.1"
    || binding[0].HostPort !== db.port) {
    throw new Error("A container has the reserved name but is not our expected local-only PG16 fixture.");
  }
  return c;
}
function ensureDatabase() {
  const existingUrl = testUrl(); // validates before Docker operations
  if (!dockerInfo()) {
    if (existingUrl) {
      console.log("[DB] Existing dedicated localhost URL preserved (Docker unavailable; connectivity NOT VERIFIED).");
      return;
    }
    throw new Error("Docker engine is unavailable. Existing DB is untouched; install/start Docker or configure a dedicated local fixture manually.");
  }
  const container = ownedContainerInfo();
  if (container) {
    if (!existingUrl) throw new Error("Reserved Docker container exists but .env.test.local is missing. Refusing to reset or recover credentials automatically.");
    if (!container.State.Running) checked(exec("docker", ["start", db.container]), "Docker start");
    console.log("[DB] Reusing existing dedicated PG16 container; no reset or migration.");
    return;
  }
  if (existingUrl) {
    console.log("[DB] Existing dedicated localhost configuration preserved; no new Docker container created.");
    return;
  }
  const password = randomBytes(24).toString("hex");
  const url = "postgresql://flytally_local:" + password + "@127.0.0.1:" + db.port + "/" + db.database;
  const result = exec("docker", [
    "run", "--detach", "--name", db.container, "--restart", "no",
    "--publish", "127.0.0.1:" + db.port + ":5432",
    "--env", "POSTGRES_USER=flytally_local",
    "--env", "POSTGRES_DB=" + db.database,
    "--env", "POSTGRES_PASSWORD=" + password,
    "postgres:16",
  ], { quiet: true });
  if (result.status !== 0 || result.error) throw new Error("Could not create isolated local PG16 container: " + (result.stderr || result.error?.message || "unknown error"));
  // Exclusive write: never overwrite a user's pre-existing machine configuration.
  writeFileSync(localFile, "# GENERATED LOCAL DISPOSABLE TEST FIXTURE. NEVER COMMIT.\n" + db.key + "=" + url + "\n",
    { flag: "wx", mode: 0o600 });
  console.log("[DB] Created isolated localhost PG16 fixture and .env.test.local (credentials not printed).");
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
  console.log("Docker engine: " + (dockerInfo() ? "READY" : "NOT AVAILABLE (optional when existing local DB is used)"));
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
  if (testUrl() || dockerInfo() || requireDb) {
    ensureDatabase();
  } else {
    console.log("[DB] Not configured and Docker unavailable. Quick non-DB tests remain available; use npm run setup:db after preparing Docker.");
  }
  await doctor();
}
function delegate(action, args = []) {
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
  const needsDb = action === "db-test" || action === "browser-test" || action === "full";
  // For Logbook, a release risk gate can decide that DB/browser evidence is N/A.
  const configured = existsSync(localFile);
  const env = safeEnv({ database: needsDb && (configured || action === "db-test" || action === "browser-test"), browser: logbook && needsDb });
  if (!logbook && action === "full" && !configured) throw new Error("Training full browser gate requires a dedicated localhost database: npm run setup:db.");
  if (logbook && action === "full" && !configured) console.log("[NOTE] DB/browser evidence will fail closed if required by the risk plan.");
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
      case "quick": case "full": case "db-test": case "browser-test": delegate(action, args); break;
      default: throw new Error("Usage: node tooling/local-workflow.mjs doctor|setup [--with-db]|db|quick|full|db-test|browser-test");
    }
  } catch (e) { console.error("[BLOCKED] " + (e instanceof Error ? e.message : String(e))); process.exitCode = 2; }
}
