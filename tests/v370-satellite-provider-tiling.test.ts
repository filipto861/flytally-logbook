import test from "node:test";
import assert from "node:assert/strict";
import { compareSatelliteProviderTileGrids as compare } from "../lib/satellite-provider-tiling.ts";

// Purely synthetic metadata to test geographic footprint arithmetic;
// these are NOT actual ArcGIS endpoint responses or approved origin values.
const grid = (pixels: number, resolutions: number[], ox = 10, oy = 20) => ({
  tileInfo: {
    rows: pixels, cols: pixels,
    origin: { x: ox, y: oy, spatialReference: { wkid: 102100 } },
    spatialReference: { wkid: 102100, latestWkid: 3857 },
    lods: resolutions.map((resolution, level) => ({ level, resolution })),
  },
});
const base = () => grid(256, [8, 4, 2]);
const labels = () => grid(512, [4, 2, 1]);

test("M3-D provider grid: different pixel dimensions can share the same z/x/y footprint", () => {
  assert.deepEqual(compare(base(), labels(), [0, 1, 2]),
    { outcome: "candidate-compatible", levels: [0, 1, 2] });
});
test("M3-D provider grid: same level but different geographic footprint fails closed", () => {
  assert.deepEqual(compare(base(), grid(512, [8, 4, 2]), [0, 1]),
    { outcome: "unavailable", reason: "different-tile-footprint" });
});
test("M3-D provider grid: shifted origin is not treated as equivalent", () => {
  assert.deepEqual(compare(base(), grid(512, [4, 2, 1], 11), [0]),
    { outcome: "unavailable", reason: "different-origin" });
});
test("M3-D provider grid: missing or implicit zoom remapping is not accepted", () => {
  assert.deepEqual(compare(base(), grid(512, [4]), [0, 1]),
    { outcome: "unavailable", reason: "missing-level" });
});
test("M3-D provider grid: missing, malformed, duplicate metadata and caller levels reject", () => {
  const duplicate = base();
  duplicate.tileInfo.lods.push({ level: 0, resolution: 8 });
  for (const [b, l, levels] of [
    [null, labels(), [0]],
    [base(), null, [0]],
    [duplicate, labels(), [0]],
    [base(), labels(), []],
    [base(), labels(), [0, 0]],
    [base(), labels(), [-1]],
  ] as Array<[unknown, unknown, number[]]>) {
    assert.deepEqual(compare(b, l, levels),
      { outcome: "unavailable", reason: "invalid-evidence" });
  }
});
test("M3-D provider grid: unverified coordinate systems reject", () => {
  const other = labels();
  other.tileInfo.spatialReference.wkid = 4326;
  other.tileInfo.spatialReference.latestWkid = 4326;
  assert.deepEqual(compare(base(), other, [0]),
    { outcome: "unavailable", reason: "unsupported-spatial-reference" });
});
test("M3-D provider grid: numerical differences are not swallowed by guessed tolerances", () => {
  assert.deepEqual(compare(base(), grid(512, [4.00000001, 2, 1]), [0]),
    { outcome: "unavailable", reason: "different-tile-footprint" });
});

test("M3-D provider grid: contradictory WKID aliases cannot masquerade as Web Mercator", () => {
  const other = labels();
  other.tileInfo.spatialReference.wkid = 4326;
  // latestWkid still says 3857: contradictory evidence must fail closed.
  assert.deepEqual(compare(base(), other, [0]),
    { outcome: "unavailable", reason: "unsupported-spatial-reference" });
});
