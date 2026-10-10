import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSatelliteBounded,
  SatelliteBoundedFetchError,
  type SatelliteBoundedFetchOptions,
  type SatelliteBoundedFailure,
} from "../lib/satellite-bounded-fetch.ts";

// All sizes and delays below are SYNTHETIC UNIT-TEST VALUES, not production
// or supplier limits. No provider URLs, tokens or real network requests.
const JPEG = "image/jpeg";

function source(
  body: BodyInit | null,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": JPEG, ...headers },
  });
}

function setup(
  fetcher: typeof fetch,
  overrides: Partial<SatelliteBoundedFetchOptions> = {},
): SatelliteBoundedFetchOptions {
  return {
    url: "https://synthetic.invalid/tile",
    fetcher,
    maxBytes: 12,
    timeoutMs: 500,
    ...overrides,
  };
}

async function expectFailure(
  options: SatelliteBoundedFetchOptions,
  reason: SatelliteBoundedFailure,
): Promise<void> {
  await assert.rejects(fetchSatelliteBounded(options), (error: unknown) => {
    assert.ok(error instanceof SatelliteBoundedFetchError);
    assert.equal(error.reason, reason);
    assert.doesNotMatch(error.message, /synthetic\.invalid|secret/i);
    return true;
  });
}

test("R2D.2 M2a: missing, zero, fractional, huge and ambiguous policy fails before any request", async () => {
  let attempts = 0;
  const fake = (async () => {
    attempts++;
    return source("abc");
  }) as typeof fetch;
  for (const policy of [
    { maxBytes: 0 }, { maxBytes: -1 }, { maxBytes: 1.5 },
    { maxBytes: Number.MAX_SAFE_INTEGER + 1 },
    { maxBytes: undefined }, { timeoutMs: 0 },
    { timeoutMs: -1 }, { timeoutMs: 1.5 },
    { timeoutMs: undefined }, { timeoutMs: 2_147_483_648 },
    { url: "" }, { fetcher: undefined },
  ]) {
    await expectFailure(setup(fake, policy as Partial<SatelliteBoundedFetchOptions>), "invalid-policy");
  }
  assert.equal(attempts, 0);
});

test("R2D.2 M2a: refuses Next fetch cache hints and caller-supplied init AbortSignal", async () => {
  let attempts = 0;
  const fake = (async () => {
    attempts++;
    return source("test");
  }) as typeof fetch;
  for (const init of [
    { cache: "force-cache" },
    { next: { revalidate: 604800 } },
    { signal: new AbortController().signal },
  ]) {
    await expectFailure(
      setup(fake, { init: init as RequestInit }),
      "invalid-policy",
    );
  }
  assert.equal(attempts, 0);
});

test("R2D.2 M2a: copies finite data and passes through safe request headers with no-store", async () => {
  const observed = { init: undefined as RequestInit | undefined };
  const fake = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    observed.init = init;
    return source(new Uint8Array([1, 2, 3]), { "content-length": "3" });
  }) as typeof fetch;
  const result = await fetchSatelliteBounded(setup(fake, {
    init: { headers: { "X-Diagnostic": "fixture" } },
  }));
  assert.equal(result.contentType, JPEG);
  assert.deepEqual([...result.bytes], [1, 2, 3]);
  assert.equal(observed.init?.cache, "no-store");
  assert.ok(observed.init?.signal instanceof AbortSignal);
  assert.equal(new Headers(observed.init?.headers).get("X-Diagnostic"), "fixture");
  assert.equal("next" in (observed.init ?? {}), false);
});

test("R2D.2 M2a: missing Content-Length is allowed for bounded stream", async () => {
  const fake = (async () => source(new Uint8Array([1, 2]))) as typeof fetch;
  const result = await fetchSatelliteBounded(setup(fake));
  assert.deepEqual([...result.bytes], [1, 2]);
});

test("R2D.2 M2a: rejects unsupported status and MIME including SVG/HTML", async () => {
  const fake = (response: Response) => (async () => response) as typeof fetch;
  await expectFailure(setup(fake(source("denied", {}, 403))), "status");
  await expectFailure(setup(fake(source("<svg/>", { "content-type": "image/svg+xml" }))), "content-type");
  await expectFailure(setup(fake(source("<html/>", { "content-type": "text/html" }))), "content-type");
  await expectFailure(setup(fake(source("anything", { "content-type": "image/gif" }))), "content-type");
  await expectFailure(setup(fake(source("anything", { "content-type": "" }))), "content-type");
});

test("R2D.2 M2a: refuses ambiguous compressed representations without source contract", async () => {
  const fake = (async () =>
    source(new Uint8Array([1, 2]), { "content-encoding": "gzip" })) as typeof fetch;
  await expectFailure(setup(fake), "content-encoding");
});

test("R2D.2 M2a: strict present Content-Length syntax and oversized declaration", async () => {
  for (const value of ["-1", "3.0", "abc", "01", "9999999999999999999999"]) {
    const fake = (async () => source("x", { "content-length": value })) as typeof fetch;
    await expectFailure(setup(fake), "content-length");
  }
  await expectFailure(
    setup((async () => source("abc", { "content-length": "0" })) as typeof fetch),
    "empty-body",
  );
  await expectFailure(
    setup((async () => source("abc", { "content-length": "13" })) as typeof fetch),
    "too-large",
  );
});

test("R2D.2 M2a: observed body always has a byte limit, even when header lies", async () => {
  let emitted = 0;
  const observed = { signal: null as AbortSignal | null };
  const fake = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    observed.signal = init?.signal ?? null;
    return source(new ReadableStream({
      pull(controller) {
        emitted++;
        controller.enqueue(new Uint8Array(8));
        if (emitted === 2) controller.close();
      },
    }), { "content-length": "4" });
  }) as typeof fetch;
  await expectFailure(setup(fake, { maxBytes: 10 }), "too-large");
  assert.equal(observed.signal?.aborted, true);
  assert.ok(emitted >= 2);
});

test("R2D.2 M2a: detects truncated identity body and empty content", async () => {
  const partial = (async () =>
    source(new Uint8Array([1, 2]), { "content-length": "4" })) as typeof fetch;
  await expectFailure(setup(partial), "incomplete-body");
  const empty = (async () => source(new Uint8Array())) as typeof fetch;
  await expectFailure(setup(empty), "empty-body");
});

test("R2D.2 M2a: caller already aborted prevents networking", async () => {
  const caller = new AbortController();
  caller.abort();
  let attempts = 0;
  const fake = (async () => {
    attempts++;
    return source("abc");
  }) as typeof fetch;
  await expectFailure(setup(fake, { signal: caller.signal }), "caller-aborted");
  assert.equal(attempts, 0);
});

test("R2D.2 M2a: caller abort during stalled body cancels active transport", async () => {
  const caller = new AbortController();
  const observed = { signal: null as AbortSignal | null };
  let cancelled = false;
  const fake = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    observed.signal = init?.signal ?? null;
    return source(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        // Deliberately does not close. The test's caller must stop it.
      },
      cancel() { cancelled = true; },
    }));
  }) as typeof fetch;
  const promise = expectFailure(setup(fake, { signal: caller.signal }), "caller-aborted");
  setTimeout(() => caller.abort(), 15);
  await promise;
  assert.equal(observed.signal?.aborted, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cancelled, true);
});

test("R2D.2 M2a: independent total deadline stops a stalled body", async () => {
  const observed = { signal: null as AbortSignal | null };
  const fake = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    observed.signal = init?.signal ?? null;
    return source(new ReadableStream({ start() { /* never produces */ } }));
  }) as typeof fetch;
  await expectFailure(setup(fake, { timeoutMs: 20 }), "deadline");
  assert.equal(observed.signal?.aborted, true);
});

test("R2D.2 M2a: total deadline also stops a non-cooperative pending fetch", async () => {
  const observed = { signal: null as AbortSignal | null };
  const fake = ((_url: RequestInfo | URL, init?: RequestInit) => {
    observed.signal = init?.signal ?? null;
    return new Promise<Response>(() => { /* fake ignores AbortSignal */ });
  }) as typeof fetch;
  await expectFailure(setup(fake, { timeoutMs: 20 }), "deadline");
  assert.equal(observed.signal?.aborted, true);
});

test("R2D.2 M2a: sanitizes upstream thrown errors and rejects non-image payload", async () => {
  const fake = (async () => {
    throw new Error("synthetic.invalid?token=secret123");
  }) as typeof fetch;
  await expectFailure(setup(fake), "upstream");
  // This is intentionally a TRANSPORT primitive: matching MIME does not
  // establish real raster integrity. M2b must add signature/structure checks.
  const mislabeled = (async () => source("not actually a JPEG")) as typeof fetch;
  const result = await fetchSatelliteBounded(setup(mislabeled, { maxBytes: 50 }));
  assert.equal(result.contentType, JPEG);
  assert.equal(new TextDecoder().decode(result.bytes), "not actually a JPEG");
});

test("M3-D hardening: rejected status and headers cancel an unread response body", async () => {
  const scenarios: Array<{ status: number; headers: Record<string, string>; reason: SatelliteBoundedFailure }> = [
    { status: 503, headers: {}, reason: "status" },
    { status: 200, headers: { "content-type": "text/html" }, reason: "content-type" },
    { status: 200, headers: { "content-encoding": "gzip" }, reason: "content-encoding" },
    { status: 200, headers: { "content-length": "13" }, reason: "too-large" },
    { status: 200, headers: { "content-length": "bad" }, reason: "content-length" },
  ];
  for (const scenario of scenarios) {
    let cancelled = false;
    const response = source(new ReadableStream({
      start() { /* Unread stream */ },
      cancel() { cancelled = true; },
    }), scenario.headers, scenario.status);
    await expectFailure(setup((async () => response) as typeof fetch), scenario.reason);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(cancelled, true, scenario.reason);
  }
});

test("M3-D hardening: late response after timeout is cancelled without delaying caller", async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  const fake = (() => pending) as typeof fetch;
  await expectFailure(setup(fake, { timeoutMs: 15 }), "deadline");
  let cancelled = false;
  release(source(new ReadableStream({
    start() { /* Late response body */ },
    cancel() { cancelled = true; },
  })));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(cancelled, true);
});

test("M3-D hardening: rejected body cleanup errors do not replace the original failure", async () => {
  const fake = (async () => source(new ReadableStream({
    start() {},
    cancel() { throw Error("cleanup should be swallowed"); },
  }), { "content-type": "application/json" })) as typeof fetch;
  await expectFailure(setup(fake), "content-type");
});
