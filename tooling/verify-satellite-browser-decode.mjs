// Explicit, offline-only browser decode acceptance for synthetic Satellite tiles.
// No Next server, credentials, supplier requests or changes to app state.
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import { inspectSatelliteRaster } from "../lib/satellite-raster-validation.ts";
import { composeSatelliteSvgBounded } from "../lib/satellite-svg-envelope.ts";

if (process.env.ARCGIS_ACCESS_TOKEN) throw Error("Unset ARCGIS_ACCESS_TOKEN for offline browser test");
const require = createRequire(import.meta.url);
const fixtures = require("./satellite-valid-raster-fixtures.cjs");
const base = inspectSatelliteRaster({ contentType: "image/jpeg", bytes: fixtures.jpeg() });
const overlay = inspectSatelliteRaster({ contentType: "image/png", bytes: fixtures.png() });
const pairSize = base.bytes.byteLength + overlay.bytes.byteLength;
const bytesOfSvg = (inputBytes) => 4 * Math.ceil(inputBytes / 3);
const estimatedMax = 1024 + bytesOfSvg(base.bytes.length) + bytesOfSvg(overlay.bytes.length);
const svg = composeSatelliteSvgBounded(base, overlay, {
  maxCombinedEncodedBytes: pairSize,
  maxTotalPixels: 2,
  maxTotalRgbaBytes: 8,
  maxSvgBytes: estimatedMax,
}).svg;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", route => {
    // Only data: URLs are valid in this isolated test. Never use remote resources.
    if (route.request().url().startsWith("data:")) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto("about:blank");
  const result = await page.evaluate(async ({ pngBase64, jpegBase64, svg }) => {
    const decode = (url) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Synthetic raster decode failed"));
      img.src = url;
    });
    const png = await decode("data:image/png;base64," + pngBase64);
    const jpeg = await decode("data:image/jpeg;base64," + jpegBase64);
    const svgImage = await decode("data:image/svg+xml;base64," + btoa(svg));
    return { png, jpeg, svgImage };
  }, {
    pngBase64: fixtures.png().toString("base64"),
    jpegBase64: fixtures.jpeg().toString("base64"),
    svg,
  });
  if (result.png.width !== 1 || result.png.height !== 1 ||
      result.jpeg.width !== 1 || result.jpeg.height !== 1 ||
      result.svgImage.width !== 256 || result.svgImage.height !== 256) {
    throw Error("Unexpected synthetic browser decoded dimensions");
  }
  process.stdout.write(JSON.stringify({
    schema: "flytally-satellite-browser-lab-v1",
    status: "PASS",
    browser: "playwright-chromium-headless",
    fixture: "synthetic-1x1-png-jpeg-in-256x256-svg",
    dimensions: result,
    limitations: [
      "Not supplier imagery or source-backed supplier format/dimension proof",
      "Chromium only, not iPad Safari or other browsers",
      "Decode smoke test only, not pixel fidelity or working set / peak RSS guarantee",
      "No production route, provider network, or multi-worker load"
    ]
  }, null, 2) + "\n");
} finally {
  await browser?.close();
}
