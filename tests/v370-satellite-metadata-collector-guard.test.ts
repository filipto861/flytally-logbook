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

test("M3-D evidence: non-JSON supplier MIME reports bounded diagnostic and stops after one request", () => {
  const temp = mkdtempSync(join(tmpdir(), "flytally-satellite-mime-"));
  try {
    const output = join(temp, "captured");
    const mock = join(temp, "mock-mime.mjs");
    writeFileSync(mock, `
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  return new Response("<html>not-json</html>", {
    status: 200,
    headers: {"content-type": "text/html; charset=utf-8"}
  });
};
process.on("exit", () => { if (calls !== 1) process.exitCode = 10; });
`);
    const result = spawnSync(process.execPath, [
      "--import", pathToFileURL(mock).href, script, output, "5000", "2000",
    ], {
      env: { ...process.env,
        ARCGIS_ACCESS_TOKEN: "synthetic-unit-test-token",
        FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.service, "base");
    assert.equal(report.reason, "content-type");
    assert.equal(report.status, 200);
    assert.equal(report.observedContentType, "text/html");
    assert.equal(report.attemptedMetadataRequests, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-unit-test-token|not-json/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("M3-D evidence: base-only text/plain structured JSON captures exactly one GET", () => {
  const temp = mkdtempSync(join(tmpdir(), "flytally-satellite-base-"));
  try {
    const output = join(temp, "captured");
    const mock = join(temp, "mock-base.mjs");
    writeFileSync(mock, `
let calls = 0;
globalThis.fetch = async (url, init) => {
  calls++;
  if (new URL(url).hostname !== "ibasemaps-api.arcgis.com" ||
      init.method !== "GET" || init.headers.Authorization !== "Bearer synthetic-unit-test-token")
    throw Error("wrong request");
  const payload = {tileInfo: {
    rows: 256, cols: 256,
    origin: {x: 0, y: 0, spatialReference: {wkid: 3857}},
    spatialReference: {wkid: 3857},
    lods: [{level: 0, resolution: 1}]
  }};
  return new Response(JSON.stringify(payload), {status: 200, headers: {"content-type": "text/plain"}});
};
process.on("exit", () => { if (calls !== 1) process.exitCode = 10; });
`);
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(mock).href,
      script, output, "5000", "2000", "base-only"], {
      env: { ...process.env, ARCGIS_ACCESS_TOKEN: "synthetic-unit-test-token",
        FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.requests, 1);
    assert.equal(report.scope, "base-only");
    assert.equal(JSON.parse(readFileSync(join(output, "base.json"), "utf8")).tileInfo.cols, 256);
    assert.equal(JSON.parse(readFileSync(join(output, "manifest.json"), "utf8")).requests, 1);
    assert.doesNotMatch(r.stdout + r.stderr, /synthetic-unit-test-token/);
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});

test("M3-D evidence: base-only text/plain invalid JSON rejects without writing metadata", () => {
  const temp = mkdtempSync(join(tmpdir(), "flytally-satellite-invalid-"));
  try {
    const output = join(temp, "captured");
    const mock = join(temp, "mock-invalid.mjs");
    writeFileSync(mock, `
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  return new Response("not json", {status: 200, headers: {"content-type": "text/plain"}});
};
process.on("exit", () => { if (calls !== 1) process.exitCode = 10; });
`);
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(mock).href,
      script, output, "5000", "2000", "base-only"], {
      env: { ...process.env, ARCGIS_ACCESS_TOKEN: "synthetic-unit-test-token",
        FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(r.status, 2, r.stderr);
    assert.equal(JSON.parse(r.stdout).outcome, "unavailable");
    assert.match(r.stdout, /transport-or-json/);
    assert.doesNotMatch(r.stdout + r.stderr, /synthetic-unit-test-token|not json/);
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});

test("M3-D2 validation: malformed CRS, origin, LOD and duplicates fail closed", () => {
  const temp = mkdtempSync(join(tmpdir(), "flytally-satellite-validation-"));
  try {
    const mock = join(temp, "mock-invalid-metadata.mjs");
    writeFileSync(mock, `
const variant = process.env.SATELLITE_TEST_VARIANT;
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  const tileInfo = {
    rows: 256, cols: 256,
    origin: { x: 0, y: 0, spatialReference: {wkid: 102100, latestWkid: 3857}},
    spatialReference: {wkid: 102100, latestWkid: 3857},
    lods: [{level: 0, resolution: 156543.033928}]
  };
  if (variant === "origin") tileInfo.origin.x = null;
  if (variant === "crs") tileInfo.spatialReference.wkid = 4326;
  if (variant === "duplicate") tileInfo.lods.push({...tileInfo.lods[0]});
  if (variant === "lod") tileInfo.lods[0].resolution = 0;
  if (variant === "rows") tileInfo.rows = 0;
  const response = new Response(JSON.stringify({tileInfo}), {
    status: 200, headers: {"content-type": "text/plain"}
  });
  return response;
};
process.on("exit", () => { if (calls !== 1) process.exitCode = 10; });
`);
    for (const variant of ["origin", "crs", "duplicate", "lod", "rows"]) {
      const output = join(temp, variant);
      const r = spawnSync(process.execPath, ["--import", pathToFileURL(mock).href,
        script, output, "5000", "2000", "base-only"], {
        env: { ...process.env, SATELLITE_TEST_VARIANT: variant,
          ARCGIS_ACCESS_TOKEN: "synthetic-unit-test-token",
          FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED: "YES" },
        encoding: "utf8", timeout: 15000,
      });
      assert.equal(r.status, 2, variant + ": " + r.stderr);
      assert.equal(JSON.parse(r.stdout).reason, "invalid-tile-info");
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-unit-test-token/);
    }
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});
