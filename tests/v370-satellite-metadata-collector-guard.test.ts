import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

test("M3-D evidence: approved three-request flow is synthetic-mocked, never reaches Esri", () => {
  const temp = mkdtempSync(join(tmpdir(), "flytally-satellite-metadata-"));
  try {
    const output = join(temp, "captured");
    const mock = join(temp, "mock-fetch.mjs");
    writeFileSync(mock, `
const sites = [
  "ibasemaps-api.arcgis.com",
  "static-map-tiles-api.arcgis.com",
  "services.arcgisonline.com"
];
let calls = 0;
globalThis.fetch = async (url, init) => {
  const expected = sites[calls++];
  const host = new URL(url).hostname;
  if (host !== expected || init?.method !== "GET" ||
      init?.redirect !== "error" || init?.cache !== "no-store") throw Error("unexpected synthetic supplier request");
  if (expected !== sites[2] && init?.headers?.Authorization !== "Bearer synthetic-unit-test-token") {
    throw Error("synthetic auth missing");
  }
  if (expected === sites[2] && init?.headers?.Authorization) throw Error("fallback must be unauthenticated");
  const pixels = expected === sites[1] ? 512 : 256;
  const metadata = {
    copyrightText: "Synthetic only",
    token: "must-never-be-copied",
    tileInfo: {
      rows: pixels, cols: pixels,
      origin: {x: 10, y: 20, spatialReference: {wkid: 3857}},
      spatialReference: {wkid: 3857},
      lods: [{level: 0, resolution: 8 * 256 / pixels}]
    }
  };
  return new Response(JSON.stringify(metadata), {headers: {"content-type": "application/json"}});
};
process.on("exit", () => { if (calls !== 3) process.exitCode = 10; });
`);
    const result = spawnSync(process.execPath, [
      "--import", pathToFileURL(mock).href,
      script, output, "5000", "2000",
    ], {
      env: { ...process.env,
        ARCGIS_ACCESS_TOKEN: "synthetic-unit-test-token",
        FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.outcome, "captured");
    assert.equal(report.requests, 3);
    assert.equal(report.productionApproval, false);
    const files = ["base.json", "preferred.json", "fallback.json", "manifest.json"];
    for (const filename of files) {
      const raw = readFileSync(join(output, filename), "utf8");
      assert.doesNotMatch(raw, /synthetic-unit-test-token|must-never-be-copied/);
    }
    const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
    assert.equal(manifest.requests, 3);
    const preferred = JSON.parse(readFileSync(join(output, "preferred.json"), "utf8"));
    assert.equal(preferred.tileInfo.cols, 512);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
