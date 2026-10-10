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
  release(): void;
}>;

export type SatelliteAdmissionGate = Readonly<{
  acquire(reserveEncodedBytes: number): SatelliteAdmissionLease;
  snapshot(): SatelliteAdmissionSnapshot;
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
 * launching upstream work. A lease must be released in a finally block
 * only after transport work has actually ceased, not merely after a
 * timeout Promise.race resolves while a non-cooperative fetch keeps running.
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

  return {
    acquire(reserveEncodedBytes: number): SatelliteAdmissionLease {
      if (!positiveSafeInteger(reserveEncodedBytes)) fail("invalid-reservation");
      const amount = BigInt(reserveEncodedBytes);
      if (amount > maxBytes) fail("reservation-too-large");
      if (active >= policy.maxConcurrentOperations) fail("concurrency-exhausted");
      if (reserved + amount > maxBytes) fail("capacity-exhausted");
      active++;
      reserved += amount;
      let released = false;
      return {
        release(): void {
          if (released) return;
          released = true;
          active--;
          reserved -= amount;
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
  };
}
