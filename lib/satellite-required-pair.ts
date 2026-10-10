/**
 * M3-C Batch 3: required-base pair cancellation, ISOLATED / not provider-wired.
 * The whole-tile deadline and sibling abort are independent of uncooperative
 * injected fetchers; M2a retains its own per-request timeout.
 */
import { admitSatellitePair } from "./satellite-parallel-admission.ts";
import { observeSatelliteBoundedFetch, type SatelliteLocalLifecycle } from "./satellite-fetch-lifecycle.ts";
import type { SatelliteAdmissionGate, SatelliteAdmissionLease } from "./satellite-admission-gate.ts";
import type { SatelliteBoundedFetchOptions, SatelliteTransportResult } from "./satellite-bounded-fetch.ts";

export type SatelliteRequiredPairOutcome = Readonly<{
  base: SatelliteLocalLifecycle;
  preferred: SatelliteLocalLifecycle;
  baseRaster?: SatelliteTransportResult;
  preferredRaster?: SatelliteTransportResult;
}>;

function validDeadline(ms: number): boolean {
  return Number.isSafeInteger(ms) && ms > 0 && ms <= 2_147_483_647;
}

/** No fallback or structural image validation is implemented by this helper. */
export async function fetchSatelliteRequiredPair(
  gate: SatelliteAdmissionGate,
  base: SatelliteBoundedFetchOptions,
  preferred: SatelliteBoundedFetchOptions,
  tileDeadlineMs: number,
  callerSignal?: AbortSignal,
  deadlineAtMs?: number,
  now: () => number = () => performance.now(),
): Promise<SatelliteRequiredPairOutcome> {
  if (!validDeadline(tileDeadlineMs) || !base || !preferred ||
      !validDeadline(base.timeoutMs) || !validDeadline(preferred.timeoutMs) ||
      base.signal || preferred.signal ||
      (deadlineAtMs !== undefined && (!Number.isFinite(deadlineAtMs) || typeof now !== "function"))) {
    throw new Error("Satellite required pair: invalid-policy");
  }
  if (callerSignal?.aborted) {
    // Caller has already left; do not even acquire capacity.
    const stopped = { outcome: "failure", started: false, settlement: "not-started", reason: "caller-aborted" } as const;
    return { base: stopped, preferred: stopped };
  }
  const [baseLease, preferredLease] = admitSatellitePair(gate, base.maxBytes, preferred.maxBytes);
  const remaining = deadlineAtMs === undefined ? tileDeadlineMs :
    Math.min(tileDeadlineMs, Math.floor(deadlineAtMs - now()));
  if (!Number.isSafeInteger(remaining) || remaining <= 0) {
    baseLease.release();
    preferredLease.release();
    const expired = { outcome: "failure", started: false, settlement: "not-started", reason: "deadline" } as const;
    return { base: expired, preferred: expired };
  }
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", externalAbort, { once: true });
  if (callerSignal?.aborted) controller.abort();
  // Do not extend total work by restarting per-operation deadlines.
  const timer = setTimeout(() => controller.abort(), remaining);
  const closed = { outcome: "failure", started: true, settlement: "unproven", reason: "upstream" } as const;

  const run = async (options: SatelliteBoundedFetchOptions, lease: SatelliteAdmissionLease) => {
    try {
      const outcome = await observeSatelliteBoundedFetch({
        ...options,
        // Individual signals are rejected above rather than silently ignored.
        signal: controller.signal,
      });
      if (outcome.lifecycle.outcome === "failure" && outcome.lifecycle.settlement === "unproven") {
        lease.quarantine();
      } else {
        lease.release();
      }
      return outcome;
    } catch {
      lease.quarantine();
      return { lifecycle: closed, result: undefined };
    }
  };

  try {
    const basePromise = run(base, baseLease).then(value => {
      if (value.lifecycle.outcome !== "success") controller.abort();
      return value;
    });
    const preferredPromise = run(preferred, preferredLease);
    const [baseOutcome, preferredOutcome] = await Promise.all([basePromise, preferredPromise]);
    return {
      base: baseOutcome.lifecycle,
      preferred: preferredOutcome.lifecycle,
      baseRaster: baseOutcome.result,
      preferredRaster: preferredOutcome.result,
    };
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", externalAbort);
  }
}
