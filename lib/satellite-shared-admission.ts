/**
 * M3-D1 isolated process/isolate-scoped admission owner.
 * NOT provider-wired. No environment parsing or default resource values.
 * The calling deployment must independently validate its source-backed policy.
 *
 * One owner instance is reused across requests in a single JS isolate.
 * A policy change is never silently accepted after initialization.
 */
import {
  createSatelliteAdmissionGate,
  SatelliteAdmissionError,
  type SatelliteAdmissionGate,
  type SatelliteAdmissionPolicy,
} from "./satellite-admission-gate.ts";

export type SatelliteSharedAdmissionOwner = Readonly<{
  initialize(policy: SatelliteAdmissionPolicy): SatelliteAdmissionGate;
  get(): SatelliteAdmissionGate | null;
}>;

export function createSatelliteSharedAdmissionOwner(): SatelliteSharedAdmissionOwner {
  let gate: SatelliteAdmissionGate | null = null;
  let policy: SatelliteAdmissionPolicy | null = null;
  return {
    initialize(next: SatelliteAdmissionPolicy): SatelliteAdmissionGate {
      // Revalidation must occur even on reinitialization.
      if (!next || !Number.isSafeInteger(next.maxConcurrentOperations) ||
          next.maxConcurrentOperations <= 0 ||
          !Number.isSafeInteger(next.maxReservedEncodedBytes) ||
          next.maxReservedEncodedBytes <= 0) {
        throw new SatelliteAdmissionError("invalid-policy");
      }
      if (gate) {
        if (policy!.maxConcurrentOperations !== next.maxConcurrentOperations ||
            policy!.maxReservedEncodedBytes !== next.maxReservedEncodedBytes) {
          throw new SatelliteAdmissionError("invalid-policy");
        }
        return gate;
      }
      const created = createSatelliteAdmissionGate(next);
      policy = Object.freeze({
        maxConcurrentOperations: next.maxConcurrentOperations,
        maxReservedEncodedBytes: next.maxReservedEncodedBytes,
      });
      gate = created;
      return created;
    },
    get(): SatelliteAdmissionGate | null {
      // Missing explicit initialization is unavailable, not a default gate.
      return gate;
    },
  };
}

// Shared only within this module instance / JS isolate, not across servers.
export const satelliteSharedAdmission = createSatelliteSharedAdmissionOwner();
