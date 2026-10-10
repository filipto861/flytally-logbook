import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteAdmissionGate } from "../lib/satellite-admission-gate.ts";
import { fetchSatelliteRequiredPair } from "../lib/satellite-required-pair.ts";
import type { SatelliteBoundedFetchOptions } from "../lib/satellite-bounded-fetch.ts";

// All byte/deadline values are strictly synthetic, not production policies.
const gate = () => createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 16 });
const response = () => new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } });
const input = (fetcher: typeof fetch, timeoutMs = 100): SatelliteBoundedFetchOptions =>
  ({ url: "https://synthetic.invalid/tile", fetcher, maxBytes: 8, timeoutMs });

test("M3-C3: both complete and capacity releases", async () => {
  const g = gate();
  const fake = (async () => response()) as typeof fetch;
  const result = await fetchSatelliteRequiredPair(g, input(fake), input(fake), 100);
  assert.equal(result.base.outcome, "success");
  assert.equal(result.preferred.outcome, "success");
  assert.deepEqual(g.snapshot(), { activeOperations: 0, reservedEncodedBytes: 0 });
});

test("M3-C3: base HTTP failure aborts stalled labels, retains its uncertain lease", async () => {
  const g = gate();
  let observed: AbortSignal | undefined;
  const base = (async () => new Response("bad", { status: 503 })) as typeof fetch;
  const labels = ((_url: RequestInfo | URL, init?: RequestInit) => {
    observed = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  const result = await fetchSatelliteRequiredPair(g, input(base), input(labels), 70);
  assert.equal(result.base.outcome, "failure");
  assert.equal(result.preferred.outcome, "failure");
  assert.equal(result.preferred.started, true);
  assert.equal(observed?.aborted, true);
  assert.equal(g.quarantinedCount(), 2); // post-invocation failures stay unproven
});

test("M3-C3: whole-tile deadline bounds two uncooperative fetch wrappers", async () => {
  const g = gate();
  const pending = (() => new Promise<Response>(() => {})) as typeof fetch;
  const result = await fetchSatelliteRequiredPair(g, input(pending, 200), input(pending, 200), 15);
  assert.equal(result.base.outcome, "failure");
  assert.equal(result.preferred.outcome, "failure");
  assert.equal(g.quarantinedCount(), 2);
});

test("M3-C3: caller preabort causes no admission or supplier calls", async () => {
  const g = gate();
  const c = new AbortController(); c.abort();
  let calls = 0;
  const fake = (async () => { calls++; return response(); }) as typeof fetch;
  const result = await fetchSatelliteRequiredPair(g, input(fake), input(fake), 20, c.signal);
  assert.equal(result.base.started, false);
  assert.equal(result.preferred.started, false);
  assert.equal(calls, 0);
  assert.equal(g.snapshot().activeOperations, 0);
});

test("M3-C3: invalid tile deadline and hidden per-fetch signals fail before admission", async () => {
  const g = gate();
  const fake = (async () => response()) as typeof fetch;
  await assert.rejects(fetchSatelliteRequiredPair(g, input(fake), input(fake), 0), /invalid-policy/);
  await assert.rejects(fetchSatelliteRequiredPair(g, { ...input(fake), signal: new AbortController().signal }, input(fake), 20), /invalid-policy/);
  assert.equal(g.snapshot().activeOperations, 0);
});
