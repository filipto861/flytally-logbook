import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("M3-D lab: isolated resource report is synthetic and contains no production ceiling claim", () => {
  const script = fileURLToPath(new URL("../tooling/measure-satellite-lab.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", script, "3",
  ], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, ARCGIS_ACCESS_TOKEN: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, "flytally-satellite-lab-v1");
  assert.equal(report.kind, "synthetic-1x1-isolated-raster-svg");
  assert.equal(report.iterations, 3);
  assert.equal(report.checksum, 3 * report.svgBytesPerPair);
  assert.ok(report.inputBytesPerPair > 0);
  assert.ok(report.svgBytesPerPair > report.inputBytesPerPair);
  for (const key of ["rss", "heapUsed", "external", "arrayBuffers"]) {
    assert.ok(Number.isFinite(report.baseline[key]));
    assert.ok(report.observedPeak[key] >= report.baseline[key]);
  }
  assert.match(report.limitations.join(" "), /not a production RSS/);
});

test("M3-D lab: missing synthetic iteration policy fails closed", () => {
  const script = fileURLToPath(new URL("../tooling/measure-satellite-lab.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", script, "0",
  ], { encoding: "utf8", timeout: 20_000, env: { ...process.env, ARCGIS_ACCESS_TOKEN: "" } });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});
