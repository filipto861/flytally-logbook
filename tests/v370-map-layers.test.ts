import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
  assert.match(controller, /state\.basePane\.style\.filter = theme === "dark"/);
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
});
