import test from "node:test";
import assert from "node:assert/strict";
import { observeSatelliteBoundedFetch } from "../lib/satellite-fetch-lifecycle.ts";
import type { SatelliteBoundedFetchOptions } from "../lib/satellite-bounded-fetch.ts";

// Synthetic only. These are NOT production supplier resource ceilings.
function options(fetcher: typeof fetch, overrides: Partial<SatelliteBoundedFetchOptions> = {}): SatelliteBoundedFetchOptions {
  return { url: "https://synthetic.invalid/tile", fetcher, maxBytes: 64, timeoutMs: 100, ...overrides };
}
const jpegResponse = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });

test("M3-B: invalid policy never calls supplier and is classified not-started", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return jpegResponse(); }) as typeof fetch;
  const result = await observeSatelliteBoundedFetch(options(fetcher, { maxBytes: 0 }));
  assert.equal(calls, 0);
  assert.deepEqual(result.lifecycle, { outcome: "failure", started: false, settlement: "not-started", reason: "invalid-policy" });
});

test("M3-B: pre-aborted caller never calls supplier", async () => {
  const abort = new AbortController();
  abort.abort();
  let calls = 0;
  const result = await observeSatelliteBoundedFetch(options((async () => { calls++; return jpegResponse(); }) as typeof fetch, { signal: abort.signal }));
  assert.equal(calls, 0);
  assert.deepEqual(result.lifecycle, { outcome: "failure", started: false, settlement: "not-started", reason: "caller-aborted" });
});

test("M3-B: successful full stream completion is local evidence only", async () => {
  const result = await observeSatelliteBoundedFetch(options((async () => jpegResponse()) as typeof fetch));
  assert.deepEqual(result.lifecycle, { outcome: "success", started: true, evidence: "body-read-completed" });
  assert.deepEqual([...result.result!.bytes], [1, 2, 3]);
});

test("M3-B: synchronous supplier throw after invocation is unproven", async () => {
  const fetcher = (() => { throw new Error("secret token value"); }) as typeof fetch;
  const result = await observeSatelliteBoundedFetch(options(fetcher));
  assert.deepEqual(result.lifecycle, { outcome: "failure", started: true, settlement: "unproven", reason: "upstream" });
  assert.doesNotMatch(JSON.stringify(result), /secret token/i);
});

test("M3-B: never-settling upstream after deadline is unproven", async () => {
  const fetcher = (() => new Promise<Response>(() => {})) as typeof fetch;
  const result = await observeSatelliteBoundedFetch(options(fetcher, { timeoutMs: 10 }));
  assert.deepEqual(result.lifecycle, { outcome: "failure", started: true, settlement: "unproven", reason: "deadline" });
});

test("M3-B: malformed MIME after supplier invocation remains unproven", async () => {
  const fetcher = (async () => new Response("error", { headers: { "content-type": "text/plain" } })) as typeof fetch;
  const result = await observeSatelliteBoundedFetch(options(fetcher));
  assert.deepEqual(result.lifecycle, { outcome: "failure", started: true, settlement: "unproven", reason: "content-type" });
});

test("M3-C review: arbitrary supplier reason is not trusted", async () => {
  const fetcher = (() => { throw { reason: "deadline", secret: "supplier-token" }; }) as typeof fetch;
  const outcome = await observeSatelliteBoundedFetch(options(fetcher));
  assert.deepEqual(outcome.lifecycle, {
    outcome: "failure", started: true, settlement: "unproven", reason: "upstream",
  });
  assert.doesNotMatch(JSON.stringify(outcome), /supplier-token/);
});
