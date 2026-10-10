/**
 * R2D.2 M2c — isolated, caller-budgeted Satellite SVG composition.
 *
 * Expects M2a bounded input followed by M2b structural validation.
 * Does not itself prove decode integrity or a whole-process memory bound.
 * NOT wired into the existing production provider.
 */
import type { SatelliteRasterStructure } from "./satellite-raster-validation.ts";

export type SatelliteSvgEnvelopeReason =
  | "invalid-policy"
  | "invalid-input"
  | "combined-encoded-bytes"
  | "pixel-count"
  | "rgba-projection"
  | "svg-bytes";

export class SatelliteSvgEnvelopeError extends Error {
  readonly reason: SatelliteSvgEnvelopeReason;

  constructor(reason: SatelliteSvgEnvelopeReason) {
    super(`Satellite SVG envelope: ${reason}`);
    this.name = "SatelliteSvgEnvelopeError";
    this.reason = reason;
  }
}

/** All limits are mandatory, validated positive safe integers. No defaults. */
export type SatelliteSvgEnvelopePolicy = Readonly<{
  maxCombinedEncodedBytes: number;
  maxTotalPixels: number;
  maxTotalRgbaBytes: number;
  maxSvgBytes: number;
}>;

export type SatelliteSvgEnvelopeResult = {
  svg: string;
  imageCount: number;
  encodedBytes: number;
  totalPixels: number;
  rgbaProjectionBytes: number;
  svgBytes: number;
};

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">';
const SVG_CLOSE = '</svg>';
const IMAGE_CLOSE = '" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>';

function fail(reason: SatelliteSvgEnvelopeReason): never {
  throw new SatelliteSvgEnvelopeError(reason);
}

function policyNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validatePolicy(policy: SatelliteSvgEnvelopePolicy): void {
  if (!policy || !policyNumber(policy.maxCombinedEncodedBytes) ||
      !policyNumber(policy.maxTotalPixels) ||
      !policyNumber(policy.maxTotalRgbaBytes) ||
      !policyNumber(policy.maxSvgBytes)) fail("invalid-policy");
}

function validateImage(image: SatelliteRasterStructure): void {
  if (!image || !(image.bytes instanceof Uint8Array) ||
      image.bytes.byteLength === 0 ||
      (image.contentType !== "image/png" && image.contentType !== "image/jpeg") ||
      !policyNumber(image.width) || !policyNumber(image.height)) fail("invalid-input");
}

/** Exact Base64 character count for input byte length. */
function base64Chars(bytes: number): bigint {
  return ((BigInt(bytes) + 2n) / 3n) * 4n;
}

/**
 * Checks aggregated encoded bytes, pixel count and nominal RGBA-8 projection
 * and exact final SVG byte count BEFORE Base64 allocation.
 * RGBA width*height*4 is a conventional representation estimate, NOT an
 * upper bound on decoder working memory, other concurrent work or process RSS.
 * Bounds apply to the final chosen base and optional overlay only.
 */
export function composeSatelliteSvgBounded(
  base: SatelliteRasterStructure,
  labels: SatelliteRasterStructure | null,
  policy: SatelliteSvgEnvelopePolicy,
): SatelliteSvgEnvelopeResult {
  validatePolicy(policy);
  validateImage(base);
  if (labels !== null) validateImage(labels);
  const images = labels === null ? [base] : [base, labels];
  let encoded = 0n;
  let pixels = 0n;
  let projectedSvg = BigInt(SVG_OPEN.length + SVG_CLOSE.length);

  for (const image of images) {
    encoded += BigInt(image.bytes.byteLength);
    pixels += BigInt(image.width) * BigInt(image.height);
    const prefix = `<image href="data:${image.contentType};base64,`;
    projectedSvg += BigInt(prefix.length + IMAGE_CLOSE.length) + base64Chars(image.bytes.byteLength);
  }

  if (encoded > BigInt(policy.maxCombinedEncodedBytes)) fail("combined-encoded-bytes");
  if (pixels > BigInt(policy.maxTotalPixels)) fail("pixel-count");
  const rgbaProjection = pixels * 4n;
  if (rgbaProjection > BigInt(policy.maxTotalRgbaBytes)) fail("rgba-projection");
  if (projectedSvg > BigInt(policy.maxSvgBytes)) fail("svg-bytes");

  const markup = images.map(image =>
    `<image href="data:${image.contentType};base64,${Buffer.from(image.bytes).toString("base64")}${IMAGE_CLOSE}`,
  ).join("");
  const svg = `${SVG_OPEN}${markup}${SVG_CLOSE}`;
  // Guard future markup changes from silently violating the projection.
  if (BigInt(Buffer.byteLength(svg, "utf8")) !== projectedSvg) fail("svg-bytes");
  return {
    svg,
    imageCount: images.length,
    encodedBytes: Number(encoded),
    totalPixels: Number(pixels),
    rgbaProjectionBytes: Number(rgbaProjection),
    svgBytes: Number(projectedSvg),
  };
}
