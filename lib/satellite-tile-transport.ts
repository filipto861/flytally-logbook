/**
 * M3-C integration seam: one absolute deadline for the required pair and
 * optional labels fallback. Not connected to the live Satellite provider.
 * No budget defaults: limits and a process-local gate belong to the caller.
 *
 * IMPORTANT: This is a deadline/coordination contract, not a proof of
 * supplier termination, PNG/JPEG pixel decode, or deployment-wide limits.
 */
import { SatelliteAdmissionError } from "./satellite-admission-gate.ts";
import { fetchSatelliteRequiredPair } from "./satellite-required-pair.ts";
import { selectSatelliteLabelsWithFallback, type SatelliteFallbackDecision } from "./satellite-label-fallback.ts";
import type { SatelliteAdmissionGate } from "./satellite-admission-gate.ts";
import type { SatelliteBoundedFetchOptions } from "./satellite-bounded-fetch.ts";

export type SatelliteTileTransportOptions = Readonly<{
  gate: SatelliteAdmissionGate;
  base: SatelliteBoundedFetchOptions;
  preferred: SatelliteBoundedFetchOptions;
  fallback: SatelliteBoundedFetchOptions;
  totalDeadlineMs: number;
  signal?: AbortSignal;
  now?: () => number;
}>;

export async function fetchSatelliteTileTransport(
  options: SatelliteTileTransportOptions,
): Promise<SatelliteFallbackDecision> {
  const { gate, base, preferred, fallback, totalDeadlineMs, signal } = options ?? {};
  const clock = options?.now ?? (() => performance.now());
  if (!gate || typeof gate.acquire !== "function" || typeof clock !== "function" ||
      !Number.isSafeInteger(totalDeadlineMs) || totalDeadlineMs <= 0 ||
      totalDeadlineMs > 2_147_483_647) {
    throw new Error("Satellite tile transport: invalid-policy");
  }
  const startedAt = clock();
  const deadlineAt = startedAt + totalDeadlineMs;
  if (!Number.isFinite(startedAt) || startedAt < 0 ||
      !Number.isFinite(deadlineAt) || deadlineAt > Number.MAX_SAFE_INTEGER) {
    throw new Error("Satellite tile transport: invalid-clock");
  }
  if (signal?.aborted) return { outcome: "unavailable" };
  // Absolute deadline is computed once, BEFORE the first supplier starts.
  let pair;
  try {
    pair = await fetchSatelliteRequiredPair(
      gate, base, preferred, totalDeadlineMs, signal, deadlineAt, clock,
    );
  } catch (error) {
    if (error instanceof SatelliteAdmissionError) return { outcome: "unavailable" };
    throw error;
  }
  return selectSatelliteLabelsWithFallback(
    gate, pair, fallback, deadlineAt, signal, clock,
  );
}
