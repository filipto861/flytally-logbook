import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/** Execute the actual route module with mocked Next/session/upstream; never use live openAIP. */
const routeText = readFileSync(
  new URL("../app/api/airspace-tile/[z]/[x]/[y]/route.ts", import.meta.url), "utf8");
const contractText = readFileSync(
  new URL("../lib/openaip-airspace-contract.ts", import.meta.url), "utf8");

const transpile = (code: string) => ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
type FetchCall = { url: string; init?: RequestInit };
type FixtureOptions = {
  session?: boolean;
  enabled?: boolean;
  verified?: boolean;
  key?: string;
  mode?: "png" | "wrong-type" | "invalid-bytes" | "oversize" | "rate-limit" | "unavailable" | "throw";
};

function fixture({
  session = false, enabled = false, verified = false, key = "SYNTHETIC_PRIVATE_KEY", mode = "png",
}: FixtureOptions = {}) {
  const calls: FetchCall[] = [];
  let sessions = 0;
  class SyntheticNextResponse extends Response {}
  const globals = { URL, URLSearchParams, Uint8Array, Number, Promise, AbortSignal, Request, Response, Headers, console };

  const contractModule = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(transpile(contractText), {
    ...globals,
    module: contractModule, exports: contractModule.exports,
    require: () => { throw new Error("Unexpected imported contract dependency"); },
  }, { timeout: 2_000 });

  const fetchMock = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init });
    if (mode === "throw") throw new Error("synthetic upstream network failure");
    if (mode === "rate-limit") return new Response("rate limited", { status: 429 });
    if (mode === "unavailable") return new Response("no tile", { status: 404 });
    if (mode === "wrong-type") return new Response("<html>bad</html>", {
      headers: { "Content-Type": "text/html" },
    });
    if (mode === "invalid-bytes") return new Response(new Uint8Array([0, 1, 2, 3]), {
      headers: { "Content-Type": "image/png" },
    });
    if (mode === "oversize") return new Response(PNG, {
      headers: { "Content-Type": "image/png", "Content-Length": "1048577" },
    });
    return new Response(PNG, { headers: { "Content-Type": "image/png" } });
  };

  const routeModule = { exports: {} as { GET: (req: Request, ctx: unknown) => Promise<Response> } };
  vm.runInNewContext(transpile(routeText), {
    ...globals, fetch: fetchMock,
    process: { env: {
      FLYTALLY_OPENAIP_AIRSPACES_ENABLED: enabled ? "true" : "",
      FLYTALLY_OPENAIP_PROVIDER_VERIFIED: verified ? "true" : "",
      OPENAIP_API_KEY: key,
    } },
    module: routeModule, exports: routeModule.exports,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse: SyntheticNextResponse };
      if (id === "@/lib/auth/session") return { getSession: async () => {
        sessions++;
        return session ? { userId: 9001, sessionId: "synthetic" } : null;
      } };
      if (id === "@/lib/openaip-airspace-contract") return contractModule.exports;
      throw new Error("Unexpected route import: " + id);
    },
  }, { timeout: 2_000 });

  const get = (z = "8", x = "125", y = "171") => routeModule.exports.GET(
    new Request(`https://fly-tally.com/api/airspace-tile/${z}/${x}/${y}`),
    { params: Promise.resolve({ z, x, y }) },
  );
  return { get, calls, get sessions() { return sessions; } };
}

test("A2B1 malformed or out-of-budget coordinates fail before auth/credentials/upstream", async () => {
  for (const coords of [["08", "125", "171"], ["8", "256", "0"], ["15", "0", "0"], ["-1", "0", "0"]]) {
    const f = fixture({ session: true, enabled: true, verified: true });
    const r = await f.get(...(coords as [string, string, string]));
    assert.equal(r.status, 400, coords.join("/"));
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(f.sessions, 0);
    assert.equal(f.calls.length, 0);
  }
});

test("A2B1 anonymous request 401 before server flag, key or provider use", async () => {
  const f = fixture({ enabled: true, verified: true });
  const r = await f.get();
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal(f.sessions, 1);
  assert.equal(f.calls.length, 0);
});

test("A2B1 disabled or unverified provider denies with no upstream calls", async () => {
  for (const flag of ["enabled", "verified"] as const) {
    const input = { session: true, enabled: true, verified: true };
    input[flag] = false;
    const f = fixture(input);
    const r = await f.get();
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(f.sessions, 1);
    assert.equal(f.calls.length, 0);
  }
});

test("A2B1 missing server key 503, never fetches", async () => {
  const f = fixture({ session: true, enabled: true, verified: true, key: "" });
  const r = await f.get();
  assert.equal(r.status, 503);
  assert.equal(f.calls.length, 0);
});

test("A2B1 authenticated enabled route returns private PNG via pinned host and header key", async () => {
  const f = fixture({ session: true, enabled: true, verified: true });
  const r = await f.get();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal(r.headers.get("x-flytally-airspaces"), "reference-only");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "https://api.tiles.openaip.net/api/data/airspaces/8/125/171.png");
  assert.equal(new Headers(f.calls[0].init?.headers).get("x-openaip-api-key"), "SYNTHETIC_PRIVATE_KEY");
  assert.equal(f.calls[0].init?.cache, "no-store");
  assert.equal(f.calls[0].init?.redirect, "error");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
  assert.doesNotMatch(f.calls[0].url, /SYNTHETIC_PRIVATE_KEY/);
});

test("A2B1 refuses wrong MIME, invalid image bytes, oversized response, upstream errors", async () => {
  for (const mode of ["wrong-type", "invalid-bytes", "oversize", "unavailable", "throw"] as const) {
    const f = fixture({ session: true, enabled: true, verified: true, mode });
    const r = await f.get();
    assert.equal(r.status, 502, mode);
    assert.equal(r.headers.get("cache-control"), "private, no-store", mode);
    assert.equal(r.headers.get("x-flytally-airspaces"), "unavailable", mode);
    assert.doesNotMatch(await r.text(), /SYNTHETIC_PRIVATE_KEY|openaip.net/i, mode);
  }
});

test("A2B1 propagates provider 429 as unavailable 503 without retries", async () => {
  const f = fixture({ session: true, enabled: true, verified: true, mode: "rate-limit" });
  const r = await f.get();
  assert.equal(r.status, 503);
  assert.equal(f.calls.length, 1);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
});
