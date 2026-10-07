import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { probePostgresConnection } from "./postgres-cli.mjs";

const integrationDir = fileURLToPath(new URL("../tests/integration/", import.meta.url));
const manifestPath = fileURLToPath(new URL("./development-modules.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const LOCAL_POSTGRES_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const scaleTests = new Set(
  (manifest.postgresAcceptance?.scaleTests ?? []).map((path) => {
    const prefix = "tests/integration/";
    if (!String(path).startsWith(prefix)) {
      throw new Error("PostgreSQL scale test must live under tests/integration/: " + path);
    }
    return String(path).slice(prefix.length);
  }),
);

export function selectPostgresTests(mode) {
  const allowedModes = new Set(["core", "scale", "full"]);
  if (!allowedModes.has(mode)) {
    throw new Error(`Unknown PostgreSQL test mode: ${mode}. Expected core, scale, or full.`);
  }

  const allTests = readdirSync(integrationDir)
    .filter((name) => name.endsWith(".test.ts"))
    .sort();

  return allTests.filter((name) => {
    if (mode === "full") return true;
    const isScale = scaleTests.has(name);
    return mode === "scale" ? isScale : !isScale;
  });
}

export function preflightPostgresGate(env = process.env) {
  if (!String(env.DATABASE_URL ?? "").trim()) {
    throw new Error("DATABASE_URL is required for PostgreSQL acceptance. The gate did not run.");
  }

  const databaseUrl = String(env.DATABASE_URL).trim();
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL. The gate did not run.");
  }
  if (!LOCAL_POSTGRES_HOSTS.has(parsed.hostname)) {
    throw new Error("PostgreSQL acceptance may only target a localhost database. The gate did not run.");
  }

  return probePostgresConnection(databaseUrl, {
    env,
    label: "PostgreSQL acceptance",
    failureSuffix: "The gate did not run.",
  });
}

export function runPostgresGate(mode, env = process.env) {
  const selected = selectPostgresTests(mode);
  if (selected.length === 0) {
    throw new Error(`No PostgreSQL ${mode} tests were selected.`);
  }

  const gateEnv = preflightPostgresGate(env);

  console.log(`Running ${selected.length} PostgreSQL ${mode} test files.`);
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--test",
      "--experimental-strip-types",
      ...selected.map((name) => join(integrationDir, name)),
    ],
    {
      stdio: "inherit",
      env: {
        ...gateEnv,
        FLYTALLY_POSTGRES_INTEGRATION: "1",
      },
    },
  );

  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] ?? "core";
  try {
    process.exit(runPostgresGate(mode));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
