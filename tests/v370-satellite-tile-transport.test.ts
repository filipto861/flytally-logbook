import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteAdmissionGate } from "../lib/satellite-admission-gate.ts";
import { fetchSatelliteTileTransport } from "../lib/satellite-tile-transport.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQ8KsDAAFmAOVTZ6irAAAAAElFTkSuQmCC", "base64");
const image = () => new Response(png, { headers: { "content-type": "image/png" } });
const gate = () => createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 1000 });
const fetcher = (fn: () => Promise<Response> | Response): typeof fetch => (async () => fn()) as typeof fetch;
function opts(base: typeof fetch, preferred: typeof fetch, fallback: typeof fetch, extras: Record<string, unknown> = {}) {
  const make = (f: typeof fetch) => ({ url: "https://synthetic.invalid/tile", fetcher: f, maxBytes: 100, timeoutMs: 50 });
  return { gate: gate(), base: make(base), preferred: make(preferred),
    fallback: make(fallback), totalDeadlineMs: 60, ...extras };
}
test("M3-C5: preferred success never starts fallback", async () => {
  let calls = 0;
  const fine = fetcher(image);
  const options = opts(fine, fine, fetcher(() => { calls++; return image(); }));
  const result = await fetchSatelliteTileTransport(options);
  assert.equal(result.outcome, "preferred");
  assert.equal(calls, 0);
  assert.equal(options.gate.snapshot().activeOperations, 0);
});

test("M3-C5: fallback uses remaining deadline, not a restarted deadline", async () => {
  let clock = 0, calls = 0;
  const base = fetcher(() => { clock = 55; return image(); });
  const preferred = fetcher(() => new Response("failed", { status: 503 }));
  const backup = fetcher(() => { calls++; return image(); });
  const options = opts(base, preferred, backup, { now: () => clock });
  const outcome = await fetchSatelliteTileTransport(options);
  assert.equal(outcome.outcome, "fallback");
  assert.equal(calls, 1);
});

test("M3-C5: no fallback if required pair consumes entire budget", async () => {
  let clock = 0, calls = 0;
  const base = fetcher(() => { clock = 60; return image(); });
  const preferred = fetcher(() => new Response("failed", { status: 503 }));
  const backup = fetcher(() => { calls++; return image(); });
  const result = await fetchSatelliteTileTransport(opts(base, preferred, backup, { now: () => clock }));
  assert.equal(result.outcome, "base-only");
  assert.equal(calls, 0);
});

test("M3-C5: no upstream work for preaborted caller or invalid budget", async () => {
  let calls = 0;
  const fake = fetcher(() => { calls++; return image(); });
  const controller = new AbortController(); controller.abort();
  assert.equal((await fetchSatelliteTileTransport(opts(fake, fake, fake, { signal: controller.signal }))).outcome, "unavailable");
  await assert.rejects(fetchSatelliteTileTransport(opts(fake, fake, fake, { totalDeadlineMs: 0 })), /invalid-policy/);
  assert.equal(calls, 0);
});
