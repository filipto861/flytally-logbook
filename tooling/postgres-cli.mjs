import { spawnSync } from "node:child_process";
import { delimiter, dirname } from "node:path";

function resolvePathKey(env) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}

export function preparePostgresCli(env = process.env) {
  const explicit = String(env.FLYTALLY_PSQL ?? "").trim();
  const command = explicit || "psql";
  const pathKey = resolvePathKey(env);
  const inheritedPath = String(env[pathKey] ?? "");

  let nextPath = inheritedPath;
  if (explicit) {
    const binDir = dirname(explicit);
    nextPath = [binDir, inheritedPath].filter(Boolean).join(delimiter);
  }

  return {
    command,
    env: {
      ...env,
      [pathKey]: nextPath,
      PGCONNECT_TIMEOUT: env.PGCONNECT_TIMEOUT || "5",
    },
  };
}

export function probePostgresConnection(
  databaseUrl,
  {
    env = process.env,
    label = "PostgreSQL acceptance",
    failureSuffix = "The gate did not run.",
  } = {},
) {
  const prepared = preparePostgresCli(env);
  const probe = spawnSync(
    prepared.command,
    ["-d", databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "SELECT 1"],
    {
      encoding: "utf8",
      env: prepared.env,
    },
  );

  if (probe.error) {
    const hint = String(env.FLYTALLY_PSQL ?? "").trim()
      ? ""
      : " Set FLYTALLY_PSQL to the absolute psql executable path when PostgreSQL is installed but not on PATH.";
    throw new Error(`${label} requires the psql client: ${probe.error.message}.${hint}`);
  }

  if (probe.status !== 0 || probe.stdout.trim() !== "1") {
    throw new Error(
      `${label} could not connect to DATABASE_URL. ${failureSuffix} ${probe.stderr || probe.stdout}`,
    );
  }

  return prepared.env;
}
