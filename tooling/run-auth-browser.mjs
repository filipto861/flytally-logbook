// Authenticated Playwright browser tests against a disposable local database.
//
//   DATABASE_URL=postgresql://flytally@127.0.0.1:<port>/flytally_currency_test \
//     npm run build && npm run test:browser [-- <playwright args>]
//
// The database is RESET: it is rebuilt from the browser fixture
// (tooling/bootstrap-browser-smoke-db.mjs, schema v1..v19), then migrations
// v20 and v21 are applied schema-first (tooling/apply-currency-v21-disposable.mjs),
// exactly like production. Requirements enforced by those scripts and by the
// runtime guard in lib/currency-v21-migration-safety.ts: host 127.0.0.1, a
// non-default port (not 5432/55432), user `flytally` without password and the
// database name `flytally_currency_test`.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { probePostgresConnection } from "./postgres-cli.mjs";

function fail(message) {
  console.error(message);
  process.exit(2);
}

const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) fail("DATABASE_URL is required (disposable local PostgreSQL). Browser tests did not run.");
let url;
try {
  url = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL must be a valid PostgreSQL URL. Browser tests did not run.");
}
if (url.hostname !== "127.0.0.1") fail(`Browser tests reset the database and only run on 127.0.0.1; got ${url.hostname}.`);
if (process.env.VERCEL !== undefined || process.env.VERCEL_ENV !== undefined) fail("Browser tests must not run inside Vercel.");

const env = {
  ...probePostgresConnection(databaseUrl, { env: process.env, label: "Browser tests", failureSuffix: "Browser tests did not run." }),
  FLYTALLY_AUTH_BROWSER: "1",
  FLYTALLY_LOCAL_POSTGRES: "1",
  FLYTALLY_CURRENCY_V21_BROWSER: "1",
};

function step(script) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
step("./bootstrap-browser-smoke-db.mjs");
step("./apply-currency-v21-disposable.mjs");

const require = createRequire(import.meta.url);
const playwrightCli = join(dirname(require.resolve("@playwright/test/package.json")), "cli.js");
const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", "--config=playwright.config.mjs", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
