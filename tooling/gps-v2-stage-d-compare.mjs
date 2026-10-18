#!/usr/bin/env node
/**
 * Local read-only GPS comparison. No network, database, flight writes, automatic
 * label inference or raw-track output. Results go to stdout only.
 *
 * Run with repository's pinned Node 24:
 * node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-compare.mjs --file "C:\path\track.kml" --id sample01
 */
import {readFileSync, statSync} from "node:fs";
import {extname} from "node:path";
import {compareGpsV2StageD} from "../research/gps-detection-r21/stage-d-comparator.ts";

const USAGE = "Usage: node --experimental-strip-types tooling/gps-v2-stage-d-compare.mjs --file <local.kml|gpx|csv> [--id anonymous-id] [--cuts 20,80]";
function fail(reason) {
  process.stderr.write("Stage D comparator: " + reason + ". No source data was printed.\n");
  process.exitCode = 1;
}
function argsOf(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!["--file", "--id", "--cuts"].includes(key) || !value || values.has(key))
      return null;
    values.set(key, value);
  }
  if (!values.has("--file")) return null;
  return values;
}
const args = argsOf(process.argv.slice(2));
if (!args) {
  process.stderr.write(USAGE + "\n");
  process.exitCode = 2;
} else {
  const file = args.get("--file");
  const ext = extname(file).toLowerCase();
  if (![".kml", ".gpx", ".csv"].includes(ext)) {
    fail("unsupported file extension");
  } else {
    try {
      // Deliberately bounded; do not read huge source files into memory.
      if (statSync(file).size > 2_000_000) {
        fail("file exceeds the 2 MB research input limit");
      } else {
        const cutsRaw = args.get("--cuts");
        const cuts = cutsRaw === undefined ? [] : cutsRaw.split(",").map(value =>
          /^\d+$/.test(value) ? Number(value) : NaN
        );
        const result = compareGpsV2StageD({
          sourceText: readFileSync(file, "utf8"),
          fileName: "anonymous" + ext,
          anonymousSampleId: args.get("--id") ?? null,
          splitCuts: cuts,
        });
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        if (result.status !== "DIAGNOSTIC_ONLY") process.exitCode = 2;
      }
    } catch {
      // Filesystem errors can contain names/paths, so never log raw exception.
      fail("file unavailable or unreadable");
    }
  }
}
