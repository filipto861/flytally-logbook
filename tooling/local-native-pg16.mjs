// FlyTally Logbook: reusable local-only native PostgreSQL 16 fixture.
// Never adopts a pre-existing server or arbitrary PGDATA directory.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const home = join(repo, ".flytally", "persistent-local-pg16");
const dataDir = join(home, "data");
const marker = join(home, "owner.json");
const log = join(home, "postgres.log");
const envFile = join(repo, ".env.test.local");
const cfg = Object.freeze({
  schemaVersion: 1,
  owner: "flytally-logbook-local-acceptance",
  engine: "native-pg16",
  hostname: "127.0.0.1",
  port: "55439",
  user: "flytally_local",
  database: "flytally_logbook_test",
});

function run(cmd, args, env = process.env, timeout = 12_000, { showProgress = false } = {}) {
  return spawnSync(cmd, args, {
    cwd: repo, env, encoding: "utf8", windowsHide: true,
    // First-time initdb and pg_ctl startup can take time; show their native progress.
    // No interactive stdin and no passwords in command-line arguments.
    stdio: showProgress ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    timeout, maxBuffer: 2 * 1024 * 1024,
  });
}
function check(result, label) {
  if (result.error || result.status !== 0) {
    // No credential-bearing command line or raw stdout/stderr in an error.
    const timeout = result.error?.code === "ETIMEDOUT" ? " (timed out)" : "";
    throw new Error(label + " failed" + timeout + ". Local fixture NOT verified; inspect the local PostgreSQL log.");
  }
  return String(result.stdout ?? "").trim();
}

export function nativePg16Tools(env = process.env, { diagnostic = false } = {}) {
  if (process.platform !== "win32") return null;
  const roots = [
    env.FLYTALLY_PG16_BIN,
    join(env.ProgramFiles || "C:\\Program Files", "PostgreSQL", "16", "bin"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!isAbsolute(root)) continue;
    if (diagnostic) console.log("[PG16] Inspecting native PostgreSQL 16 binaries in " + root);
    const bin = Object.fromEntries(["initdb", "pg_ctl", "psql", "createdb"].map(name =>
      [name, join(root, name + ".exe")]));
    if (Object.values(bin).every(existsSync)
      && ["initdb", "pg_ctl", "psql", "createdb"].every(name => {
        if (diagnostic) console.log("[PG16] Checking " + name + ".exe version...");
        const result = run(bin[name], ["--version"], env, 7_000);
        return !result.error && result.status === 0 && /\b16\.\d+\b/.test(String(result.stdout));
      })) {
      if (diagnostic) console.log("[PG16] All four native PG16 tools detected.");
      return bin;
    }
  }
  if (diagnostic) console.log("[PG16] Complete native PG16 toolchain not found.");
  return null;
}

export function nativeManifestValid(value) {
  return Boolean(value && typeof value === "object"
    && Object.entries(cfg).every(([key, expected]) => value[key] === expected)
    && Object.keys(value).length === Object.keys(cfg).length);
}

function ownedDir() {
  // Never follow a symlink/junction out of the known gitignored local fixture.
  if (!existsSync(dataDir)) throw new Error("Owned native PG16 data directory missing. No database operation.");
  const actual = realpathSync.native(dataDir);
  if (actual.toLowerCase() !== resolve(dataDir).toLowerCase()) {
    throw new Error("Native PG16 data directory is redirected; refusing to use it.");
  }
  if (readFileSync(join(dataDir, "PG_VERSION"), "utf8").trim() !== "16") {
    throw new Error("Expected PostgreSQL 16 data directory; refusing an alternate cluster.");
  }
}
function readMarker() {
  if (!existsSync(marker)) return null;
  const value = JSON.parse(readFileSync(marker, "utf8"));
  if (!nativeManifestValid(value)) throw new Error("Native PG16 ownership marker mismatch.");
  ownedDir();
  return value;
}
export function nativeMarkerExists() { return existsSync(marker); }
export function nativePartialClusterExists() { return existsSync(home) && !nativeMarkerExists(); }
export function nativeClusterStatus(bin = nativePg16Tools()) {
  if (nativePartialClusterExists()) return "INCOMPLETE (manual inspection required; no automatic reset)";
  if (!nativeMarkerExists()) return "NOT CONFIGURED";
  if (!bin) return "TOOLS MISSING";
  try {
    readMarker();
    return run(bin.pg_ctl, ["-D", dataDir, "status"]).status === 0 ? "RUNNING" : "STOPPED";
  } catch { return "INVALID OWNERSHIP"; }
}
function pgEnv(password) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^PG[A-Z0-9_]+$/i.test(key)) delete env[key];
  }
  env.PGPASSWORD = password;
  env.PGCONNECT_TIMEOUT = "5";
  // Windows libpq/psql can default to a legacy Czech code page (e.g. CP1250).
  // Keep all text exchanged with Node UTF-8, never rely on console encoding.
  env.PGCLIENTENCODING = "UTF8";
  return env;
}

// The data-directory field is transmitted as ASCII hex of UTF-8 bytes.
// Otherwise psql running on Czech Windows can transcode "č"/"í" into CP1250,
// which spawnSync({ encoding: "utf8" }) would replace with U+FFFD.
export function nativeIdentityMismatches(output, expectedDir = resolve(dataDir)) {
  const fields = String(output ?? "").trim().split("|");
  if (fields.length !== 6) return ["column-count"];
  const failures = [];
  if (fields[0] !== cfg.database) failures.push("database");
  if (fields[1] !== cfg.user) failures.push("database-user");
  const encodedPath = fields[2];
  if (!/^(?:[0-9a-f]{2})+$/i.test(encodedPath)) {
    failures.push("data-directory-encoding");
  } else {
    const physicalDir = Buffer.from(encodedPath, "hex").toString("utf8");
    if (!isAbsolute(physicalDir)
      || resolve(physicalDir).toLowerCase() !== resolve(expectedDir).toLowerCase()) {
      failures.push("data-directory");
    }
  }
  if (fields[3] !== cfg.hostname) failures.push("server-address");
  if (fields[4] !== cfg.port) failures.push("server-port");
  if (!/^16\d{4}$/.test(fields[5])) failures.push("server-version");
  return failures;
}

function observedIdentity(bin, password) {
  const query = "SELECT current_database() || '|' || current_user || '|' || encode(convert_to(current_setting('data_directory'), 'UTF8'), 'hex') || '|' || inet_server_addr()::text || '|' || inet_server_port()::text || '|' || current_setting('server_version_num')";
  const output = check(run(bin.psql, [
    "-w", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-h", cfg.hostname, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database,
    "-c", query,
  ], pgEnv(password)), "PostgreSQL physical identity query");
  const mismatches = nativeIdentityMismatches(output);
  if (mismatches.length) {
    // The field names are safe; never print the physical path, username value,
    // query output, connection string, or PostgreSQL password.
    throw new Error("Native PG16 physical identity mismatch [" + mismatches.join(", ") +
      "]. The test suite did NOT run.");
  }
}

export function ensureNativePg16(url, { allowCreate = false } = {}) {
  const bin = nativePg16Tools();
  if (!bin) throw new Error("Local PostgreSQL 16 server tools missing. No test database accessed.");
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("Invalid native fixture URL."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)
    || parsed.username !== cfg.user || !parsed.password
    || parsed.hostname !== cfg.hostname || parsed.port !== cfg.port
    || parsed.pathname !== "/" + cfg.database || parsed.search || parsed.hash) {
    throw new Error("Native PG16 fixture URL does not match the exclusively owned localhost identity.");
  }
  if (!readMarker()) {
    if (!allowCreate) throw new Error("Native PG16 ownership marker absent. Refusing unowned database.");
    if (existsSync(home) || existsSync(envFile)) {
      throw new Error("Local PostgreSQL folder/config already exists. Refusing to replace or adopt it.");
    }
    mkdirSync(home, { recursive: true });
    const pwfile = join(home, "bootstrap-pwfile");
    try {
      writeFileSync(pwfile, parsed.password + "\n", { flag: "wx", mode: 0o600 });
      console.log("[PG16] First-time initialization of dedicated local data directory (no existing DB replaced).");
      check(run(bin.initdb, ["-D", dataDir, "-U", cfg.user,
        "-A", "scram-sha-256", "--pwfile", pwfile, "--encoding=UTF8", "--no-instructions"],
        process.env, 90_000, { showProgress: true }), "Initialize dedicated disposable native PG16");
    } finally {
      rmSync(pwfile, { force: true });
    }
    // Marker remains absent until the full first bootstrap succeeds.
    // Failed setup leaves data untouched for manual investigation.
    console.log("[PG16] Cluster initialized. Starting owned PostgreSQL 16 process...");
    startNative(bin, parsed.password);
    console.log("[PG16] Server started. Creating empty, dedicated acceptance database...");
    check(run(bin.createdb, ["-w", "-h", cfg.hostname, "-p", cfg.port,
      "-U", cfg.user, cfg.database], pgEnv(parsed.password), 20_000), "Create local acceptance database");
    observedIdentity(bin, parsed.password);
    console.log("[PG16] Physical database identity verified. Saving ownership marker...");
    writeFileSync(marker, JSON.stringify(cfg, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    writeFileSync(envFile, "# Dedicated localhost PostgreSQL acceptance. Never commit.\nDATABASE_URL=" + url + "\n",
      { flag: "wx", mode: 0o600 });
    return "CREATED";
  }
  console.log("[PG16] Existing owned cluster detected. Checking process and physical identity...");
  startNative(bin, parsed.password);
  observedIdentity(bin, parsed.password);
  return "REUSED";
}
function startNative(bin, password) {
  ownedDir();
  const status = run(bin.pg_ctl, ["-D", dataDir, "status"]);
  if (status.error) throw new Error("Cannot inspect owned native PG16 process.");
  if (status.status !== 0) {
    console.log("[PG16] Starting stopped owned PG16 process (existing data is preserved)...");
    check(run(bin.pg_ctl, ["-D", dataDir, "-l", log,
      "-o", "-h 127.0.0.1 -p 55439", "-w", "-t", "30", "start"], pgEnv(password), 40_000,
      { showProgress: true }),
    "Start existing owned native PG16");
  }
}
export function createNativePg16() {
  if (existsSync(home) || existsSync(envFile)) {
    throw new Error("Existing PG16 fixture path or config found. Will not overwrite or reinitialize.");
  }
  const password = randomBytes(24).toString("hex");
  const url = "postgresql://" + cfg.user + ":" + password + "@127.0.0.1:" + cfg.port + "/" + cfg.database;
  return ensureNativePg16(url, { allowCreate: true });
}
