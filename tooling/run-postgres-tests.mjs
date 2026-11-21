// PostgreSQL integration test runner.
//
// Every integration test file gets its own freshly created, empty database on
// the localhost server named by DATABASE_URL, so destructive or schema-mutating
// tests never share state. The database is dropped afterwards. Files run one at
// a time; several suites expect the fixed name `flytally_currency_test`, so do
// not run two copies of this runner against the same server concurrently.
//
//   npm run test:postgres            # core suite (excludes scale tests)
//   npm run test:postgres -- full    # everything, including scale tests
//   npm run test:postgres -- scale   # scale tests only
//   npm run test:postgres -- core tests/integration/foo.test.ts   # selected files
//
// Only localhost targets are accepted. This runner can never touch Neon.
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { preparePostgresCli, probePostgresConnection } from "./postgres-cli.mjs";

const integrationDir = fileURLToPath(new URL("../tests/integration/", import.meta.url));
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const SCALE_TESTS = new Set([
  "postgres-scale-readiness.test.ts",
  "postgres-v169-production-hardening.test.ts",
  "postgres-v230-large-logbook-performance.test.ts",
]);
// Suites that need a real v1..v20 catalog built before they start.
const NEEDS_V20_SCHEMA = new Set([
  "v380-d3b-full-v20-catalog.test.ts",
  "v380-d3b-zero-delete-counterexample.test.ts",
]);
const DATABASE_NAME = "flytally_currency_test";
const bootstrapV20 = fileURLToPath(new URL("./bootstrap-v20-schema.mjs", import.meta.url));
// Every per-file database is disposable, so the opt-in flags that individual
// destructive suites check for are always granted inside this runner.
const DISPOSABLE_FLAGS = {
  FLYTALLY_POSTGRES_INTEGRATION: "1",
  FLYTALLY_D2_FULL_V20_DISPOSABLE: "1",
  FLYTALLY_D3B_FULL_V20_DISPOSABLE: "1",
  FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE: "1",
  FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE: "1",
  FLYTALLY_V21_RELEASE_DISPOSABLE: "1",
};

export function selectPostgresTests(mode, files = []) {
  if (!["core", "scale", "full"].includes(mode)) {
    throw new Error(`Unknown PostgreSQL test mode: ${mode}. Expected core, scale or full.`);
  }
  const all = readdirSync(integrationDir).filter((name) => name.endsWith(".test.ts")).sort();
  if (files.length > 0) {
    const wanted = new Set(files.map((file) => basename(file)));
    const unknown = [...wanted].filter((name) => !all.includes(name));
    if (unknown.length > 0) throw new Error(`Unknown integration test file(s): ${unknown.join(", ")}`);
    return all.filter((name) => wanted.has(name));
  }
  if (mode === "full") return all;
  return all.filter((name) => (mode === "scale") === SCALE_TESTS.has(name));
}

export function parseLocalDatabaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("DATABASE_URL is required (a localhost PostgreSQL server).");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`PostgreSQL tests may only target localhost; got ${url.hostname}.`);
  }
  return url;
}

function withDatabase(url, name) {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

function admin(url, env, statement) {
  const cli = preparePostgresCli(env);
  const result = spawnSync(
    cli.command,
    ["-d", withDatabase(url, "postgres"), "-X", "-v", "ON_ERROR_STOP=1", "-qc", statement],
    { encoding: "utf8", env: cli.env },
  );
  if (result.status !== 0) throw new Error(`${statement} failed: ${result.stderr || result.stdout}`);
}

export function runPostgresTests(mode, files = [], env = process.env) {
  const url = parseLocalDatabaseUrl(env.DATABASE_URL);
  const selected = selectPostgresTests(mode, files);
  if (selected.length === 0) throw new Error(`No PostgreSQL ${mode} tests selected.`);
  probePostgresConnection(withDatabase(url, "postgres"), { env, label: "PostgreSQL tests" });

  const failed = [];
  for (const name of selected) {
    const database = DATABASE_NAME;
    admin(url, env, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    admin(url, env, `CREATE DATABASE ${database}`);
    const testEnv = { ...env, ...DISPOSABLE_FLAGS, DATABASE_URL: withDatabase(url, database) };
    try {
      console.log(`\n# ${name}`);
      if (NEEDS_V20_SCHEMA.has(name)) {
        const bootstrap = spawnSync(process.execPath, [bootstrapV20], { stdio: "inherit", env: testEnv });
        if (bootstrap.status !== 0) {
          failed.push(name);
          continue;
        }
      }
      const result = spawnSync(
        process.execPath,
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--test",
          "--experimental-strip-types",
          join(integrationDir, name),
        ],
        { stdio: "inherit", env: testEnv },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) failed.push(name);
    } finally {
      admin(url, env, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    }
  }

  console.log(`\nPostgreSQL ${mode}: ${selected.length - failed.length}/${selected.length} files passed.`);
  if (failed.length > 0) console.log(`Failed: ${failed.join(", ")}`);
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode = "core", ...files] = process.argv.slice(2);
  try {
    process.exit(runPostgresTests(mode, files));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
