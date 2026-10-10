import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteAdmissionGate, SatelliteAdmissionError } from "../lib/satellite-admission-gate.ts";
import { admitSatellitePair } from "../lib/satellite-parallel-admission.ts";

// Synthetic limits only. Not approved supplier or production ceilings.
test("M3-C: successful pair reserves both before caller may begin supplier work", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 });
  const [base, labels] = admitSatellitePair(gate, 6, 4);
  assert.deepEqual(gate.snapshot(), { activeOperations: 2, reservedEncodedBytes: 10 });
  labels.release();
  base.release();
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("M3-C: insufficient aggregate capacity rolls back first reservation", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 });
  assert.throws(() => admitSatellitePair(gate, 7, 4), (error: unknown) =>
    error instanceof SatelliteAdmissionError && error.reason === "capacity-exhausted");
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
  assert.equal(gate.quarantinedCount(), 0);
});

test("M3-C: single free slot cannot launch half of a pair", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 });
  const occupant = gate.acquire(2);
  try {
    assert.throws(() => admitSatellitePair(gate, 3, 3), (error: unknown) =>
      error instanceof SatelliteAdmissionError && error.reason === "concurrency-exhausted");
    assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 2 });
  } finally { occupant.release(); }
});

test("M3-C: invalid second reservation leaves no new lease behind", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 });
  assert.throws(() => admitSatellitePair(gate, 4, 0), (error: unknown) =>
    error instanceof SatelliteAdmissionError && error.reason === "invalid-reservation");
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("M3-C: quarantine of a started operation is not undone by sibling release", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 });
  const [base, labels] = admitSatellitePair(gate, 5, 5);
  labels.quarantine();
  labels.release();
  base.release();
  assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 5 });
  assert.equal(gate.quarantinedCount(), 1);
});

test("M3-C: separate gates cannot represent fleet-global capacity", () => {
  const policy = { maxConcurrentOperations: 2, maxReservedEncodedBytes: 10 };
  const first = createSatelliteAdmissionGate(policy);
  const second = createSatelliteAdmissionGate(policy);
  const a = admitSatellitePair(first, 3, 3);
  const b = admitSatellitePair(second, 3, 3);
  a.forEach(lease => lease.release());
  b.forEach(lease => lease.release());
  assert.equal(first.snapshot().activeOperations, 0);
  assert.equal(second.snapshot().activeOperations, 0);
});
