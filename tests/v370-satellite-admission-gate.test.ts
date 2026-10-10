import test from "node:test";
import assert from "node:assert/strict";
import {
  createSatelliteAdmissionGate,
  SatelliteAdmissionError,
  type SatelliteAdmissionPolicy,
  type SatelliteAdmissionReason,
} from "../lib/satellite-admission-gate.ts";

// All values are synthetic LAB examples, NOT provider/hosting resource budgets.
const LAB_POLICY: SatelliteAdmissionPolicy = {
  maxConcurrentOperations: 2,
  maxReservedEncodedBytes: 10,
};

function fails(fn: () => unknown, reason: SatelliteAdmissionReason): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof SatelliteAdmissionError);
    assert.equal(error.reason, reason);
    assert.doesNotMatch(error.message, /token|secret|https?:\/\//i);
    return true;
  });
}

test("R2D.2 M2c-B: missing, zero, negative, fractional, unsafe policy rejects", () => {
  for (const field of ["maxConcurrentOperations", "maxReservedEncodedBytes"] as const) {
    for (const value of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      fails(() => createSatelliteAdmissionGate({
        ...LAB_POLICY,
        [field]: value,
      } as SatelliteAdmissionPolicy), "invalid-policy");
    }
  }
  fails(() => createSatelliteAdmissionGate(
    undefined as unknown as SatelliteAdmissionPolicy,
  ), "invalid-policy");
});

test("R2D.2 M2c-B: rejects malformed or missing reservation without mutation", () => {
  const gate = createSatelliteAdmissionGate(LAB_POLICY);
  for (const amount of [undefined, 0, -2, 1.5, Number.NaN,
    Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    fails(() => gate.acquire(amount as number), "invalid-reservation");
  }
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("R2D.2 M2c-B: single reservation above total capacity fails closed", () => {
  const gate = createSatelliteAdmissionGate(LAB_POLICY);
  fails(() => gate.acquire(11), "reservation-too-large");
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("R2D.2 M2c-B: concurrent operation ceiling admits no queued work", () => {
  const gate = createSatelliteAdmissionGate(LAB_POLICY);
  const a = gate.acquire(2);
  const b = gate.acquire(2);
  try {
    assert.deepEqual(gate.snapshot(), { activeOperations: 2, reservedEncodedBytes: 4 });
    fails(() => gate.acquire(1), "concurrency-exhausted");
    assert.deepEqual(gate.snapshot(), { activeOperations: 2, reservedEncodedBytes: 4 });
  } finally {
    b.release();
    a.release();
  }
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("R2D.2 M2c-B: aggregate reservations bounded even with spare slots", () => {
  const gate = createSatelliteAdmissionGate({ ...LAB_POLICY, maxConcurrentOperations: 3 });
  const a = gate.acquire(7);
  try {
    fails(() => gate.acquire(4), "capacity-exhausted");
    assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 7 });
    const b = gate.acquire(3);
    try {
      assert.equal(gate.snapshot().reservedEncodedBytes, 10);
    } finally {
      b.release();
    }
  } finally {
    a.release();
  }
  assert.equal(gate.snapshot().reservedEncodedBytes, 0);
});

test("R2D.2 M2c-B: lease release is idempotent and permits re-admission", () => {
  const gate = createSatelliteAdmissionGate({ maxConcurrentOperations: 1, maxReservedEncodedBytes: 1 });
  const a = gate.acquire(1);
  a.release();
  a.release();
  const b = gate.acquire(1);
  assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 1 });
  b.release();
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("R2D.2 M2c-B: failed concurrent admission never leaks reserved capacity", () => {
  const gate = createSatelliteAdmissionGate(LAB_POLICY);
  const a = gate.acquire(9);
  try {
    fails(() => gate.acquire(2), "capacity-exhausted");
    fails(() => gate.acquire(11), "reservation-too-large");
    assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 9 });
  } finally {
    a.release();
  }
});

test("R2D.2 M2c-B: caller finally can release after an async operation fails", async () => {
  const gate = createSatelliteAdmissionGate(LAB_POLICY);
  const operation = async () => {
    const lease = gate.acquire(5);
    try {
      await Promise.reject(new Error("synthetic network failed"));
    } finally {
      lease.release();
    }
  };
  await assert.rejects(operation(), /synthetic network failed/);
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("R2D.2 M2c-B: BigInt ledger preserves safe-integer capacity arithmetic", () => {
  const max = Number.MAX_SAFE_INTEGER;
  const gate = createSatelliteAdmissionGate({
    maxConcurrentOperations: 2, maxReservedEncodedBytes: max,
  });
  const first = gate.acquire(max - 1);
  try {
    fails(() => gate.acquire(2), "capacity-exhausted");
    const second = gate.acquire(1);
    try {
      assert.equal(gate.snapshot().reservedEncodedBytes, max);
    } finally {
      second.release();
    }
  } finally {
    first.release();
  }
});

test("R2D.2 M2c-B: separate instances are isolated, NOT fleet-global", () => {
  const a = createSatelliteAdmissionGate({ maxConcurrentOperations: 1, maxReservedEncodedBytes: 1 });
  const b = createSatelliteAdmissionGate({ maxConcurrentOperations: 1, maxReservedEncodedBytes: 1 });
  const one = a.acquire(1);
  const two = b.acquire(1);
  try {
    fails(() => a.acquire(1), "concurrency-exhausted");
    assert.equal(a.snapshot().activeOperations, 1);
    assert.equal(b.snapshot().activeOperations, 1);
  } finally {
    two.release();
    one.release();
  }
});
