import test from "node:test";
import assert from "node:assert/strict";
import {
  composeSatelliteSvgBounded,
  SatelliteSvgEnvelopeError,
  type SatelliteSvgEnvelopePolicy,
} from "../lib/satellite-svg-envelope.ts";
import type { SatelliteRasterStructure } from "../lib/satellite-raster-validation.ts";

// Synthetic lengths and 1px dimensions are LAB inputs, never supplier budgets.
// The SVG envelope expects M2b-validated payloads; these tests isolate sizing
// and do NOT claim to test real PNG/JPEG integrity or pixel decodability.
const base: SatelliteRasterStructure = {
  contentType: "image/jpeg", bytes: Uint8Array.from([1, 2, 3]), width: 1, height: 1,
};
const labels: SatelliteRasterStructure = {
  contentType: "image/png", bytes: Uint8Array.from([5, 6]), width: 1, height: 1,
};
const LAB_POLICY: SatelliteSvgEnvelopePolicy = {
  maxCombinedEncodedBytes: 20,
  maxTotalPixels: 8,
  maxTotalRgbaBytes: 32,
  maxSvgBytes: 1000,
};

function failure(fn: () => unknown, reason: string): void {
  assert.throws(fn, error => {
    assert.ok(error instanceof SatelliteSvgEnvelopeError);
    assert.equal(error.reason, reason);
    return true;
  });
}

test("R2D.2 M2c: output matches existing 256 SVG markup with two Base64 hrefs", () => {
  const result = composeSatelliteSvgBounded(base, labels, LAB_POLICY);
  assert.equal(result.imageCount, 2);
  assert.equal(result.encodedBytes, 5);
  assert.equal(result.totalPixels, 2);
  assert.equal(result.rgbaProjectionBytes, 8);
  assert.equal(result.svgBytes, Buffer.byteLength(result.svg));
  assert.equal(result.svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
    '<image href="data:image/jpeg;base64,AQID" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>' +
    '<image href="data:image/png;base64,BQY=" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>' +
    '</svg>');
});

test("R2D.2 M2c: base-only output is supported without labels", () => {
  const result = composeSatelliteSvgBounded(base, null, LAB_POLICY);
  assert.equal(result.imageCount, 1);
  assert.equal(result.encodedBytes, 3);
  assert.equal(result.totalPixels, 1);
  assert.equal((result.svg.match(/<image /g) ?? []).length, 1);
});

test("R2D.2 M2c: missing, zero, fractional and unsafe policy all fail closed", () => {
  for (const key of Object.keys(LAB_POLICY) as (keyof SatelliteSvgEnvelopePolicy)[]) {
    for (const value of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      failure(() => composeSatelliteSvgBounded(base, null, { ...LAB_POLICY, [key]: value }), "invalid-policy");
    }
  }
  failure(() => composeSatelliteSvgBounded(base, null,
    undefined as unknown as SatelliteSvgEnvelopePolicy), "invalid-policy");
});

test("R2D.2 M2c: invalid raster dimensions, MIME and body reject before output", () => {
  failure(() => composeSatelliteSvgBounded(null as unknown as SatelliteRasterStructure,
    null, LAB_POLICY), "invalid-input");
  failure(() => composeSatelliteSvgBounded({ ...base, bytes: new Uint8Array() },
    null, LAB_POLICY), "invalid-input");
  failure(() => composeSatelliteSvgBounded({
    ...base, contentType: "image/svg+xml" as SatelliteRasterStructure["contentType"],
  }, null, LAB_POLICY), "invalid-input");
  failure(() => composeSatelliteSvgBounded({ ...base, width: 0 }, null, LAB_POLICY), "invalid-input");
  failure(() => composeSatelliteSvgBounded({
    ...base, height: Number.POSITIVE_INFINITY,
  }, null, LAB_POLICY), "invalid-input");
  failure(() => composeSatelliteSvgBounded(base, {
    ...labels, width: 1.5,
  }, LAB_POLICY), "invalid-input");
});

test("R2D.2 M2c: combined encoded cap includes optional labels", () => {
  const policy = { ...LAB_POLICY, maxCombinedEncodedBytes: 4 };
  failure(() => composeSatelliteSvgBounded(base, labels, policy), "combined-encoded-bytes");
  assert.equal(composeSatelliteSvgBounded(base, null, policy).encodedBytes, 3);
});

test("R2D.2 M2c: total pixels and RGBA projection have independent caps", () => {
  failure(() => composeSatelliteSvgBounded(base, labels, {
    ...LAB_POLICY, maxTotalPixels: 1,
  }), "pixel-count");
  failure(() => composeSatelliteSvgBounded(base, labels, {
    ...LAB_POLICY, maxTotalRgbaBytes: 7,
  }), "rgba-projection");
  assert.equal(composeSatelliteSvgBounded(base, labels, {
    ...LAB_POLICY, maxTotalRgbaBytes: 8,
  }).rgbaProjectionBytes, 8);
});

test("R2D.2 M2c: exact final SVG limit passes, one byte below fails", () => {
  const size = composeSatelliteSvgBounded(base, labels, LAB_POLICY).svgBytes;
  assert.equal(composeSatelliteSvgBounded(base, labels, {
    ...LAB_POLICY, maxSvgBytes: size,
  }).svgBytes, size);
  failure(() => composeSatelliteSvgBounded(base, labels, {
    ...LAB_POLICY, maxSvgBytes: size - 1,
  }), "svg-bytes");
});

test("R2D.2 M2c: BigInt protects huge valid dimensions from overflow", () => {
  const oversized: SatelliteRasterStructure = {
    ...base, width: 2147483647, height: 2147483647,
  };
  failure(() => composeSatelliteSvgBounded(oversized, null, LAB_POLICY), "pixel-count");
});
