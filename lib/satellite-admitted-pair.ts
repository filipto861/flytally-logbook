/**
 * M3-C Batch 2: isolated admitted parallel transport.
 * Not wired into live Satellite provider. All ceilings supplied by caller.
 * This caps each wrapper's wait via M2a, NOT supplier remote termination.
 */
import { admitSatellitePair } from "./satellite-parallel-admission.ts";
import { observeSatelliteBoundedFetch, type SatelliteLocalLifecycle } from "./satellite-fetch-lifecycle.ts";
import type { SatelliteAdmissionGate } from "./satellite-admission-gate.ts";
import type { SatelliteBoundedFetchOptions, SatelliteTransportResult } from "./satellite-bounded-fetch.ts";

export type AdmittedSatelliteResult = Readonly<{
  lifecycle: SatelliteLocalLifecycle;
  result?: SatelliteTransportResult;
}>;

export async function fetchAdmittedSatellitePair(
  gate: SatelliteAdmissionGate,
  base: SatelliteBoundedFetchOptions,
  preferred: SatelliteBoundedFetchOptions,
): Promise<readonly [AdmittedSatelliteResult, AdmittedSatelliteResult]> {
  // Reserve both first: no supplier request is started on partial admission.
  const [baseLease, preferredLease] = admitSatellitePair(gate, base.maxBytes, preferred.maxBytes);
  const run = async (
    options: SatelliteBoundedFetchOptions,
    lease: typeof baseLease,
  ): Promise<AdmittedSatelliteResult> => {
    try {
      const outcome = await observeSatelliteBoundedFetch(options);
      if (outcome.lifecycle.outcome === "failure" &&
          outcome.lifecycle.settlement === "unproven") {
        lease.quarantine();
      } else {
        // "not-started" and successfully completed local stream only.
        // This does NOT guarantee that the remote server stopped its work.
        lease.release();
      }
      return outcome;
    } catch {
      // No unexpected exception can return capacity after starting work.
      lease.quarantine();
      return {
        lifecycle: { outcome: "failure", started: true, settlement: "unproven", reason: "upstream" },
      };
    }
  };
  return Promise.all([run(base, baseLease), run(preferred, preferredLease)]);
}
