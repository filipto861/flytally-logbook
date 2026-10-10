/**
 * M3-B observational adapter. Standalone; not connected to the live provider.
 * This deliberately does NOT claim upstream network termination.
 */
import { fetchSatelliteBounded, type SatelliteBoundedFetchOptions, type SatelliteTransportResult } from "./satellite-bounded-fetch";

export type SatelliteLocalLifecycle =
  | { outcome: "success"; started: true; evidence: "body-read-completed" }
  | { outcome: "failure"; started: false; settlement: "not-started"; reason: string }
  | { outcome: "failure"; started: true; settlement: "unproven"; reason: string };

/**
 * Return an accounting-oriented result without ever treating an aborted
 * wrapper or a fetch rejection as proof that supplier work has stopped.
 * Caller MUST quarantine an admitted lease on every unproven failure.
 */
export async function observeSatelliteBoundedFetch(
  options: SatelliteBoundedFetchOptions,
): Promise<{ lifecycle: SatelliteLocalLifecycle; result?: SatelliteTransportResult }> {
  let started = false;
  const original = options?.fetcher;
  const observedFetcher: typeof fetch = ((...args: Parameters<typeof fetch>) => {
    started = true; // Mark before invoking: synchronous throws are uncertain.
    return original(...args);
  }) as typeof fetch;
  try {
    const result = await fetchSatelliteBounded({
      ...options,
      // Keep invalid/missing fetcher invalid instead of masking with adapter.
      fetcher: typeof original === "function" ? observedFetcher : original,
    });
    return { lifecycle: { outcome: "success", started: true, evidence: "body-read-completed" }, result };
  } catch (error) {
    // Error text is not propagated to caller or logged; preserve only an
    // explicitly enumerable, safe reason from the bounded primitive.
    const reason = error && typeof error === "object" && "reason" in error &&
      typeof error.reason === "string" ? error.reason : "upstream";
    return { lifecycle: started
      ? { outcome: "failure", started: true, settlement: "unproven", reason }
      : { outcome: "failure", started: false, settlement: "not-started", reason } };
  }
}
