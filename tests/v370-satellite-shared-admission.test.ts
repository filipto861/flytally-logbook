import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteSharedAdmissionOwner } from "../lib/satellite-shared-admission.ts";
import { SatelliteAdmissionError } from "../lib/satellite-admission-gate.ts";

// Values in tests are synthetic and explicitly NOT production limits.
const policy = { maxConcurrentOperations: 2, maxReservedEncodedBytes: 100 };
test("M3-D1: absent explicit policy returns no gate", () => {
  assert.equal(createSatelliteSharedAdmissionOwner().get(), null);
});
test("M3-D1: repeated initialization reuses exact same ledger", () => {
  const owner = createSatelliteSharedAdmissionOwner();
  const first = owner.initialize(policy);
  const lease = first.acquire(60);
  const second = owner.initialize({ ...policy });
  assert.equal(first, second);
  assert.deepEqual(second.snapshot(), { activeOperations: 1, reservedEncodedBytes: 60 });
  lease.release();
});
test("M3-D1: policy mutation after initialization cannot silently reconfigure", () => {
  const owner = createSatelliteSharedAdmissionOwner();
  const mutable = { ...policy };
  const original = owner.initialize(mutable);
  mutable.maxConcurrentOperations = 20;
  assert.throws(() => owner.initialize(mutable),
    (e: unknown) => e instanceof SatelliteAdmissionError && e.reason === "invalid-policy");
  assert.equal(owner.get(), original);
});
test("M3-D1: malformed policy never creates or replaces a gate", () => {
  const owner = createSatelliteSharedAdmissionOwner();
  for (const invalid of [
    { ...policy, maxReservedEncodedBytes: 0 },
    { ...policy, maxConcurrentOperations: Number.NaN },
    { ...policy, maxReservedEncodedBytes: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(() => owner.initialize(invalid),
      (e: unknown) => e instanceof SatelliteAdmissionError && e.reason === "invalid-policy");
    assert.equal(owner.get(), null);
  }
});
test("M3-D1: isolate owners cannot claim cross-instance enforcement", () => {
  const first = createSatelliteSharedAdmissionOwner().initialize(policy);
  const second = createSatelliteSharedAdmissionOwner().initialize(policy);
  const lease = first.acquire(100);
  assert.equal(second.snapshot().activeOperations, 0);
  lease.release();
});
test("M3-D1: quarantined capacity remains retained after shared reaccess", () => {
  const owner = createSatelliteSharedAdmissionOwner();
  const gate = owner.initialize(policy);
  const lease = gate.acquire(100);
  lease.quarantine();
  assert.equal(owner.get()?.snapshot().reservedEncodedBytes, 100);
  assert.equal(owner.initialize(policy).quarantinedCount(), 1);
  lease.release();
  assert.equal(owner.get()?.snapshot().reservedEncodedBytes, 100);
});
