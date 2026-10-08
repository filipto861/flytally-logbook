import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const manifestPath = fileURLToPath(new URL("./development-modules.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

export function selectDevelopmentTestGroup(id) {
  const group = manifest.testGroups?.[id];
  if (!group) throw new Error("Unknown development test group: " + id);
  const tests = [...new Set(group.tests ?? [])];
  if (tests.length === 0) throw new Error("Development test group has no tests: " + id);
  return tests;
}

export function runDevelopmentTestGroup(id, env = process.env) {
  const tests = selectDevelopmentTestGroup(id);
  console.log("Running development test group " + id + " (" + tests.length + " files).");
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--test",
      "--experimental-strip-types",
      ...tests,
    ],
    { stdio: "inherit", env },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const id = process.argv[2] ?? "";
  try {
    process.exit(runDevelopmentTestGroup(id));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
