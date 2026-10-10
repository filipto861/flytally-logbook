import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteAdmissionGate, SatelliteAdmissionError } from "../lib/satellite-admission-gate.ts";
import { fetchAdmittedSatellitePair } from "../lib/satellite-admitted-pair.ts";
import type { SatelliteBoundedFetchOptions } from "../lib/satellite-bounded-fetch.ts";

// All counts, byte ceilings and deadlines here are synthetic test values only.
const policy = { maxConcurrentOperations: 2, maxReservedEncodedBytes: 16 };
function input(fetcher: typeof fetch, overrides: Partial<SatelliteBoundedFetchOptions> = {}): SatelliteBoundedFetchOptions {
  return { url: "https://synthetic.invalid/tile", fetcher, maxBytes: 8, timeoutMs: 100, ...overrides };
}
function good(): Response {
  return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
}

test("M3-C2: pair success returns both bodies and releases both reservations", async () => {
  const gate = createSatelliteAdmissionGate(policy);
  const fake = (async () => good()) as typeof fetch;
  const results = await fetchAdmittedSatellitePair(gate, input(fake), input(fake));
  assert.deepEqual(results.map(v => v.lifecycle.outcome), ["success", "success"]);
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
  assert.equal(gate.quarantinedCount(), 0);
});

test("M3-C2: saturation refuses pair without starting either upstream", async () => {
  const gate = createSatelliteAdmissionGate(policy);
  const occupant = gate.acquire(2);
  let calls = 0;
  const fake = (async () => { calls++; return good(); }) as typeof fetch;
  try {
    await assert.rejects(fetchAdmittedSatellitePair(gate, input(fake), input(fake)), (error: unknown) =>
      error instanceof SatelliteAdmissionError && error.reason === "concurrency-exhausted");
    assert.equal(calls, 0);
    assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 2 });
  } finally { occupant.release(); }
});

test("M3-C2: invalid second reservation rolls back before either request", async () => {
  const gate = createSatelliteAdmissionGate(policy);
  let calls = 0;
  const fake = (async () => { calls++; return good(); }) as typeof fetch;
  await assert.rejects(fetchAdmittedSatellitePair(gate, input(fake), input(fake, { maxBytes: 0 })),
    (error: unknown) => error instanceof SatelliteAdmissionError && error.reason === "invalid-reservation");
  assert.equal(calls, 0);
  assert.equal(gate.snapshot().activeOperations, 0);
});

test("M3-C2: permanently stalled supplier quarantines while successful sibling releases", async () => {
  const gate = createSatelliteAdmissionGate(policy);
  const stalled = (() => new Promise<Response>(() => {})) as typeof fetch;
  const fine = (async () => good()) as typeof fetch;
  const results = await fetchAdmittedSatellitePair(gate, input(stalled, { timeoutMs: 10 }), input(fine));
  assert.deepEqual(results.map(v => v.lifecycle.outcome), ["failure", "success"]);
  assert.deepEqual(gate.snapshot(), { activeOperations: 1, reservedEncodedBytes: 8 });
  assert.equal(gate.quarantinedCount(), 1);
});

test("M3-C2: two stalled upstreams permanently retain both reservations", async () => {
  const gate = createSatelliteAdmissionGate(policy);
  const stalled = (() => new Promise<Response>(() => {})) as typeof fetch;
  const results = await fetchAdmittedSatellitePair(gate, input(stalled, { timeoutMs: 10 }), input(stalled, { timeoutMs: 10 }));
  assert.deepEqual(results.map(v => v.lifecycle.outcome), ["failure", "failure"]);
  assert.deepEqual(gate.snapshot(), { activeOperations: 2, reservedEncodedBytes: 16 });
  assert.equal(gate.quarantinedCount(), 2);
});

test("M3-C2: pre-aborted pair never starts suppliers and releases capacity", async () => {
  const controller = new AbortController();
  controller.abort();
  const gate = createSatelliteAdmissionGate(policy);
  let calls = 0;
  const fake = (async () => { calls++; return good(); }) as typeof fetch;
  const results = await fetchAdmittedSatellitePair(gate,
    input(fake, { signal: controller.signal }), input(fake, { signal: controller.signal }));
  assert.deepEqual(results.map(v => v.lifecycle.outcome), ["failure", "failure"]);
  assert.equal(calls, 0);
  assert.deepEqual(gate.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});
