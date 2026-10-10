// M3-D: explicitly gated, small-footprint *metadata-only* ArcGIS evidence collector.
// NEVER invoked from app runtime or tests. NO imagery/tile requests.
// Run only after explicit owner approval for THREE supplier metadata GETs.
// Only sanitized/allowlisted fields are written to an external (non-repo) dir.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute, join } from "node:path";

const sources = Object.freeze([
  { id: "base", url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=json", auth: true },
  { id: "preferred", url: "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static?f=json", auth: true },
  { id: "fallback", url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer?f=json", auth: false },
]);

const [argDir, argMaxBytes, argTimeout, mode, extra] = process.argv.slice(2);
const baseOnly = mode === "base-only";
const serviceScope = baseOnly ? sources.slice(0, 1) : sources;
const whole = (v) => typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v) &&
  Number.isSafeInteger(Number(v)) && Number(v) > 0 && Number(v) <= 2147483647;
const root = resolve(process.cwd());
const out = typeof argDir === "string" ? resolve(argDir) : "";
const relativeToRepo = out ? relative(root, out) : "";
if (process.env.FLYTALLY_SATELLITE_METADATA_LIVE_APPROVED !== "YES" ||
    !process.env.ARCGIS_ACCESS_TOKEN?.trim() ||
    !argDir || !isAbsolute(argDir) ||
    !whole(argMaxBytes) || !whole(argTimeout) || (mode !== undefined && !baseOnly) || extra !== undefined ||
    !out || (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo))) {
  process.stderr.write("Unavailable: explicit live authorization, external absolute output directory and caller byte/time ceilings required. No supplier request sent.\n");
  process.exit(2);
}
const token = process.env.ARCGIS_ACCESS_TOKEN.trim();
const maxBytes = Number(argMaxBytes);
const timeoutMs = Number(argTimeout);

function record(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function finite(v) { return typeof v === "number" && Number.isFinite(v); }
function mercator(v) {
  if (!record(v)) return false;
  const valid = n => n === 3857 || n === 102100;
  return (valid(v.wkid) || valid(v.latestWkid)) &&
    (v.wkid === undefined || valid(v.wkid)) &&
    (v.latestWkid === undefined || valid(v.latestWkid));
}
function validateTileInfo(value) {
  if (!record(value) || !record(value.tileInfo) || value.error) return false;
  const tile = value.tileInfo;
  if (!Number.isSafeInteger(tile.rows) || tile.rows <= 0 ||
      !Number.isSafeInteger(tile.cols) || tile.cols <= 0 ||
      !record(tile.origin) || !finite(tile.origin.x) || !finite(tile.origin.y) ||
      !mercator(tile.spatialReference) || !mercator(tile.origin.spatialReference) ||
      !Array.isArray(tile.lods) || !tile.lods.length || tile.lods.length > 64) return false;
  if (value.spatialReference !== undefined && !mercator(value.spatialReference)) return false;
  const seen = new Set();
  for (const lod of tile.lods) {
    if (!record(lod) || !Number.isSafeInteger(lod.level) || lod.level < 0 ||
        !finite(lod.resolution) || lod.resolution <= 0 ||
        seen.has(lod.level)) return false;
    seen.add(lod.level);
  }
  return true;
}
function safeMetadata(value) {
  const tile = value.tileInfo;
  const selectSpatial = spatial => ({
    wkid: spatial?.wkid ?? null,
    latestWkid: spatial?.latestWkid ?? null,
  });
  return {
    spatialReference: value.spatialReference ? selectSpatial(value.spatialReference) : null,
    copyrightText: typeof value.copyrightText === "string" ? value.copyrightText.slice(0, 2000) : null,
    tileInfo: {
      rows: tile.rows, cols: tile.cols,
      origin: { x: tile.origin.x, y: tile.origin.y,
        spatialReference: selectSpatial(tile.origin.spatialReference) },
      spatialReference: selectSpatial(tile.spatialReference),
      lods: tile.lods.map(lod => ({level: lod.level, resolution: lod.resolution})),
    },
  };
}

async function collect(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  let finished = false;
  let body;
  try {
    const response = await fetch(source.url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(source.auth ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    body = response.body;
    if (!response.ok) return { outcome: "unavailable", reason: "http-status", status: response.status };
    const ct = response.headers.get("content-type")?.split(";")[0]?.trim()?.toLowerCase();
    const safeCt = ct && /^[a-z0-9._+-]+\/[a-z0-9._+-]+$/.test(ct) ? ct : "invalid-or-missing";
    if (ct !== "application/json" && ct !== "text/plain") return { outcome: "unavailable", reason: "content-type", status: response.status, observedContentType: safeCt };
    if (!body) return { outcome: "unavailable", reason: "empty-body" };
    const declared = response.headers.get("content-length");
    if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) ||
        !Number.isSafeInteger(Number(declared)) || Number(declared) > maxBytes)) {
      return { outcome: "unavailable", reason: "content-length" };
    }
    reader = body.getReader();
    let total = 0;
    const chunks = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || part.value.byteLength > maxBytes - total) {
        return { outcome: "unavailable", reason: "too-large" };
      }
      total += part.value.byteLength;
      chunks.push(part.value.slice());
    }
    if (total === 0) return { outcome: "unavailable", reason: "empty-body" };
    if (declared !== null && total !== Number(declared)) {
      return { outcome: "unavailable", reason: "content-length" };
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value) || value.error) {
      return { outcome: "unavailable", reason: "provider-error" };
    }
    if (!validateTileInfo(value)) return { outcome: "unavailable", reason: "invalid-tile-info" };
    finished = true;
    return {
      outcome: "captured",
      observedBytes: total,
      responseContentType: ct,
      capturedAtUtc: new Date().toISOString(),
      service: source.id,
      metadata: safeMetadata(value),
    };
  } catch {
    return { outcome: "unavailable", reason: "transport-or-json" };
  } finally {
    // Do not fire-and-forget body cancellation: on Windows Node 24 this can race
    // process teardown. The entire cleanup is still bounded by the fetch signal.
    if (!finished) {
      if (reader) {
        try { await reader.cancel("metadata-cleanup"); } catch {}
      } else if (body) {
        try { await body.cancel("metadata-cleanup"); } catch {}
      }
    }
    controller.abort();
    clearTimeout(timer);
    try { reader?.releaseLock(); } catch {}
  }
}

// Fail closed as a bundle: never partially commit output if any of the three
// upstream metadata services cannot be captured under caller-supplied budgets.
const results = [];
for (const source of serviceScope) {
  const result = await collect(source);
  if (result.outcome !== "captured") {
    process.stdout.write(JSON.stringify({
      schema: "flytally-satellite-provider-metadata-v1",
      outcome: "unavailable", service: source.id, reason: result.reason,
      ...(result.status ? { status: result.status } : {}),
      ...(result.observedContentType ? { observedContentType: result.observedContentType } : {}),
      attemptedMetadataRequests: results.length + 1,
      noTileRequests: true,
    }, null, 2) + "\n");
    process.exit(2);
  }
  results.push(result);
}
mkdirSync(out, { recursive: true });
for (const result of results) {
  writeFileSync(join(out, result.service + ".json"),
    JSON.stringify(result.metadata, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
writeFileSync(join(out, "manifest.json"),
  JSON.stringify({
    schema: "flytally-satellite-provider-metadata-v1",
    captured: results.map(({ service, observedBytes, responseContentType, capturedAtUtc }) =>
      ({ service, observedBytes, responseContentType, capturedAtUtc })),
    requests: results.length,
    scope: baseOnly ? "base-only" : "all-three",
    actualProviderMetadata: true,
    geographicCompatibility: "NOT_EVALUATED",
    productionApproval: false,
    constraints: "Explicit scoped metadata GET requests, no tiles; sensitive token not written",
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
process.stdout.write(JSON.stringify({
  schema: "flytally-satellite-provider-metadata-v1",
  outcome: "captured",
  requests: results.length, scope: baseOnly ? "base-only" : "all-three", noTileRequests: true,
  productionApproval: false,
  review: "Provider metadata captured; check provenance, validity and compare grids separately",
}, null, 2) + "\n");
