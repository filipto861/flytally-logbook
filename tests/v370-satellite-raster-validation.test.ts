import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspectSatelliteRaster, SatelliteRasterStructureError } from "../lib/satellite-raster-validation.ts";
import type { SatelliteRasterMime } from "../lib/satellite-bounded-fetch.ts";

// Valid 1x1 Pillow fixtures (PNG RGB, JPEG grayscale optimize=True), NOT supplier tiles.
// These images are checked against the Pillow encoder outside this test suite.
// 1px is a LAB fixture size, NOT the accepted production tile dimension.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQ8KsDAAFmAOVTZ6irAAAAAElFTkSuQmCC", "base64");
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgFBgcGBQgHBgcJCAgJDBMMDAsLDBgREg4THBgdHRsYGxofIywlHyEqIRobJjQnKi4vMTIxHiU2OjYwOiwwMTD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAABP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AO//Z", "base64");

function inspect(bytes: Uint8Array, contentType: SatelliteRasterMime) {
  return inspectSatelliteRaster({ bytes, contentType });
}

function reject(bytes: Uint8Array, contentType: SatelliteRasterMime): void {
  assert.throws(() => inspect(bytes, contentType), (error: unknown) => {
    assert.ok(error instanceof SatelliteRasterStructureError);
    assert.doesNotMatch(error.message, /https?:|token|secret/i);
    return true;
  });
}

test("R2D.2 M2b: real minimal 1x1 PNG structure accepted", () => {
  const value = inspect(png, "image/png");
  assert.equal(value.width, 1);
  assert.equal(value.height, 1);
  assert.equal(value.bytes, png);
});

test("R2D.2 M2b: real minimal 1x1 baseline JPEG structure accepted", () => {
  assert.equal(jpeg.byteLength, 159);
  assert.equal(createHash("sha256").update(jpeg).digest("hex"),
    "9742593d2affef0b7bffe24cb9d871218fb8b0da92c2d95d05ca9b2832f11216");
  const value = inspect(jpeg, "image/jpeg");
  assert.equal(value.width, 1);
  assert.equal(value.height, 1);
  assert.equal(value.bytes, jpeg);
});

test("R2D.2 M2b: claimed MIME must match file signature", () => {
  reject(png, "image/jpeg");
  reject(jpeg, "image/png");
  reject(Buffer.from("<html>not an image</html>"), "image/png");
  reject(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/jpeg");
});

test("R2D.2 M2b: PNG CRC mismatch and malformed signature fail closed", () => {
  const damaged = Buffer.from(png);
  const imageDataTypeOffset = damaged.indexOf(Buffer.from("IDAT"));
  assert.ok(imageDataTypeOffset > 0);
  damaged[imageDataTypeOffset + 4] ^= 0x01;
  reject(damaged, "image/png");
  const alteredSignature = Buffer.from(png);
  alteredSignature[0] = 0;
  reject(alteredSignature, "image/png");
});

test("R2D.2 M2b: PNG missing IEND, truncated chunks and trailing bytes rejected", () => {
  reject(png.subarray(0, png.length - 12), "image/png");
  reject(png.subarray(0, png.length - 1), "image/png");
  reject(Buffer.concat([png, Buffer.from([1])]), "image/png");
});

test("R2D.2 M2b: PNG disallows duplicate or missing IHDR and invalid chunk order", () => {
  const duplicateHeader = Buffer.concat([png.subarray(0, 33), png.subarray(8)]);
  reject(duplicateHeader, "image/png");
  reject(Buffer.concat([png.subarray(0, 8), png.subarray(33)]), "image/png");
  const changedType = Buffer.from(png);
  const typeOffset = changedType.indexOf(Buffer.from("IDAT"));
  changedType.set(Buffer.from("ABCD"), typeOffset);
  reject(changedType, "image/png");
});

test("R2D.2 M2b: JPEG requires complete SOI/SOS/EOI structure with no trailing bytes", () => {
  reject(jpeg.subarray(0, jpeg.length - 2), "image/jpeg");
  reject(jpeg.subarray(0, jpeg.length - 1), "image/jpeg");
  reject(Buffer.concat([jpeg, Buffer.from([0])]), "image/jpeg");
  const missingSoi = Buffer.from(jpeg);
  missingSoi[1] = 0;
  reject(missingSoi, "image/jpeg");
});

test("R2D.2 M2b: JPEG segment boundary corruption fails closed", () => {
  // First quantization table starts at byte 20, length bytes at 22-23.
  // Decreasing the segment length makes the next expected marker misalign.
  const brokenDqt = Buffer.from(jpeg);
  assert.deepEqual([...brokenDqt.subarray(20, 24)], [0xff, 0xdb, 0x00, 0x43]);
  brokenDqt[23] = 0x42;
  reject(brokenDqt, "image/jpeg");
});

test("R2D.2 M2b: JPEG rejects invalid marker lengths and unsupported coding", () => {
  const short = Buffer.from(jpeg);
  const sof = short.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(sof > 0);
  short[sof + 2] = 0;
  short[sof + 3] = 1;
  reject(short, "image/jpeg");

  const unsupported = Buffer.from(jpeg);
  unsupported[sof + 1] = 0xc3;
  reject(unsupported, "image/jpeg");
});

test("R2D.2 M2b: missing or incorrect output payload fails closed without exposing raw body", () => {
  assert.throws(
    () => inspectSatelliteRaster({ contentType: "image/png", bytes: undefined as unknown as Uint8Array }),
    SatelliteRasterStructureError,
  );
  reject(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg");
});

// Explicit non-claim: the structural parser does NOT decompress PNG IDAT or
// entropy-decode JPEG pixels. Complete decodability/decompression safety and
// real supplier format/effectivity MUST be resolved before production use.
