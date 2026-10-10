import test from "node:test";
import assert from "node:assert/strict";
import { createSatelliteAdmissionGate } from "../lib/satellite-admission-gate.ts";
import { selectSatelliteLabelsWithFallback } from "../lib/satellite-label-fallback.ts";
import type { SatelliteRequiredPairOutcome } from "../lib/satellite-required-pair.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQ8KsDAAFmAOVTZ6irAAAAAElFTkSuQmCC", "base64");
const raster = { contentType: "image/png" as const, bytes: png };
const ok = { outcome: "success", started: true, evidence: "body-read-completed" } as const;
const failed = { outcome: "failure", started: true, settlement: "unproven", reason: "status" } as const;
const pair = (overrides: Partial<SatelliteRequiredPairOutcome> = {}): SatelliteRequiredPairOutcome =>
 ({ base: ok, preferred: failed, baseRaster: raster, ...overrides });
const gate = () => createSatelliteAdmissionGate({ maxConcurrentOperations: 2, maxReservedEncodedBytes: 1000 });
const fake = (impl: () => Response): typeof fetch => (async () => impl()) as typeof fetch;
const fallback = (fetcher: typeof fetch) => ({
 url: "https://synthetic.invalid/labels", fetcher, maxBytes: 100, timeoutMs: 80,
});
const response = () => new Response(png, { headers: { "content-type": "image/png" } });

test("M3-C4: valid preferred labels skip fallback and admission", async () => {
 let calls = 0; const g = gate();
 const out = await selectSatelliteLabelsWithFallback(g, pair({ preferred: ok, preferredRaster: raster }),
   fallback(fake(() => { calls++; return response(); })), 1000, undefined, () => 0);
 assert.equal(out.outcome, "preferred");
 assert.equal(calls, 0);
 assert.equal(g.snapshot().activeOperations, 0);
});

test("M3-C4: invalid required base suppresses fallback", async () => {
 let calls = 0;
 const out = await selectSatelliteLabelsWithFallback(gate(), pair({ baseRaster: { ...raster, bytes: new Uint8Array([1]) } }),
   fallback(fake(() => { calls++; return response(); })), 1000, undefined, () => 0);
 assert.equal(out.outcome, "unavailable"); assert.equal(calls, 0);
});

test("M3-C4: preferred HTTP failure uses bounded, admitted, structurally valid fallback", async () => {
 const g = gate(); let calls = 0;
 const out = await selectSatelliteLabelsWithFallback(g, pair(),
   fallback(fake(() => { calls++; return response(); })), 1000, undefined, () => 980);
 assert.equal(out.outcome, "fallback");
 assert.equal(out.labels?.width, 1);
 assert.equal(calls, 1);
 assert.equal(g.snapshot().activeOperations, 0);
});

test("M3-C4: no fallback after inherited deadline or preferred deadline failure", async () => {
 let calls = 0; const input = fallback(fake(() => { calls++; return response(); }));
 const expired = await selectSatelliteLabelsWithFallback(gate(), pair(), input, 500, undefined, () => 500);
 const timedOut = await selectSatelliteLabelsWithFallback(gate(), pair({
   preferred: { outcome: "failure", started: true, settlement: "unproven", reason: "deadline" },
 }), input, 1000, undefined, () => 0);
 assert.equal(expired.outcome, "base-only");
 assert.equal(timedOut.outcome, "base-only");
 assert.equal(calls, 0);
});

test("M3-C4: admitted fallback uncooperative upstream quarantines reservation", async () => {
 const g = gate();
 const hanging = (() => new Promise<Response>(() => {})) as typeof fetch;
 const out = await selectSatelliteLabelsWithFallback(g, pair(), fallback(hanging), 1000, undefined, () => 0);
 assert.equal(out.outcome, "base-only");
 assert.equal(g.quarantinedCount(), 1);
 assert.deepEqual(g.snapshot(), { activeOperations: 1, reservedEncodedBytes: 100 });
});

test("M3-C4: caller abort and capacity saturation suppress new fallback fetch", async () => {
 const g = gate(); const c = new AbortController(); c.abort();
 let calls = 0; const options = fallback(fake(() => { calls++; return response(); }));
 assert.equal((await selectSatelliteLabelsWithFallback(g, pair(), options, 1000, c.signal, () => 0)).outcome, "unavailable");
 const reserved = g.acquire(950);
 assert.equal((await selectSatelliteLabelsWithFallback(g, pair(), options, 1000, undefined, () => 0)).outcome, "base-only");
 assert.equal(calls, 0);
 reserved.release();
});
