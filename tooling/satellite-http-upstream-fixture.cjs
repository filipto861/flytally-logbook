"use strict";

// Loaded ONLY by tooling/verify-satellite-http.mjs into a dedicated local Next
// process. This file does not ship in Next's app/runtime module graph.
const { appendFileSync } = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");

const TOKEN = process.env.ARCGIS_ACCESS_TOKEN;
const MODE = process.env.FLYTALLY_SATELLITE_HTTP_FIXTURE_MODE || "enabled";
const TILE_Z = 18;
const TILE_X0 = Number(process.env.FLYTALLY_SATELLITE_HTTP_TILE_X0);
const TILE_Y = Number(process.env.FLYTALLY_SATELLITE_HTTP_TILE_Y);
// Accept only our generated valid coordinates; no fixture requests can be
// redirected to arbitrary provider paths or real network destinations.
if (!Number.isInteger(TILE_X0) || TILE_X0 < 1024 || TILE_X0 + 4 >= 2 ** TILE_Z ||
    !Number.isInteger(TILE_Y) || TILE_Y < 1024 || TILE_Y >= 2 ** TILE_Z) {
  throw new Error("Satellite HTTP fixture requires guarded generated tile coordinates.");
}
if (!["enabled", "disabled", "missing-token"].includes(MODE)) {
  throw new Error("Satellite HTTP fixture requires an explicit supported mode.");
}
if (MODE === "missing-token" ? TOKEN !== "" : !/^FlyTally-R2C-fixture-token-[a-f0-9]{24}$/.test(TOKEN || "")) {
  throw new Error("Satellite HTTP fixture requires controlled non-production provider credentials.");
}
if (process.env.FLYTALLY_SATELLITE_HTTP_FIXTURE !== "1" ||
    process.env.FLYTALLY_LOCAL_POSTGRES !== "1" ||
    process.env.FLYTALLY_AUTH_BROWSER !== "1" ||
    !process.env.FLYTALLY_SATELLITE_FIXTURE_LOG) {
  throw new Error("Satellite HTTP upstream fixture cannot run outside isolated local acceptance.");
}

const loopbacks = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
function remoteHost(args) {
  const options = args[0];
  if (options && typeof options === "object") {
    if (options.path) return null; // local Unix socket or named pipe
    return options.host || options.hostname || "localhost";
  }
  if (typeof args[1] === "string") return args[1];
  return "localhost";
}
function restrictConnect(original) {
  return function (...args) {
    const host = remoteHost(args);
    if (host && !loopbacks.has(host)) throw new Error("Satellite fixture blocked remote socket");
    return original.apply(this, args);
  };
}
// Defense in depth: a change in Next's fetch wrapper must not silently send a
// real provider request. Existing localhost PostgreSQL and Next connections work.
net.connect = restrictConnect(net.connect);
net.createConnection = restrictConnect(net.createConnection);
net.Socket.prototype.connect = restrictConnect(net.Socket.prototype.connect);
tls.connect = restrictConnect(tls.connect);

const originalFetch = globalThis.fetch;
const base = "ibasemaps-api.arcgis.com";
const preferred = "static-map-tiles-api.arcgis.com";
const fallback = "services.arcgisonline.com";
const osm = "tile.openstreetmap.org";
const baseMarker = Buffer.from("FLYTALLY_HTTP_BASE_2C");
const labelMarker = Buffer.from("FLYTALLY_HTTP_LABEL_2C");
const fallbackMarker = Buffer.from("FLYTALLY_HTTP_FALLBACK_2C");
const record = (kind, x, outcome) => appendFileSync(process.env.FLYTALLY_SATELLITE_FIXTURE_LOG,
  JSON.stringify({ kind, x, outcome }) + "\n");

globalThis.fetch = async function (input, init) {
  const raw = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = new URL(raw);
  if ((url.protocol === "http:" || url.protocol === "https:") && loopbacks.has(url.hostname)) {
    return originalFetch.call(this, input, init);
  }
  if (url.protocol !== "https:") throw new Error("Satellite fixture blocked non-HTTPS upstream");

  if (url.hostname === osm && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)) {
    record("standard", "-", "200");
    return new Response(baseMarker, { status: 200, headers: { "content-type": "image/png" } });
  }

  let kind;
  if (url.hostname === base && url.pathname.startsWith("/arcgis/rest/services/World_Imagery/MapServer/tile/")) {
    kind = "base";
  } else if (url.hostname === preferred && url.pathname.startsWith("/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/")) {
    kind = "labels";
  } else if (url.hostname === fallback && url.pathname.startsWith("/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/")) {
    kind = "fallback";
  } else {
    throw new Error("Satellite fixture blocked unknown upstream host/path");
  }
  if ((kind !== "fallback" && url.searchParams.get("token") !== TOKEN) ||
      (kind === "fallback" && url.searchParams.has("token"))) {
    throw new Error("Satellite fixture provider token contract mismatch");
  }
  const matches = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)$/);
  if (!matches) throw new Error("Satellite fixture tile coordinate format mismatch");
  const [z, y, x] = matches.slice(1);
  const scenario = Number(x) - TILE_X0 + 1;
  if (z !== String(TILE_Z) || y !== String(TILE_Y) ||
      !Number.isInteger(scenario) || scenario < 1 || scenario > 5) {
    throw new Error("Satellite fixture unexpected coordinates");
  }
  // Record stable logical case indices while changing the real tile URLs
  // between runs, to prevent unkeyed fallback Data Cache reuse.
  const caseId = String(scenario);
  if (kind === "base" && scenario === 3) {
    record(kind, caseId, "503");
    return new Response("Base unavailable", { status: 503 });
  }
  if (kind === "base" && scenario === 5) {
    record(kind, caseId, "network-error");
    throw new Error("Simulated base imagery network outage");
  }
  if (kind === "labels" && scenario !== 1) {
    record(kind, caseId, "403");
    return new Response("Labels unavailable", { status: 403 });
  }
  if (kind === "fallback" && scenario === 4) {
    record(kind, caseId, "503");
    return new Response("Fallback unavailable", { status: 503 });
  }
  record(kind, caseId, "200");
  return new Response(kind === "base" ? baseMarker : kind === "labels" ? labelMarker : fallbackMarker,
    { status: 200, headers: { "content-type": kind === "base" ? "image/jpeg" : "image/png" } });
};
