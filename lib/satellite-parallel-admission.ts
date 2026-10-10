/** M3-C isolated atomic admission for a base + preferred-label pair.
 * No production resource values are chosen here. Not provider-wired.
 */
import type { SatelliteAdmissionGate, SatelliteAdmissionLease } from "./satellite-admission-gate.ts";

export function admitSatellitePair(
  gate: SatelliteAdmissionGate, baseCeiling: number, labelsCeiling: number,
): readonly [SatelliteAdmissionLease, SatelliteAdmissionLease] {
  // Synchronous acquisitions are atomic relative to other JS calls in this isolate.
  // On failure, the first reservation must be returned before ANY upstream begins.
  const base = gate.acquire(baseCeiling);
  try {
    const labels = gate.acquire(labelsCeiling);
    return [base, labels];
  } catch (error) {
    base.release();
    throw error;
  }
}
