import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

test("3.7.0 security containment requires Satellite session before token/upstream; Standard stays public", () => {
  const route = source("app/api/map-tile/[z]/[x]/[y]/route.ts");
  assert.match(route, /import \{ getSession \} from "@\/lib\/auth\/session";/);
  assert.doesNotMatch(route, /export const dynamic = "force-dynamic";/, "Do not disable shared Standard upstream caching");
  const parsed = route.indexOf("const style = parseMapTileStyle");
  const session = route.indexOf("if (wantsSatellite && !(await getSession()))");
  const token = route.indexOf("const arcgisToken =");
  const provider = route.indexOf("const svg = await satelliteTile(");
  assert.ok(parsed >= 0 && session > parsed && token > session && provider > token,
    "Strict style validation and live session check must happen before token/provider access");
  assert.match(route, /status: 401,[\s\S]*?"Cache-Control": "private, no-store"/);
  // Source text may use LF on GitHub or CRLF on Windows checkouts.
  // Match the semantic block, not a literal newline plus indentation.
  const satelliteStart = route.lastIndexOf("if (wantsSatellite) {");
  const standardStart = route.indexOf("const upstream = await standardMapTile(");
  assert.ok(satelliteStart >= 0 && standardStart > satelliteStart);
  const satellite = route.slice(satelliteStart, standardStart);
  assert.match(satellite, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(satellite, /"Access-Control-Allow-Origin": "\*"/);
  const standard = route.slice(standardStart);
  assert.match(standard, /"Cache-Control": "public, max-age=86400/);
  assert.match(standard, /"Access-Control-Allow-Origin": "\*"/);
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
    assert.match(file, /installMapSettingsControl\(map,true\)/);
    assert.match(file, /cleanupMapSettings\(\)/);
  }
  assert.match(saved, /installMapSettingsControl\(map,!publicView\)/);
  assert.match(saved, /\[samples,tracks,publicView\]/);
  const publicMap = source("components/public-flight-map.tsx");
  assert.match(publicMap, /publicView/);
  assert.doesNotMatch(publicMap, /installMapSettingsControl/);
  assert.doesNotMatch(source("components/flight-story-card.tsx"), /installMapSettingsControl/);
});

test("3.7.0 new satellite controller is registered as GPS browser risk", () => {
  const registry = JSON.parse(source("tooling/development-modules.json"));
  const gps = registry.modules.find((entry: { id: string }) => entry.id === "gps-tracks");
  assert.ok(gps, "GPS domain registry entry must exist");
  assert.ok(gps.prefixes.includes("components/satellite-map-control"));
  assert.ok(registry.browserAcceptance.pathTargets.some((entry: { prefixes?: string[] }) =>
    entry.prefixes?.includes("components/satellite-map-control")),
    "new map control must select registered map browser acceptance");
  assert.equal(registry.ownership.auditedTotal, 391);
});


test("A2E shared Map settings contains both independent gated controllers without changing aviation authority", () => {
  const composite = source("components/satellite-map-control.ts");
  const aviation = source("components/airspace-map-control.ts");
  const css = source("app/ui-system.css");

  assert.match(composite, /export function installMapSettingsControl\(map: L\.Map, enabled: boolean\)/);
  assert.match(composite, /!SATELLITE_MAPS_TRIAL_ENABLED && !AIRSPACES_MAPS_TRIAL_ENABLED/);
  assert.match(composite, /installSatelliteMapControl\(map, enabled, panel\)/);
  assert.match(composite, /installAirspaceMapControl\(map, enabled, panel\)/);
  assert.match(composite, /trigger\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(composite, /panel\.hidden = !value/);
  assert.match(composite, /event\.key !== "Escape"/);
  assert.match(composite, /document\.addEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(composite, /document\.removeEventListener\("pointerdown", onPointerDown, true\)/);
  assert.match(composite, /cleanupAirspaces\(\);[\s\S]*cleanupSatellite\(\);[\s\S]*control\.remove\(\);/);
  assert.match(composite, /host\?\.append|host\.append\(root\)/);
  assert.match(aviation, /host\.append\(root\)/);
  assert.match(composite, /standardMap\(true\)/);
  assert.match(aviation, /unavailable = true; \/\/ Avoid retry storms/);
  assert.match(css, /\.flytally-map-settings-panel\[hidden\]\{display:none\}/);
  assert.match(css, /\.flytally-map-settings-panel button:focus-visible/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.doesNotMatch(composite, /localStorage|sessionStorage|OPENAIP_API_KEY/);
});
