import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const script = fileURLToPath(new URL("../tooling/collect-satellite-provider-metadata.mjs", import.meta.url));
const outsideDir = resolve(process.cwd(), "..", "SATELLITE_METADATA_TEST_DO_NOT_CREATE");

function invoke(env: Record<string, string | undefined>, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 10000,
  });
}

test("M3-D evidence: collector refuses any request without explicit opt-in", () => {
  const r = invoke({
    ARCGIS_ACCESS_TOKEN: "dummy-sentinel-do-not-log",
    FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "",
  }, [outsideDir, "100", "1000"]);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /No supplier request sent/);
  assert.doesNotMatch(r.stderr, /dummy-sentinel/);
});

test("M3-D evidence: collector rejects missing token, invalid ceilings and repo output", () => {
  const safeArgs = [outsideDir, "100", "1000"];
  const env = { ARCGIS_ACCESS_TOKEN: "", FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" };
  for (const args of [safeArgs, [outsideDir, "0", "1000"], [outsideDir, "100", "-1"],
    [process.cwd(), "100", "1000"], ["relative-output", "100", "1000"]]) {
    const r = invoke({ ...env, ...(args === safeArgs ? {} : { ARCGIS_ACCESS_TOKEN: "synthetic" }) }, args);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /No supplier request sent/);
  }
});
