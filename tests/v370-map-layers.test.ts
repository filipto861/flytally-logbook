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
