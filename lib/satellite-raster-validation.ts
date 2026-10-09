/**
 * R2D.2 M2b — bounded-payload PNG/JPEG structural safety floor only.
 *
 * Does NOT decode pixels and does NOT prove complete raster decodability.
 * Separate source-backed decoder/format acceptance is required before M3.
 * NOT imported by live Satellite provider or public Standard path.
 */
import type { SatelliteTransportResult, SatelliteRasterMime } from "./satellite-bounded-fetch";

export type SatelliteRasterStructure = SatelliteTransportResult & {
  width: number;
  height: number;
};

export class SatelliteRasterStructureError extends Error {
  constructor() {
    super("Satellite raster structure invalid");
    this.name = "SatelliteRasterStructureError";
  }
}

function invalid(): never {
  throw new SatelliteRasterStructureError();
}

function word(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function dword(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] * 0x1000000) +
    (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) +
    bytes[offset + 3]) >>> 0);
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(bytes: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 + 12 + 13 + 12 ||
      signature.some((value, i) => bytes[i] !== value)) invalid();

  let position = 8;
  let seenHeader = false;
  let seenPalette = false;
  let seenData = false;
  let closedData = false;
  let dataBytes = 0;
  let width = 0, height = 0, color = -1;
  while (position < bytes.length) {
    // Chunk = length:u32 + four ASCII type + data + CRC:u32.
    if (bytes.length - position < 12) invalid();
    const length = dword(bytes, position);
    if (length > bytes.length - position - 12) invalid();
    const typeBytes = bytes.subarray(position + 4, position + 8);
    if (!typeBytes.every(value => (value >= 65 && value <= 90) ||
                                      (value >= 97 && value <= 122)) ||
        (typeBytes[2] & 32) !== 0) invalid(); // PNG reserved type bit.
    const type = String.fromCharCode(...typeBytes);
    const payload = position + 8;
    const crc = dword(bytes, payload + length);
    if (crc32(bytes, position + 4, payload + length) !== crc) invalid();

    if (!seenHeader && type !== "IHDR") invalid();
    if (type === "IHDR") {
      if (seenHeader || length !== 13) invalid();
      seenHeader = true;
      width = dword(bytes, payload);
      height = dword(bytes, payload + 4);
      const depth = bytes[payload + 8];
      color = bytes[payload + 9];
      const validDepth: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8],
        4: [8, 16], 6: [8, 16],
      };
      if (width === 0 || height === 0 ||
          width > 0x7fffffff || height > 0x7fffffff ||
          !validDepth[color]?.includes(depth) ||
          bytes[payload + 10] !== 0 || bytes[payload + 11] !== 0 ||
          ![0, 1].includes(bytes[payload + 12])) invalid();
    } else if (type === "PLTE") {
      if (seenPalette || seenData || length === 0 || length % 3 !== 0 ||
          length > 768 || color === 0 || color === 4) invalid();
      seenPalette = true;
    } else if (type === "IDAT") {
      if (closedData) invalid();
      seenData = true;
      dataBytes += length;
    } else if (type === "IEND") {
      if (length !== 0 || !seenData || dataBytes === 0 ||
          (color === 3 && !seenPalette) ||
          payload + length + 4 !== bytes.length) invalid();
      return { width, height };
    } else {
      // An unknown *critical* chunk cannot be safely ignored.
      if ((typeBytes[0] & 32) === 0) invalid();
      if (seenData) closedData = true;
    }
    position = payload + length + 4;
  }
  return invalid();
}

function jpeg(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
  let position = 2;
  let width = 0, height = 0;
  let seenFrame = false, seenScan = false, inScan = false;

  while (position < bytes.length) {
    if (inScan) {
      // Entropy-coded bytes: FF00 is stuffed FF; FFD0..D7 are restart
      // markers. Other markers terminate the scan.
      while (position < bytes.length) {
        if (bytes[position] !== 0xff) {
          position++;
          continue;
        }
        const start = position;
        while (position < bytes.length && bytes[position] === 0xff) position++;
        if (position === bytes.length) invalid();
        const marker = bytes[position];
        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
          position++;
          continue;
        }
        position = start;
        inScan = false;
        break;
      }
      if (inScan) invalid();
    }

    if (bytes[position++] !== 0xff) invalid();
    while (position < bytes.length && bytes[position] === 0xff) position++;
    if (position >= bytes.length) invalid();
    const marker = bytes[position++];
    if (marker === 0xd9) {
      if (!seenFrame || !seenScan || position !== bytes.length) invalid();
      return { width, height };
    }
    if (marker === 0xd8 || marker === 0x00 ||
        marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) invalid();
    if (position + 2 > bytes.length) invalid();
    const size = word(bytes, position);
    if (size < 2 || size > bytes.length - position) invalid();

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (seenFrame || size < 11 || bytes[position + 2] !== 8) invalid();
      height = word(bytes, position + 3);
      width = word(bytes, position + 5);
      const components = bytes[position + 7];
      if (!width || !height || components < 1 || components > 4 ||
          size !== 8 + 3 * components) invalid();
      seenFrame = true;
    } else if (marker === 0xda) {
      if (!seenFrame || size < 8) invalid();
      const components = bytes[position + 2];
      if (components < 1 || components > 4 || size !== 6 + 2 * components) invalid();
      seenScan = true;
      inScan = true;
    } else if (!(
      marker === 0xc4 || marker === 0xcc || marker === 0xdb ||
      marker === 0xdd || marker === 0xdc || marker === 0xfe ||
      (marker >= 0xe0 && marker <= 0xef)
    )) {
      // Unsupported JPEG coding/extension markers: fail closed.
      invalid();
    }

    position += size;
  }
  return invalid();
}

/** Checks structure and MIME only; NOT proof that pixels can be decoded. */
export function inspectSatelliteRaster(
  payload: SatelliteTransportResult,
): SatelliteRasterStructure {
  if (!payload || !(payload.bytes instanceof Uint8Array)) invalid();
  const mime: SatelliteRasterMime = payload.contentType;
  const dimensions = mime === "image/png" ? png(payload.bytes)
    : mime === "image/jpeg" ? jpeg(payload.bytes) : invalid();
  return { contentType: mime, bytes: payload.bytes, ...dimensions };
}
