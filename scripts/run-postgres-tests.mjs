import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "core";
const allowedModes = new Set(["core", "scale", "full"]);
if (!allowedModes.has(mode)) {
  console.error(`Unknown PostgreSQL test mode: ${mode}. Expected core, scale, or full.`);
  process.exit(2);
}

const integrationDir = fileURLToPath(new URL("../tests/integration/", import.meta.url));
const scaleTests = new Set([
  "postgres-scale-readiness.test.ts",
  "postgres-v169-production-hardening.test.ts",
  "postgres-v230-large-logbook-performance.test.ts",
]);
const allTests = readdirSync(integrationDir)
  .filter((name) => name.endsWith(".test.ts"))
  .sort();

const selected = allTests.filter((name) => {
  if (mode === "full") return true;
  const isScale = scaleTests.has(name);
  return mode === "scale" ? isScale : !isScale;
});

if (selected.length === 0) {
  console.error(`No PostgreSQL ${mode} tests were selected.`);
  process.exit(2);
}

console.log(`Running ${selected.length} PostgreSQL ${mode} test files.`);
const result = spawnSync(
  process.execPath,
  [
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--test",
    "--experimental-strip-types",
    ...selected.map((name) => join(integrationDir, name)),
  ],
  { stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
