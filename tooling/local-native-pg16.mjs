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

function run(cmd, args, env = process.env) {
  return spawnSync(cmd, args, { cwd: repo, env, encoding: "utf8", windowsHide: true });
}
function check(result, label) {
  if (result.error || result.status !== 0) {
    // Never echo command arguments or stdout/stderr containing a credential.
    throw new Error(label + " failed. Local fixture NOT verified; inspect the local PostgreSQL log.");
  }
  return String(result.stdout ?? "").trim();
}

export function nativePg16Tools(env = process.env) {
  if (process.platform !== "win32") return null;
  const roots = [
    env.FLYTALLY_PG16_BIN,
    join(env.ProgramFiles || "C:\\Program Files", "PostgreSQL", "16", "bin"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!isAbsolute(root)) continue;
    const bin = Object.fromEntries(["initdb", "pg_ctl", "psql", "createdb"].map(name =>
      [name, join(root, name + ".exe")]));
    if (Object.values(bin).every(existsSync)
      && ["initdb", "pg_ctl", "psql", "createdb"].every(name => {
        const result = run(bin[name], ["--version"], env);
        return !result.error && result.status === 0 && /\b16\.\d+\b/.test(String(result.stdout));
      })) return bin;
  }
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
export function nativeClusterStatus(bin = nativePg16Tools()) {
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
  return env;
}
function observedIdentity(bin, password) {
  const query = "SELECT current_database() || '|' || current_user || '|' || current_setting('data_directory') || '|' || inet_server_addr()::text || '|' || inet_server_port()::text || '|' || current_setting('server_version_num')";
  const output = check(run(bin.psql, [
    "-w", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-h", cfg.hostname, "-p", cfg.port, "-U", cfg.user, "-d", cfg.database,
    "-c", query,
  ], pgEnv(password)), "PostgreSQL physical identity query");
  const fields = output.split("|");
  const expectedDir = resolve(dataDir);
  const physicalDir = fields[2] || "";
  if (fields.length !== 6
    || fields[0] !== cfg.database || fields[1] !== cfg.user
    || !isAbsolute(physicalDir)
    || resolve(physicalDir).toLowerCase() !== expectedDir.toLowerCase()
    || fields[3] !== cfg.hostname || fields[4] !== cfg.port
    || !/^16\d{4}$/.test(fields[5])) {
    throw new Error("Native PG16 physical identity mismatch. The test suite did NOT run.");
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
      check(run(bin.initdb, ["-D", dataDir, "-U", cfg.user,
        "-A", "scram-sha-256", "--pwfile", pwfile, "--encoding=UTF8", "--no-instructions"],
      ), "Initialize dedicated disposable native PG16");
    } finally {
      rmSync(pwfile, { force: true });
    }
    // Marker remains absent until the full first bootstrap succeeds.
    // Failed setup leaves data untouched for manual investigation.
    startNative(bin, parsed.password);
    check(run(bin.createdb, ["-w", "-h", cfg.hostname, "-p", cfg.port,
      "-U", cfg.user, cfg.database], pgEnv(parsed.password)), "Create local acceptance database");
    observedIdentity(bin, parsed.password);
    writeFileSync(marker, JSON.stringify(cfg, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    writeFileSync(envFile, "# Dedicated localhost PostgreSQL acceptance. Never commit.\nDATABASE_URL=" + url + "\n",
      { flag: "wx", mode: 0o600 });
    return "CREATED";
  }
  startNative(bin, parsed.password);
  observedIdentity(bin, parsed.password);
  return "REUSED";
}
function startNative(bin, password) {
  ownedDir();
  const status = run(bin.pg_ctl, ["-D", dataDir, "status"]);
  if (status.error) throw new Error("Cannot inspect owned native PG16 process.");
  if (status.status !== 0) {
    check(run(bin.pg_ctl, ["-D", dataDir, "-l", log,
      "-o", "-h 127.0.0.1 -p 55439", "-w", "-t", "30", "start"], pgEnv(password)),
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
