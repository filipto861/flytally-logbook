import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

/**
 * Execute the actual map-tile route handler with its imports substituted by
 * deterministic, local stubs. This tests response and fetch behavior without
 * Next, PostgreSQL or live ArcGIS/OSM calls. It is not a deployed-HTTP test.
 */
const routeText = readFileSync(new URL("../app/api/map-tile/[z]/[x]/[y]/route.ts", import.meta.url), "utf8");
const styleText = readFileSync(new URL("../lib/map-tile-style.ts", import.meta.url), "utf8");
const transpile = (source: string) => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

type RouteResponse = Response;
type SessionState = "live" | "expired";
type FetchCall = { url: string; init?: RequestInit };

function fixture({ session = "expired", token = "LOCAL_SYNTHETIC_TOKEN" }:
  { session?: SessionState; token?: string } = {}) {
  const calls: FetchCall[] = [];
  let sessionChecks = 0;

  const styleModule = { exports: {} as { parseMapTileStyle: (params: URLSearchParams) => "map" | "satellite" | null } };
  const contextGlobals = { URL, URLSearchParams, Buffer, Response, Headers, console };
  vm.runInNewContext(transpile(styleText), {
    ...contextGlobals,
    module: styleModule,
    exports: styleModule.exports,
    require: (_id: string) => { throw new Error("Unexpected parser dependency"); },
  }, { timeout: 2_000 });

  // NextResponse's Response constructor and static .json() are enough for the
  // actual route. We intentionally never import Next internals or use a DB.
  class SyntheticNextResponse extends Response {}

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://tile.openstreetmap.org/")) {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url.includes("/World_Imagery/")) {
      return new Response(new Uint8Array([255, 216, 255, 217]), {
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    if (url.includes("/arcgis/imagery/labels/")) {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "Content-Type": "image/png" },
      });
    }
    throw new Error("Unexpected upstream URL");
  };

  const routeModule = { exports: {} as { GET: (request: Request, ctx: unknown) => Promise<RouteResponse> } };
  vm.runInNewContext(transpile(routeText), {
    ...contextGlobals,
    fetch: fakeFetch,
    process: { env: { ARCGIS_ACCESS_TOKEN: token } },
    module: routeModule,
    exports: routeModule.exports,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse: SyntheticNextResponse };
      if (id === "@/lib/map-tile-style") return styleModule.exports;
      if (id === "@/lib/auth/session") return {
        getSession: async () => {
          sessionChecks++;
          return session === "live" ? { userId: 9, role: "user", exp: 9_999_999_999, sessionId: "synthetic-session" } : null;
        },
      };
      throw new Error("Unexpected route import: " + id);
    },
  }, { timeout: 2_000 });

  const get = (query: string) => routeModule.exports.GET(
    new Request("https://fly-tally.com/api/map-tile/3/4/2" + query),
    { params: Promise.resolve({ z: "3", x: "4", y: "2" }) },
  );
  return { get, calls, get sessionChecks() { return sessionChecks; } };
}

test("Satellite anonymous request denies before upstream, private 401", async () => {
  const f = fixture();
  const response = await f.get("?style=satellite");
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-flytally-map-style"), "unavailable");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(f.sessionChecks, 1);
  assert.equal(f.calls.length, 0);
});

test("Satellite signed-in route returns private SVG with no wildcard CORS", async () => {
  const f = fixture({ session: "live" });
  const response = await f.get("?style=satellite");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("x-flytally-map-style"), "satellite");
  assert.match(response.headers.get("content-type") ?? "", /^image\/svg\+xml/);
  assert.match(await response.text(), /<svg[\s\S]*<image/);
  assert.equal(f.sessionChecks, 1);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every(call => call.url.includes("LOCAL_SYNTHETIC_TOKEN")));
});

test("Satellite missing server token fails 503 without provider request", async () => {
  const f = fixture({ session: "live", token: "" });
  const response = await f.get("?style=satellite");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.calls.length, 0);
});

test("Bad or duplicate style is rejected before session and upstream", async () => {
  for (const query of ["?style=map&style=satellite", "?Style=satellite", "?style=invalid", "?style="]) {
    const f = fixture();
    const response = await f.get(query);
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("cache-control"), "no-store", query);
    assert.equal(f.sessionChecks, 0, query);
    assert.equal(f.calls.length, 0, query);
  }
});

test("Public Standard remains usable without session, including legacy omitted style", async () => {
  for (const query of ["", "?style=map"]) {
    const f = fixture();
    const response = await f.get(query);
    assert.equal(response.status, 200, query);
    assert.equal(response.headers.get("x-flytally-map-style"), "map", query);
    assert.match(response.headers.get("cache-control") ?? "", /^public, max-age=/, query);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(f.sessionChecks, 0);
    assert.equal(f.calls.length, 1);
    assert.match(f.calls[0].url, /^https:\/\/tile\.openstreetmap\.org\//);
  }
});
