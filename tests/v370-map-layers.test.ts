import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { satelliteTile, CACHE_SECONDS, USER_AGENT } from "../lib/satellite-map-provider.ts";

const source = (path: string) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("3.7.0 map controller freezes the pane contract and standard-only layer", () => {
  const controller = source("components/map-layer-controller.ts");
  assert.match(controller, /ensurePane\(map, "flytallyBasemap", "210"\)/);
  assert.match(controller, /ensurePane\(map, "flytallyAviation", "300"\)/);
  assert.match(controller, /aviationPane\.style\.pointerEvents = "none"/);
  assert.match(controller, /pane: "flytallyBasemap"/);
  assert.match(controller, /map\.hasLayer\(state\.base\)/);
  assert.doesNotMatch(controller, /api\.tiles\.openaip/);
});

test("3.7.0 standard dark filtering is isolated from default and aviation panes", () => {
  const controller = source("components/map-layer-controller.ts");
  assert.match(controller, /state\.style === "map" && state\.theme === "dark"/);
  assert.match(controller, /state\.basePane\.style\.filter/);
  assert.match(controller, /state\.style = style/);
  assert.match(controller, /state\.aviationPane\.style\.filter = "none"/);
  assert.match(controller, /tiles\.style\.filter = "none"/);
  assert.doesNotMatch(controller, /tilePane\.style\.filter/);
  assert.match(controller, /invert\(\.78\)/);
});

test("3.7.0 rejects bad styles before any upstream tile or token access", () => {
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  assert.match(route, /parseMapTileStyle\(new URL\(request\.url\)\.searchParams\)/);
  assert.match(route, /unsupported_style/);
  const parsed = route.indexOf("const style = parseMapTileStyle");
  const token = route.indexOf("const arcgisToken =");
  assert.ok(parsed >= 0 && token > parsed);
  assert.match(route, /"Cache-Control": "no-store"/);
});

test("3.7.0 existing map consumers remain on the shared standard basemap", () => {
  for (const file of [
    "components/route-overview-map.tsx",
    "components/tracks-map.tsx",
    "components/flight-track-player.tsx",
    "components/gps-import-review-player.tsx",
  ]) {
    const content = source(file);
    assert.match(content, /addFlyTallyBasemap\(map\)/, file);
    assert.match(content, /installResponsiveMap\(map,target\.current\)/, file);
    assert.doesNotMatch(content, /api\.tiles\.openaip/, file);
  }
});

test("3.7.0 Leaflet consumers are loaded behind browser-only boundaries", () => {
  const page = source("app/(protected)/map/page.tsx");
  const mapBoundary = source("components/client-maps.tsx");
  const replayBoundary = source("components/lazy-flight-track-review.tsx");
  const publicBoundary = source("components/public-flight-map.tsx");
  const publicPage = source("app/f/[token]/page.tsx");
  const importReview = source("components/kml-import-form.tsx");
  assert.match(page, /from "@\/components\/client-maps"/);
  assert.doesNotMatch(page, /from "@\/components\/(?:route-overview-map|tracks-map)"/);
  assert.match(mapBoundary, /^"use client";/);
  assert.match(mapBoundary, /import\("@\/components\/route-overview-map"\)/);
  assert.match(mapBoundary, /import\("@\/components\/tracks-map"\)/);
  assert.equal((mapBoundary.match(/ssr:\s*false/g) ?? []).length, 2);
  assert.doesNotMatch(mapBoundary, /^import L from "leaflet"/m);
  assert.match(replayBoundary, /import\("@\/components\/flight-track-player"\)/);
  assert.match(replayBoundary, /ssr:\s*false/);
  assert.doesNotMatch(replayBoundary, /^import \{ FlightTrackPlayer \} from/m);
  assert.match(publicPage, /from "@\/components\/public-flight-map"/);
  assert.doesNotMatch(publicPage, /from "@\/components\/flight-track-player"/);
  assert.match(publicBoundary, /^"use client";/);
  assert.match(publicBoundary, /import\("@\/components\/flight-track-player"\)/);
  assert.match(publicBoundary, /ssr:\s*false/);
  assert.match(importReview, /import\("@\/components\/gps-import-review-player"\)/);
  assert.match(importReview, /ssr:\s*false/);
});

// Source-level guard covering every current and future server route entrypoint.
// Client-only Leaflet wrappers are validated explicitly above.
test("3.7.0 app pages and layouts never import Leaflet runtime directly", () => {
  const appRoot = fileURLToPath(new URL("../app/", import.meta.url));
  const direct = /\bfrom\s*["'](?:@\/components\/(?:route-overview-map|tracks-map|flight-track-player|gps-import-review-player|leaflet-mobile|map-layer-controller)|leaflet)["']/;
  const violations: string[] = [];
  function walk(folder: string): void {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/(?:page|layout)\.tsx$/.test(entry.name)) continue;
      if (direct.test(fs.readFileSync(file, "utf8"))) violations.push(file.slice(appRoot.length));
    }
  }
  walk(appRoot);
  assert.deepEqual(violations, [], "Server entrypoints must import client-only map wrappers, not Leaflet runtime modules");
});

test("3.7.0 public replay fixture restores disposable certified state safely", () => {
  const spec = source("e2e/map-layers.spec.mjs");
  assert.match(spec, /function seedIsolatedMapFixture[\s\S]*?runBrowserFlightFixtureCleanup\(/);
  assert.match(spec, /try \{[\s\S]*?runBrowserFlightFixtureCleanup\([\s\S]*?UPDATE flights SET certified_at=NOW\(\)/);
  assert.match(spec, /finally \{[\s\S]*?runBrowserFlightFixtureCleanup\([\s\S]*?DELETE FROM flights WHERE user_id=9001 AND id=9913/);
  assert.doesNotMatch(spec, /UPDATE flights SET certified_at=NULL/);
  const helper = source("e2e/browser-db.mjs");
  assert.match(helper, /runBrowserFlightFixtureCleanup\(statement\)/);
  assert.match(helper, /BEGIN;[\s\S]*?ALTER TABLE flights DISABLE TRIGGER USER;[\s\S]*?ALTER TABLE flights ENABLE TRIGGER USER;[\s\S]*?COMMIT;/);
});


test("3.7.0 Satellite trial is explicit opt-in and retains Standard by default", () => {
  const control = source("components/satellite-map-control.ts");
  const controller = source("components/map-layer-controller.ts");
  assert.match(control, /NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS === "true"/);
  assert.match(control, /if \(!SATELLITE_MAPS_TRIAL_ENABLED \|\| !enabled\) return \(\) => \{\};/);
  assert.match(controller, /return attachBasemap\(map, "map", url, attribution\)/);
  assert.match(controller, /return attachBasemap\(map, "satellite", url, attribution, onLoad, onError\)/);
  // Failure rollback and unavailable UI state are exercised in Playwright, not inferred from comments.
  assert.match(control, /standardMap\(true\)/);
  assert.match(control, /status\(fallback \? "Satellite unavailable — showing Standard" : ""\)/);
  assert.doesNotMatch(control, /localStorage|sessionStorage/);
  assert.doesNotMatch(control, /openaip/i);
});

test("3.7.0 trial is limited to four authenticated surfaces, not public replay", () => {
  const overview = source("components/route-overview-map.tsx");
  const tracks = source("components/tracks-map.tsx");
  const saved = source("components/flight-track-player.tsx");
  const imported = source("components/gps-import-review-player.tsx");
  for (const file of [overview, tracks, imported]) {
    assert.match(file, /installSatelliteMapControl\(map,true\)/);
    assert.match(file, /cleanupSatellite\(\)/);
  }
  assert.match(saved, /installSatelliteMapControl\(map,!publicView\)/);
  assert.match(saved, /\[samples,tracks,publicView\]/);
  const publicMap = source("components/public-flight-map.tsx");
  assert.match(publicMap, /publicView/);
  assert.doesNotMatch(publicMap, /installSatelliteMapControl/);
  assert.doesNotMatch(source("components/flight-story-card.tsx"), /installSatelliteMapControl/);
});

test("3.7.0 new satellite controller is registered as GPS browser risk", () => {
  const registry = JSON.parse(source("tooling/development-modules.json"));
  const gps = registry.modules.find((entry: { id: string }) => entry.id === "gps-tracks");
  assert.ok(gps, "GPS domain registry entry must exist");
  assert.ok(gps.prefixes.includes("components/satellite-map-control"));
  assert.ok(registry.browserAcceptance.pathTargets.some((entry: { prefixes?: string[] }) =>
    entry.prefixes?.includes("components/satellite-map-control")),
    "new map control must select registered map browser acceptance");
  assert.equal(registry.ownership.auditedTotal, 389);
});

test("3.7.0 R2 Story PNG export rejects missing map tiles and exposes failure", () => {
  const story = source("components/flight-story-card.tsx");
  assert.match(story, /await Promise\.all\(images\.map\(async image =>/);
  assert.match(story, /response\.headers\.get\("X-FlyTally-Map-Style"\) !== style/);
  assert.match(story, /if \(!blob\.type\.startsWith\("image\/"\)\)/);
  assert.doesNotMatch(story, /image\.remove\(\)/);
  assert.match(story, /setExportError\("Story export unavailable/);
  assert.match(story, /role="alert"/);
  assert.match(story, /disabled=\{busy\} aria-pressed=\{mapStyle==="satellite"\}/);
  assert.match(story, /disabled=\{busy\} aria-pressed=\{mapStyle==="map"\}/);
  assert.match(story, /if \(svgUrl\) URL\.revokeObjectURL\(svgUrl\)/);
  assert.match(story, /<FlightStoryCard|export function FlightStoryCard/);
});

test("3.7.0 R2 satellite endpoint requires a live session while Standard stays public", () => {
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  assert.match(route, /import \{ getSession \} from "@\/lib\/auth\/session";/);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  const parsed = route.indexOf("const style = parseMapTileStyle");
  const session = route.indexOf("if (wantsSatellite && !(await getSession()))");
  const token = route.indexOf("const arcgisToken =");
  const upstream = route.indexOf("await satelliteTile(");
  assert.ok(parsed >= 0 && session > parsed && token > session && upstream > token,
    "Strict style parsing and session validation must precede any satellite token or upstream request");
  assert.match(route, /status: 401,\s*headers: \{ "Cache-Control": "private, no-store", "X-FlyTally-Map-Style": "unavailable" \}/);
  const satelliteResponse = route.slice(route.indexOf("if (wantsSatellite) {"), route.indexOf("const upstream = await standardMapTile"));
  assert.match(satelliteResponse, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(satelliteResponse, /"Access-Control-Allow-Origin": "\*"/);
  assert.match(route, /const upstream = await standardMapTile\(/);
  assert.match(route, /"Access-Control-Allow-Origin": "\*"/);
});

test("3.7.0 R2B provider is explicitly GPS-owned and selects real browser map acceptance", () => {
  const registry = JSON.parse(source("tooling/development-modules.json"));
  const gps = registry.modules.find((item: { id: string }) => item.id === "gps-tracks");
  assert.ok(gps?.prefixes.includes("lib/satellite-map-provider"),
    "Provider must be GPS-owned, never silently counted as unowned shared runtime");
  const targets = registry.browserAcceptance.pathTargets.find((item: { prefixes?: string[] }) =>
    item.prefixes?.includes("lib/satellite-map-provider"));
  assert.ok(targets, "Provider changes must trigger authoritative map browser acceptance");
  assert.ok(targets.targets.includes("map-lifecycle-tracks-desktop"));
  assert.ok(targets.targets.includes("map-lifecycle-tracks-mobile"));
  assert.ok(targets.targets.includes("map-tile-style-desktop"));
  assert.ok(targets.targets.includes("map-tile-style-mobile"));
});

test("3.7.0 R2B route delegates authenticated Satellite requests to the tested provider path", () => {
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  const provider = source("lib/satellite-map-provider.ts");
  assert.match(route, /import \{ satelliteTile, isImage, CACHE_SECONDS, USER_AGENT \} from "@\/lib\/satellite-map-provider";/);
  assert.match(route, /if \(wantsSatellite && !\(await getSession\(\)\)\)/);
  assert.match(route, /const svg = await satelliteTile\(z, x, y, arcgisToken!, referer\)/);
  assert.match(route, /const upstream = await standardMapTile\(z, x, y, referer\)/);
  assert.doesNotMatch(provider, /process\.env|from "next\/server"|getSession\(/);
});

test("3.7.0 R2B Satellite combines imagery and labels using the real upstream URL shape", async () => {
  const calls: Array<{url: string; init: RequestInit | undefined}> = [];
  const mock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("World_Imagery")) return new Response("image-bytes", {headers: {"content-type": "image/jpeg"}});
    if (url.includes("/imagery/labels/")) return new Response("label-bytes", {headers: {"content-type": "image/png"}});
    throw new Error("Unexpected upstream call: " + url);
  }) as typeof fetch;
  const svg = await satelliteTile(7, 64, 32, "fake+token/space", "https://fly-tally.com/", mock);
  assert.ok(svg);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /World_Imagery\/MapServer\/tile\/7\/32\/64\?token=/);
  assert.match(calls[1].url, /\/imagery\/labels\/static\/tile\/7\/32\/64\?language=en&token=/);
  for (const call of calls) {
    assert.equal(new URL(call.url).searchParams.get("token"), "fake+token/space");
    assert.equal((call.init?.headers as Record<string, string>).Referer, "https://fly-tally.com/");
    assert.equal((call.init?.headers as Record<string, string>)["User-Agent"], USER_AGENT);
    assert.equal((call.init as RequestInit & {next?: {revalidate: number}})?.next?.revalidate, CACHE_SECONDS);
  }
  assert.match(svg, /data:image\/jpeg;base64,/);
  assert.match(svg, /data:image\/png;base64,/);
  assert.equal((svg.match(/<image /g) ?? []).length, 2);
  assert.doesNotMatch(svg, /fake\+token|fake%2Btoken/);
});

test("3.7.0 R2B rejected preferred labels fall back without exposing provider credentials", async () => {
  const urls: string[] = [];
  const mock = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("World_Imagery")) return new Response("imagery", {headers: {"content-type": "image/jpeg"}});
    if (url.includes("/imagery/labels/")) return new Response("Denied", {status: 403});
    if (url.includes("World_Boundaries_and_Places")) return new Response("fallback", {headers: {"content-type": "image/png"}});
    throw new Error("Unexpected upstream URL");
  }) as typeof fetch;
  const svg = await satelliteTile(2, 1, 2, "fake-secret", "https://fly-tally.com/", mock);
  assert.ok(svg);
  assert.equal(urls.length, 3);
  assert.match(urls[2], /World_Boundaries_and_Places\/MapServer\/tile\/2\/2\/1$/);
  assert.doesNotMatch(urls[2], /token=/);
  assert.equal((svg.match(/<image /g) ?? []).length, 2);
  assert.doesNotMatch(svg, /fake-secret/);
});

test("3.7.0 R2B labels network failure still produces imagery with fallback", async () => {
  const urls: string[] = [];
  const mock = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("World_Imagery")) return new Response("imagery", {headers: {"content-type": "image/jpeg"}});
    if (url.includes("/imagery/labels/")) throw new Error("simulated timeout");
    if (url.includes("World_Boundaries_and_Places")) return new Response("labels", {headers: {"content-type": "image/png"}});
    throw new Error("Unexpected upstream URL");
  }) as typeof fetch;
  const svg = await satelliteTile(3, 1, 2, "fake-token", "https://fly-tally.com/", mock);
  assert.ok(svg);
  assert.equal(urls.length, 3);
  assert.equal((svg.match(/<image /g) ?? []).length, 2);
});

test("3.7.0 R2B base imagery failure fails closed and skips fallback labels", async () => {
  const urls: string[] = [];
  const mock = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("World_Imagery")) throw new Error("simulated provider outage");
    if (url.includes("/imagery/labels/")) return new Response("labels", {headers: {"content-type": "image/png"}});
    throw new Error("Unexpected upstream URL");
  }) as typeof fetch;
  const svg = await satelliteTile(3, 1, 2, "fake-token", "https://fly-tally.com/", mock);
  assert.equal(svg, null);
  assert.equal(urls.length, 2);
});

test("3.7.0 R2B an image-only fallback remains usable without fake labels", async () => {
  const mock = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("World_Imagery")) return new Response("imagery", {headers: {"content-type": "image/jpeg"}});
    if (url.includes("/imagery/labels/")) return new Response("Unavailable", {status: 503});
    if (url.includes("World_Boundaries_and_Places")) return new Response("Unavailable", {status: 503});
    throw new Error("Unexpected upstream URL");
  }) as typeof fetch;
  const svg = await satelliteTile(3, 1, 2, "fake-token", "https://fly-tally.com/", mock);
  assert.ok(svg);
  assert.equal((svg.match(/<image /g) ?? []).length, 1);
});

test("3.7.0 R2C manual HTTP harness cannot bypass isolated auth or call real provider", () => {
  const runner = source("tooling/verify-satellite-http.mjs");
  const fixture = source("tooling/satellite-http-upstream-fixture.cjs");
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  const provider = source("lib/satellite-map-provider.ts");
  assert.match(runner, /FLYTALLY_LOCAL_POSTGRES.*"1"/);
  assert.match(runner, /FLYTALLY_AUTH_BROWSER.*"1"/);
  assert.match(runner, /flytally_satellite_r1_test\|flytally_sat_r1\|55432/);
  assert.match(runner, /bootstrap-browser-smoke-db\.mjs/);
  assert.match(runner, /NODE_ENV: "production"/);
  assert.match(runner, /const ORIGIN = \x60http:\/\/localhost:\$\{PORT\}\x60/);
  assert.match(runner, /sessions\[0\]\.secure, true/);
  assert.match(runner, /credentials: "same-origin"/);
  assert.match(runner, /assert\.match\(response\.headers\["content-type"\]/);
  assert.doesNotMatch(runner, /assert\.match\(response\.headers\(\)\["content-type"\]/);
  assert.doesNotMatch(runner, /const requester = context\.request|headers:\s*\{\s*Cookie:/);
  assert.match(runner, /ARCGIS_ACCESS_TOKEN: MODE === "missing-token" \? "" : TOKEN/);
  assert.match(runner, /"git", \["status", "--porcelain"\]/);
  assert.match(runner, /runBrowserSql\("UPDATE auth_sessions SET revoked_at=NOW\(\)/);
  assert.match(fixture, /net\.Socket\.prototype\.connect = restrictConnect/);
  assert.match(fixture, /Satellite fixture blocked unknown upstream host\/path/);
  assert.match(fixture, /Satellite fixture provider token contract mismatch/);
  assert.match(fixture, /const TOKEN = process\.env\.ARCGIS_ACCESS_TOKEN/);
  assert.doesNotMatch(route, /FLYTALLY_SATELLITE_HTTP_FIXTURE|satellite-http-upstream-fixture/);
  assert.doesNotMatch(provider, /FLYTALLY_SATELLITE_HTTP_FIXTURE|satellite-http-upstream-fixture/);
});

test("3.7.0 R2D.1 exact server-only upstream disable preserves auth, cache, Story and Standard", () => {
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  const runner = source("tooling/verify-satellite-http.mjs");
  const upstreamFixture = source("tooling/satellite-http-upstream-fixture.cjs");
  const story = source("components/flight-story-card.tsx");
  const mapControl = source("components/satellite-map-control.ts");

  const parsed = route.indexOf("const style = parseMapTileStyle");
  const session = route.indexOf("if (wantsSatellite && !(await getSession()))");
  const tokenRead = route.indexOf("const arcgisToken =");
  const tokenMissing = route.indexOf("if (wantsSatellite && !arcgisToken)");
  const disabled = route.indexOf('if (wantsSatellite && process.env.FLYTALLY_SATELLITE_UPSTREAM_DISABLED === "true")');
  const fetchSatellite = route.indexOf("await satelliteTile(");
  const standard = route.indexOf("const upstream = await standardMapTile(");
  assert.ok(parsed >= 0 && session > parsed && tokenRead > session &&
    tokenMissing > tokenRead && disabled > tokenMissing &&
    fetchSatellite > disabled && standard > fetchSatellite,
    "Must reject invalid styles and unsigned sessions before token/disable/cache/provider; Standard remains separate");

  const disabledResponse = route.slice(disabled, fetchSatellite);
  assert.match(disabledResponse, /status: 503/);
  assert.match(disabledResponse, /"Cache-Control": "no-store"/);
  assert.match(disabledResponse, /"X-FlyTally-Map-Style": "unavailable"/);
  assert.doesNotMatch(disabledResponse, /satelliteTile\(|await fetch\(|image\/svg\+xml|Access-Control-Allow-Origin/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_FLYTALLY_SATELLITE_UPSTREAM_DISABLED/);
  assert.doesNotMatch(story + mapControl, /FLYTALLY_SATELLITE_UPSTREAM_DISABLED/);
  assert.match(story, /if\(available\)setMapStyle\("satellite"\);else setMapStyle\("map"\)/);
  assert.match(mapControl, /standardMap\(true\)/);

  assert.match(runner, /FLYTALLY_SATELLITE_HTTP_MODE/);
  assert.match(runner, /"enabled", "disabled", "missing-token"/);
  assert.match(runner, /FLYTALLY_SATELLITE_UPSTREAM_DISABLED: MODE === "disabled" \? "true" : "false"/);
  assert.match(runner, /ARCGIS_ACCESS_TOKEN: MODE === "missing-token" \? "" : TOKEN/);
  assert.match(runner, /assert\.equal\(unavailable\.status, 503/);
  assert.match(runner, /Unavailable Satellite must bypass upstream and warm fetch cache/);
  assert.match(runner, /Duplicate style must be 400/);
  assert.match(runner, /Revoked login must fail before cached provider response/);
  assert.match(upstreamFixture, /MODE === "missing-token"/);
  assert.match(upstreamFixture, /Satellite fixture blocked remote socket/);
});
