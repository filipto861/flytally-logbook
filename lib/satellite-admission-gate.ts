/**
 * R2D.2 M2c-B — process-local admission/reservation ledger.
 *
 * Standalone; NOT used by the live Satellite provider yet.
 * Callers supply every numeric policy and per-operation reservation.
 * This is NOT a deployment-wide concurrency or process RSS guarantee:
 * unrelated requests, decoder allocations, non-cooperative upstreams and
 * additional server instances remain outside this ledger's control.
 */
export type SatelliteAdmissionReason =
  | "invalid-policy"
  | "invalid-reservation"
  | "reservation-too-large"
  | "concurrency-exhausted"
  | "capacity-exhausted";

export class SatelliteAdmissionError extends Error {
  readonly reason: SatelliteAdmissionReason;

  constructor(reason: SatelliteAdmissionReason) {
    super(`Satellite admission: ${reason}`);
    this.name = "SatelliteAdmissionError";
    this.reason = reason;
  }
}

export type SatelliteAdmissionPolicy = Readonly<{
  maxConcurrentOperations: number;
  maxReservedEncodedBytes: number;
}>;

export type SatelliteAdmissionSnapshot = Readonly<{
  activeOperations: number;
  reservedEncodedBytes: number;
}>;

export type SatelliteAdmissionLease = Readonly<{
  /** Normal completion ONLY after actual upstream work has settled. */
  release(): void;
  /** Irreversible: retain capacity when actual termination cannot be proved. */
  quarantine(): void;
}>;

export type SatelliteAdmissionGate = Readonly<{
  acquire(reserveEncodedBytes: number): SatelliteAdmissionLease;
  snapshot(): SatelliteAdmissionSnapshot;
  /** Process-local count of permanently retained uncertain operations. */
  quarantinedCount(): number;
}>;

function fail(reason: SatelliteAdmissionReason): never {
  throw new SatelliteAdmissionError(reason);
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Per-created-instance, synchronous, non-queuing admission.
 *
 * Reserve the caller's full *configured per-fetch byte ceiling* before
 * launching upstream work. A lease must be released only after transport work has actually ceased.
 * If cancellation/settlement is uncertain, quarantine the lease BEFORE a
 * finally release. Quarantine permanently retains capacity for this gate
 * until its process lifetime ends; no timer-based recovery is permitted.
 *
 * This ledger does not allocate the reserved bytes. All values must be
 * validated against an independently source-backed production policy
 * before any integration into the provider.
 */
export function createSatelliteAdmissionGate(
  policy: SatelliteAdmissionPolicy,
): SatelliteAdmissionGate {
  if (!policy || !positiveSafeInteger(policy.maxConcurrentOperations) ||
      !positiveSafeInteger(policy.maxReservedEncodedBytes)) {
    fail("invalid-policy");
  }
  const maxBytes = BigInt(policy.maxReservedEncodedBytes);
  let active = 0;
  let reserved = 0n;
  let quarantined = 0;

  return {
    acquire(reserveEncodedBytes: number): SatelliteAdmissionLease {
      if (!positiveSafeInteger(reserveEncodedBytes)) fail("invalid-reservation");
      const amount = BigInt(reserveEncodedBytes);
      if (amount > maxBytes) fail("reservation-too-large");
      if (active >= policy.maxConcurrentOperations) fail("concurrency-exhausted");
      if (reserved + amount > maxBytes) fail("capacity-exhausted");
      active++;
      reserved += amount;
      let state: "active" | "released" | "quarantined" = "active";
      return {
        release(): void {
          // Never reclaim a quarantined reservation. Upstream work might
          // still be running even after a timeout Promise.race has returned.
          if (state !== "active") return;
          state = "released";
          active--;
          reserved -= amount;
        },
        quarantine(): void {
          if (state !== "active") return;
          state = "quarantined";
          quarantined++;
          // Deliberately do not decrement active or reserved. No timed reset.
        },
      };
    },

    snapshot(): SatelliteAdmissionSnapshot {
      return {
        activeOperations: active,
        // The aggregate never exceeds the validated safe-integer policy.
        reservedEncodedBytes: Number(reserved),
      };
    },
    quarantinedCount(): number {
      return quarantined;
    },
  };
}
