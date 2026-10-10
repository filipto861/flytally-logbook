// M3-D lab-only snapshot of isolated raster inspection + SVG composition.
// Synthetic 1x1 fixtures; not browser decoding, real supplier traffic,
// concurrent server workload, or a production peak-RSS guarantee.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { inspectSatelliteRaster } from "../lib/satellite-raster-validation.ts";
import { composeSatelliteSvgBounded } from "../lib/satellite-svg-envelope.ts";

const require = createRequire(import.meta.url);
const fixture = require("./satellite-valid-raster-fixtures.cjs");
const loopsArg = process.argv[2] ?? "100";
if (!/^[1-9][0-9]{0,4}$/.test(loopsArg)) throw Error("Expected laboratory iterations 1..99999");
const iterations = Number(loopsArg);
if (process.env.ARCGIS_ACCESS_TOKEN) {
  // Never read or print token, even when locally set.
  throw Error("Laboratory measurement requires ARCGIS_ACCESS_TOKEN unset");
}
const jpegBytes = fixture.jpeg();
const pngBytes = fixture.png();
const totalInputBytes = jpegBytes.byteLength + pngBytes.byteLength;
const base = inspectSatelliteRaster({ contentType: "image/jpeg", bytes: jpegBytes });
const labels = inspectSatelliteRaster({ contentType: "image/png", bytes: pngBytes });
// Derive exact laboratory ceilings from validated synthetic inputs, without
// inventing provider/deployment production limits.
const probe = composeSatelliteSvgBounded(base, labels, {
  maxCombinedEncodedBytes: totalInputBytes,
  maxTotalPixels: 2,
  maxTotalRgbaBytes: 8,
  maxSvgBytes: 4096,
});
const policy = {
  maxCombinedEncodedBytes: totalInputBytes,
  maxTotalPixels: 2,
  maxTotalRgbaBytes: 8,
  maxSvgBytes: probe.svgBytes,
};
const sample = () => {
  const m = process.memoryUsage();
  return { rss: m.rss, heapUsed: m.heapUsed, external: m.external, arrayBuffers: m.arrayBuffers };
};
const baseline = sample();
const peak = { ...baseline };
const observe = () => {
  const current = sample();
  for (const key of Object.keys(peak)) peak[key] = Math.max(peak[key], current[key]);
};
const start = process.hrtime.bigint();
let checksum = 0;
for (let index = 0; index < iterations; index++) {
  const a = inspectSatelliteRaster({ contentType: "image/jpeg", bytes: fixture.jpeg() });
  const b = inspectSatelliteRaster({ contentType: "image/png", bytes: fixture.png() });
  const result = composeSatelliteSvgBounded(a, b, policy);
  checksum += result.svgBytes;
  // Synchronous allocation spikes between samples are not observable.
  observe();
}
const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
const end = sample();
process.stdout.write(JSON.stringify({
  schema: "flytally-satellite-lab-v1",
  kind: "synthetic-1x1-isolated-raster-svg",
  source: fileURLToPath(import.meta.url).split(/[\\/]/).pop(),
  iterations, inputBytesPerPair: totalInputBytes,
  svgBytesPerPair: probe.svgBytes, checksum,
  elapsedMs, baseline, observedPeak: peak, end,
  limitations: [
    "Synthetic 1x1 fixtures only; no supplier tiles or provider contract",
    "No actual pixel decode; structural PNG/JPEG checks only",
    "No fetch/streams, Next.js worker or other concurrent request load",
    "Synchronous process.memoryUsage samples miss transient allocation peaks",
    "This is not a production RSS/concurrency threshold or safety guarantee"
  ]
}, null, 2) + "\n");
