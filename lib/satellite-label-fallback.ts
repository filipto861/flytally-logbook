/**
 * M3-C Batch 4 — standalone post-pair label fallback decision.
 * An absolute deadline is supplied by the earlier tile lifecycle: fallback
 * must NOT restart the tile budget. Not connected to the live provider.
 * Structural raster inspection is NOT proof of pixel decodability.
 */
import { inspectSatelliteRaster, type SatelliteRasterStructure } from "./satellite-raster-validation.ts";
import { observeSatelliteBoundedFetch, type SatelliteLocalLifecycle } from "./satellite-fetch-lifecycle.ts";
import type { SatelliteRequiredPairOutcome } from "./satellite-required-pair.ts";
import type { SatelliteAdmissionGate } from "./satellite-admission-gate.ts";
import type { SatelliteBoundedFetchOptions } from "./satellite-bounded-fetch.ts";

export type SatelliteFallbackDecision = Readonly<{
  base?: SatelliteRasterStructure;
  labels?: SatelliteRasterStructure;
  outcome: "unavailable" | "preferred" | "fallback" | "base-only";
}>;

const FALLBACK_REASONS = new Set(["upstream", "status", "content-type", "content-encoding",
  "content-length", "too-large", "empty-body", "incomplete-body"]);

function inspect(payload: SatelliteRequiredPairOutcome["baseRaster"]): SatelliteRasterStructure | null {
  if (!payload) return null;
  try { return inspectSatelliteRaster(payload); } catch { return null; }
}

/**
 * Called only AFTER the admitted required pair has returned.
 * `deadlineAtMs` must be inherited from the start of that same tile, not
 * recomputed at entry here. `now` is injected for deterministic tests.
 */
export async function selectSatelliteLabelsWithFallback(
  gate: SatelliteAdmissionGate,
  pair: SatelliteRequiredPairOutcome,
  fallback: SatelliteBoundedFetchOptions,
  deadlineAtMs: number,
  signal?: AbortSignal,
  now: () => number = Date.now,
): Promise<SatelliteFallbackDecision> {
  const base = inspect(pair?.baseRaster);
  if (!base || pair.base.outcome !== "success") return { outcome: "unavailable" };
  if (signal?.aborted) return { outcome: "unavailable" };
  const preferred = inspect(pair.preferredRaster);
  if (preferred && pair.preferred.outcome === "success") {
    return { outcome: "preferred", base, labels: preferred };
  }
  if (!Number.isSafeInteger(deadlineAtMs) || typeof now !== "function" ||
      !fallback || !Number.isSafeInteger(fallback.timeoutMs) || fallback.timeoutMs <= 0 ||
      fallback.signal || !Number.isSafeInteger(fallback.maxBytes) || fallback.maxBytes <= 0) {
    return { outcome: "base-only", base };
  }
  // A preferred raster may have passed transport but failed structural
  // validation; this is an explicit fall-back-eligible failure class.
  const preferredBadStructure = pair.preferred.outcome === "success" && !preferred;
  const permitted = preferredBadStructure || (pair.preferred.outcome === "failure" &&
    FALLBACK_REASONS.has(pair.preferred.reason));
  if (!permitted) return { outcome: "base-only", base };
  const remaining = deadlineAtMs - now();
  if (!Number.isSafeInteger(remaining) || remaining <= 0) return { outcome: "base-only", base };
  if (signal?.aborted) return { outcome: "unavailable" };

  let lease;
  try { lease = gate.acquire(fallback.maxBytes); }
  catch { return { outcome: "base-only", base }; }
  try {
    const outcome = await observeSatelliteBoundedFetch({
      ...fallback,
      timeoutMs: Math.min(fallback.timeoutMs, remaining),
      signal,
    });
    if (outcome.lifecycle.outcome === "failure" && outcome.lifecycle.settlement === "unproven") {
      lease.quarantine();
    } else {
      lease.release();
    }
    if (signal?.aborted) return { outcome: "unavailable" };
    if (outcome.lifecycle.outcome !== "success") return { outcome: "base-only", base };
    const labels = inspect(outcome.result);
    return labels ? { outcome: "fallback", base, labels } : { outcome: "base-only", base };
  } catch {
    lease.quarantine();
    return { outcome: "base-only", base };
  }
}
