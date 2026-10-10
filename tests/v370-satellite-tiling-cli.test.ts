import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("M3-D provider metadata CLI: offline-only and never claims production approval", () => {
  const dir = mkdtempSync(join(tmpdir(), "flytally-grid-lab-"));
  try {
    const metadata = (pixels: number, resolution: number) => ({
      tileInfo: {
        rows: pixels, cols: pixels,
        origin: { x: 10, y: 20, spatialReference: { wkid: 3857 } },
        spatialReference: { wkid: 3857 },
        lods: [{ level: 0, resolution }],
      },
    });
    const base = join(dir, "base.json");
    const labels = join(dir, "labels.json");
    writeFileSync(base, JSON.stringify(metadata(256, 8)));
    writeFileSync(labels, JSON.stringify(metadata(512, 4)));
    const script = fileURLToPath(new URL("../tooling/check-satellite-tiling.mjs", import.meta.url));
    const invoke = () => spawnSync(process.execPath,
      ["--experimental-strip-types", script, base, labels, "0-0"],
      { encoding: "utf8", timeout: 20_000, env: { ...process.env, ARCGIS_ACCESS_TOKEN: "" } });
    const ok = invoke();
    assert.equal(ok.status, 0, ok.stderr);
    const report = JSON.parse(ok.stdout);
    assert.equal(report.outcome, "candidate-compatible");
    assert.equal(report.productionApproval, false);
    assert.equal(report.supplierProvenance, "NOT_VERIFIED_BY_THIS_TOOL");
    writeFileSync(labels, JSON.stringify(metadata(512, 8)));
    const bad = invoke();
    assert.equal(bad.status, 2);
    assert.equal(JSON.parse(bad.stdout).reason, "different-tile-footprint");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
