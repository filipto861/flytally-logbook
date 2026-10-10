// OFFLINE ONLY: compare two locally supplied ArcGIS metadata JSON exports.
// NO network, tokens, supplier calls, account access, production integration.
// Usage: node --experimental-strip-types tooling/check-satellite-tiling.mjs base.json labels.json 0-18
import { readFileSync } from "node:fs";
import { compareSatelliteProviderTileGrids } from "../lib/satellite-provider-tiling.ts";

function levels(input) {
  if (typeof input !== "string" || !/^(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/.test(input)) return null;
  const [start, end] = input.split("-").map(Number);
  // FlyTally map route currently supports levels 0..18. CLI makes range explicit.
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start > end || end > 18) return null;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
const [basePath, labelsPath, range, extra] = process.argv.slice(2);
const requestedLevels = levels(range);
if (!basePath || !labelsPath || extra !== undefined || !requestedLevels) {
  process.stderr.write("Usage: check-satellite-tiling.mjs BASE_METADATA.json LABEL_METADATA.json START-END (within 0..18)\n");
  process.exitCode = 2;
} else {
  let output;
  try {
    const base = JSON.parse(readFileSync(basePath, "utf8"));
    const labels = JSON.parse(readFileSync(labelsPath, "utf8"));
    output = compareSatelliteProviderTileGrids(base, labels, requestedLevels);
  } catch {
    // Never echo local file paths, metadata, errors or possible credentials.
    output = { outcome: "unavailable", reason: "invalid-evidence" };
  }
  process.stdout.write(JSON.stringify({
    schema: "flytally-satellite-grid-evidence-v1",
    ...output,
    supplierProvenance: "NOT_VERIFIED_BY_THIS_TOOL",
    productionApproval: false,
    limitations: [
      "Comparative arithmetic only; input metadata origin/authenticity must be verified separately",
      "Exact float equality can reject valid rounded service metadata; do not invent tolerance",
      "Compatible footprint does not establish pixel decode, license, cost or image alignment",
      "No upstream provider requests were performed"
    ]
  }, null, 2) + "\n");
  if (output.outcome !== "candidate-compatible") process.exitCode = 2;
}
