import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { inspectSatelliteRaster } from "../lib/satellite-raster-validation.ts";
import { composeSatelliteSvgBounded } from "../lib/satellite-svg-envelope.ts";

const require = createRequire(import.meta.url);
const fixtures = require("../tooling/satellite-valid-raster-fixtures.cjs") as {
  png(): Buffer; jpeg(): Buffer;
};
const laboratoryPolicy = {
  maxCombinedEncodedBytes: 1000,
  maxTotalPixels: 2,
  maxTotalRgbaBytes: 8,
  maxSvgBytes: 1200,
};
test("M3-D2b: standalone PNG and JPEG fixture payloads are structurally valid", () => {
  const png = inspectSatelliteRaster({ bytes: fixtures.png(), contentType: "image/png" });
  const jpeg = inspectSatelliteRaster({ bytes: fixtures.jpeg(), contentType: "image/jpeg" });
  assert.deepEqual([png.width, png.height, jpeg.width, jpeg.height], [1, 1, 1, 1]);
  assert.equal(png.bytes.byteLength > 0, true);
  assert.equal(jpeg.bytes.byteLength, 159);
});
test("M3-D2b: both fixture types compose under explicit synthetic envelope", () => {
  const base = inspectSatelliteRaster({ bytes: fixtures.jpeg(), contentType: "image/jpeg" });
  const labels = inspectSatelliteRaster({ bytes: fixtures.png(), contentType: "image/png" });
  const output = composeSatelliteSvgBounded(base, labels, laboratoryPolicy);
  assert.equal(output.imageCount, 2);
  assert.equal(output.encodedBytes, base.bytes.byteLength + labels.bytes.byteLength);
  assert.equal(output.svgBytes, Buffer.byteLength(output.svg, "utf8"));
  assert.match(output.svg, /data:image\/jpeg;base64,/);
  assert.match(output.svg, /data:image\/png;base64,/);
});
