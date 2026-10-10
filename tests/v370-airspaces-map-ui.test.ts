import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(file: string) {
  return readFileSync(new URL("../" + file, import.meta.url), "utf8");
}

const control = source("components/airspace-map-control.ts");

test("A2B2 airspaces control is private, opt-in and build OFF by default", () => {
  assert.match(control, /NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS === "true"/);
  assert.match(control, /toggle\.textContent = "Aviation";/);
  assert.match(control, /"Aviation overlay"/);
  assert.doesNotMatch(control, /toggle\.textContent = "Airspaces"/);
  assert.match(control, /if \(!AIRSPACES_MAPS_TRIAL_ENABLED \|\| !enabled\) return \(\) => \{\};/);
  assert.match(control, /const AIRSPACE_TILES = "\/api\/airspace-tile\/\{z\}\/\{x\}\/\{y\}";/);
  assert.doesNotMatch(control, /OPENAIP_API_KEY|x-openaip-api-key|api\.tiles\.openaip\.net/);
});

test("A2B2 airspaces layer is independent of basemap and noninteractive in the aviation pane", () => {
  assert.match(control, /pane: "flytallyAviation"/);
  assert.match(control, /map\.removeLayer\(layer\)/);
  assert.doesNotMatch(control, /attachSatelliteBasemap|attachStandardBasemap|\.fitBounds\(|\.setView\(|map\.remove\(/);
  const controller = source("components/map-layer-controller.ts");
  assert.match(controller, /ensurePane\(map, "flytallyAviation", "300"\)/);
  assert.match(controller, /aviationPane\.style\.pointerEvents = "none"/);
  assert.match(controller, /aviationPane\.style\.filter = "none"/);
});

test("A2B2 explicit zoom budget, fail-closed tile error and attribution contract", () => {
  assert.match(control, /MAX_AIRSPACE_REQUEST_ZOOM = 14/);
  assert.match(control, /if \(map\.getZoom\(\) > MAX_AIRSPACE_REQUEST_ZOOM\)/);
  assert.match(control, /maxZoom: MAX_AIRSPACE_REQUEST_ZOOM/);
  assert.match(control, /layer\.on\("tileerror", tileError\)/);
  assert.match(control, /unavailable = true; \/\/ Avoid retry storms/);
  assert.match(control, /status\("Aviation unavailable/);
  assert.match(control, /Coverage\/status unverified/);
  assert.match(control, /coverage and current status unverified/);
  assert.match(control, /map\.off\("zoomend", onZoomEnd\)/);
});

test("A2B2 four authenticated maps install and dispose, public replay is excluded", () => {
  const maps = [
    "components/route-overview-map.tsx",
    "components/tracks-map.tsx",
    "components/flight-track-player.tsx",
    "components/gps-import-review-player.tsx",
  ];
  for (const path of maps) {
    const file = source(path);
    assert.match(file, /installAirspaceMapControl\(map,/);
    assert.match(file, /cleanupAirspaces\(\)/);
    assert.match(file, /cleanupSatellite\(\)/);
  }
  assert.match(source("components/flight-track-player.tsx"), /installAirspaceMapControl\(map,!publicView\)/);
  assert.doesNotMatch(source("components/public-flight-map.tsx"), /installAirspaceMapControl/);
});

test("A2B2 browser tests use synthetic PNG, verify disabled mode, provider errors and public exclusion", () => {
  const spec = source("e2e/map-layers.spec.mjs");
  assert.match(spec, /NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS === "true"/);
  assert.match(spec, /AIRSPACE_PNG = Buffer\.from/);
  assert.match(spec, /route\.fulfill\(\{ status: 200, contentType: "image\/png", body: AIRSPACE_PNG \}\)/);
  assert.match(spec, /status: 503, body: "Airspaces unavailable"/);
  assert.match(spec, /Aviation overlay/);
  assert.doesNotMatch(spec, /Airspaces overlay/);
  assert.match(spec, /publicMap\.getByRole\("button", \{ name: "Aviation overlay" \}\)\)\.toHaveCount\(0\)/);
});
