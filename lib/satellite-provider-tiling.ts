/**
 * M3-D: Offline-only geometric comparison of two ArcGIS MapServer-style tileInfo
 * objects supplied by an evidence collector. No network or provider imports.
 *
 * This checks z/x/y geographic footprint equivalence; image size, pixel
 * density and Esri "zoom equivalence" are NOT the same as tile footprint.
 * A compatible result is NOT supplier provenance, decode or license approval.
 */
export type SatelliteGridResult =
  | { outcome: "candidate-compatible"; levels: number[] }
  | { outcome: "unavailable"; reason: "invalid-evidence" | "unsupported-spatial-reference" | "missing-level" | "different-origin" | "different-tile-footprint" };

type Grid = { rows: number; cols: number; ox: number; oy: number; levels: Map<number, number> };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}
function mercator(value: unknown): boolean {
  if (!record(value)) return false;
  return value.wkid === 3857 || value.wkid === 102100 ||
    value.latestWkid === 3857;
}
function parse(value: unknown): Grid | null | "unsupported-spatial-reference" {
  if (!record(value) || !record(value.tileInfo)) return null;
  const tileInfo = value.tileInfo;
  if (!record(tileInfo.origin) || !mercator(tileInfo.spatialReference) ||
      !mercator(tileInfo.origin.spatialReference)) return "unsupported-spatial-reference";
  const origin = tileInfo.origin;
  if (!Number.isSafeInteger(tileInfo.cols) || !positive(tileInfo.cols) ||
      !Number.isSafeInteger(tileInfo.rows) || !positive(tileInfo.rows) ||
      !finite(origin.x) || !finite(origin.y) || !Array.isArray(tileInfo.lods)) return null;
  const levels = new Map<number, number>();
  for (const item of tileInfo.lods) {
    if (!record(item) || !Number.isSafeInteger(item.level) || !finite(item.level) ||
        item.level < 0 || !positive(item.resolution) || levels.has(item.level)) return null;
    levels.set(item.level, item.resolution);
  }
  if (!levels.size) return null;
  return { rows: tileInfo.rows, cols: tileInfo.cols, ox: origin.x, oy: origin.y, levels };
}

/**
 * Deliberately exact: any rounding or origin mismatch requires external
 * source reconciliation. No invented tolerance or implicit level shift.
 */
export function compareSatelliteProviderTileGrids(
  baseMetadata: unknown,
  labelsMetadata: unknown,
  requestedLevels: readonly number[],
): SatelliteGridResult {
  if (!Array.isArray(requestedLevels) || requestedLevels.length === 0 ||
      requestedLevels.some(level => !Number.isSafeInteger(level) || level < 0) ||
      new Set(requestedLevels).size !== requestedLevels.length) {
    return { outcome: "unavailable", reason: "invalid-evidence" };
  }
  const base = parse(baseMetadata);
  const labels = parse(labelsMetadata);
  if (base === "unsupported-spatial-reference" || labels === "unsupported-spatial-reference") {
    return { outcome: "unavailable", reason: "unsupported-spatial-reference" };
  }
  if (!base || !labels) return { outcome: "unavailable", reason: "invalid-evidence" };
  if (base.ox !== labels.ox || base.oy !== labels.oy) {
    return { outcome: "unavailable", reason: "different-origin" };
  }
  for (const level of requestedLevels) {
    const b = base.levels.get(level);
    const l = labels.levels.get(level);
    if (b === undefined || l === undefined) return { outcome: "unavailable", reason: "missing-level" };
    const bWidth = base.cols * b;
    const lWidth = labels.cols * l;
    const bHeight = base.rows * b;
    const lHeight = labels.rows * l;
    if (!finite(bWidth) || !finite(lWidth) || !finite(bHeight) || !finite(lHeight) ||
        bWidth <= 0 || bHeight <= 0 ||
        bWidth !== lWidth || bHeight !== lHeight) {
      return { outcome: "unavailable", reason: "different-tile-footprint" };
    }
  }
  return { outcome: "candidate-compatible", levels: [...requestedLevels] };
}
