import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { loginBrowserPilot } from "./browser-actions.mjs";
import { browserSqlScalar, resetIntelligentReviewFormScopeFixture, runBrowserFlightFixtureCleanup, runBrowserSql } from "./browser-db.mjs";

const authenticatedBrowser = process.env.FLYTALLY_AUTH_BROWSER === "1";
const satelliteTrial = process.env.NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS === "true";
const airspacesTrial = process.env.NEXT_PUBLIC_FLYTALLY_AIRSPACES_MAPS === "true";
const AIRSPACE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kPr0AAAAASUVORK5CYII=", "base64");
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#abc6d4"/><path d="M0 128H256" stroke="#456c85"/></svg>';
const coordinates = JSON.stringify([
  { lat: 50.10, lon: 14.10, alt: 300, time: "2026-09-18T10:05:00Z" },
  { lat: 50.13, lon: 14.14, alt: 600, time: "2026-09-18T10:10:00Z" },
  { lat: 50.18, lon: 14.20, alt: 450, time: "2026-09-18T10:15:00Z" },
  { lat: 50.21, lon: 14.24, alt: 300, time: "2026-09-18T10:20:00Z" },
]);

async function seedIsolatedMapFixture(request) {
  // The isolated bootstrap does not create the lazily initialized share table.
  // Exercise the real public route before fixture cleanup so the runtime creates it.
  const shareSchemaProbe = await request.get("/f/FlyTallyPhase1SchemaProbe20261009");
  expect(shareSchemaProbe.status()).toBe(404);
  expect(browserSqlScalar("SELECT to_regclass('public.flight_public_shares') IS NOT NULL")).toBe("t");
  // Isolated localhost browser DB only; the helper rejects production hosts.
  // Recover from interrupted runs that left this synthetic flight certified.
  // The existing fixture helper scopes trigger bypass to one transaction.
  runBrowserFlightFixtureCleanup(`
    DELETE FROM flight_public_shares WHERE user_id=9001 AND flight_id=9913;
    DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id=9913;
    DELETE FROM flights WHERE user_id=9001 AND id=9913;
  `);
  resetIntelligentReviewFormScopeFixture();
  runBrowserSql(`INSERT INTO flight_tracks(id,user_id,flight_id,file_name,point_count,distance_km,coordinates_json,overview_coordinates_json)
    VALUES (9972,9001,9913,'phase1-map.kml',4,18,'${coordinates}','${coordinates}');`);
}

async function openMap(page, path) {
  await page.route("**/api/map-tile/**", async route => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: TILE });
  });
  await loginBrowserPilot(page, "/map");
  if (path !== "/map") await page.goto(path);
}

async function setTheme(page, theme) {
  await page.evaluate(value => {
    document.documentElement.dataset.theme = value;
    window.dispatchEvent(new Event("flytally:themechange"));
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function checkStandardPanes(page, selector, routeOverview = false) {
  const map = page.locator(selector);
  await expect(map.locator(".leaflet-map-pane")).toHaveCount(1);
  const effective = await map.evaluate(element => {
    const read = name => {
      const pane = element.querySelector(".leaflet-" + name + "-pane");
      return pane ? {
        zIndex: Number(getComputedStyle(pane).zIndex),
        filter: getComputedStyle(pane).filter,
        pointerEvents: getComputedStyle(pane).pointerEvents,
      } : null;
    };
    return {
      tile: read("tile"),
      basemap: read("flytallyBasemap"),
      aviation: read("flytallyAviation"),
      overlay: read("overlay"),
      routes: read("routeLines"),
      airports: read("airportMarkers"),
      marker: read("marker"),
      tooltip: read("tooltip"),
      popup: read("popup"),
    };
  });
  expect(effective.tile?.zIndex).toBe(200);
  expect(effective.tile?.filter).toBe("none");
  expect(effective.basemap?.zIndex).toBe(210);
  expect(effective.aviation?.zIndex).toBe(300);
  expect(effective.aviation?.pointerEvents).toBe("none");
  expect(effective.aviation?.filter).toBe("none");
  expect(effective.overlay?.zIndex).toBe(400);
  expect(effective.marker?.zIndex).toBe(600);
  expect(effective.tooltip?.zIndex).toBe(650);
  expect(effective.popup?.zIndex).toBe(700);
  if (routeOverview) {
    expect(effective.routes?.zIndex).toBe(450);
    expect(effective.airports?.zIndex).toBe(470);
    await expect(map.locator(".leaflet-routeLines-pane .route-click-target").first()).toBeAttached();
    await expect(map.locator(".leaflet-airportMarkers-pane path").first()).toBeAttached();
  }
  // A single Leaflet tile layer may own multiple tile/zoom containers.
  await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
  await expect(map.locator(".leaflet-tile-pane > .leaflet-layer")).toHaveCount(0);
  await expect(map.locator(".leaflet-flytallyBasemap-pane img.leaflet-tile").first()).toBeAttached();
  await expect(map.locator(".leaflet-flytallyAviation-pane img")).toHaveCount(0);
  await expect(map.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  return map;
}

async function assertSamePaneAfterTheme(page, map) {
  await map.locator(".leaflet-map-pane").evaluate(el => { el.dataset.phase1PaneIdentity = "stable"; });
  const before = await map.locator(".leaflet-map-pane").evaluate(el => el.style.transform);
  await setTheme(page, "dark");
  await expect(map.locator(".leaflet-map-pane")).toHaveAttribute("data-phase1-pane-identity", "stable");
  await expect(map.locator(".leaflet-flytallyBasemap-pane")).toHaveCSS("filter", /invert/);
  await expect(map.locator(".leaflet-tile-pane")).toHaveCSS("filter", "none");
  await setTheme(page, "light");
  await expect(map.locator(".leaflet-map-pane")).toHaveAttribute("data-phase1-pane-identity", "stable");
  await expect(map.locator(".leaflet-flytallyBasemap-pane")).toHaveCSS("filter", "none");
  const after = await map.locator(".leaflet-map-pane").evaluate(el => el.style.transform);
  expect(after).toBe(before);
  await expect(map.locator(".leaflet-map-pane")).toHaveCount(1);
}

test("map panes preserve standard basemap ordering and route interactions", async ({ page }) => {
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  await seedIsolatedMapFixture(page.request);
  await openMap(page, "/map");
  const map = await checkStandardPanes(page, ".route-overview-map", true);
  await setTheme(page, "light");
  await assertSamePaneAfterTheme(page, map);
  const settings = map.getByRole("button", { name: "Map settings" });
  await expect(settings).toHaveCount(satelliteTrial || airspacesTrial ? 1 : 0);
  if (satelliteTrial || airspacesTrial) {
    await expect(settings).toHaveAttribute("aria-expanded", "false");
    await settings.click();
    await expect(settings).toHaveAttribute("aria-expanded", "true");
    await expect(map.getByRole("region", { name: "Map settings" })).toBeVisible();
    await settings.press("Escape");
    await expect(settings).toHaveAttribute("aria-expanded", "false");
    await expect(settings).toBeFocused();
    await settings.click();
    await page.getByRole("heading", { name: "Airports and routes" }).click();
    await expect(settings).toHaveAttribute("aria-expanded", "false");
    await settings.click();
  }
  const satelliteButton = map.getByRole("button", { name: "Satellite map" });
  await expect(satelliteButton).toHaveCount(satelliteTrial ? 1 : 0);
  if (satelliteTrial) {
    // Local SVG-only interception proves no live/paid provider contact.
    await map.locator(".leaflet-map-pane").evaluate(el => { el.dataset.satelliteIdentity = "preserved"; });
    await satelliteButton.click();
    await expect(satelliteButton).toHaveAttribute("aria-pressed", "true");
    await expect(map.locator(".leaflet-control-attribution")).toContainText("Esri");
    await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
    await setTheme(page, "dark");
    await expect(map.locator(".leaflet-flytallyBasemap-pane")).toHaveCSS("filter", "none");
    await expect(map.locator(".leaflet-map-pane")).toHaveAttribute("data-satellite-identity", "preserved");
    await map.getByRole("button", { name: "Standard map" }).click();
    await expect(satelliteButton).toHaveAttribute("aria-pressed", "false");
    await expect(map.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
    await expect(map.locator(".leaflet-control-attribution")).not.toContainText("Esri");
    await expect(map.locator(".leaflet-control-attribution")).not.toContainText("TomTom");
    // Repeated user-initiated swaps must not retain attribution from a removed layer.
    for (let cycle = 0; cycle < 2; cycle++) {
      await satelliteButton.click();
      await expect(map.locator(".leaflet-control-attribution")).toContainText("Esri");
      await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
      await map.getByRole("button", { name: "Standard map" }).click();
      await expect(map.locator(".leaflet-control-attribution")).not.toContainText("Esri");
      await expect(map.locator(".leaflet-control-attribution")).not.toContainText("TomTom");
      await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
    }
    await expect(map.locator(".leaflet-flytallyBasemap-pane")).toHaveCSS("filter", /invert/);
    await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
  }
  const airspaces = map.getByRole("button", { name: "Aviation overlay" });
  await expect(airspaces).toHaveCount(airspacesTrial ? 1 : 0);
  if (airspacesTrial) {
    let requests = 0;
    // Synthetic provider response: do not contact external openAIP in browser tests.
    await page.route("**/api/airspace-tile/**", async route => {
      requests++;
      await route.fulfill({ status: 200, contentType: "image/png", body: AIRSPACE_PNG });
    });
    await airspaces.click();
    await expect(airspaces).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => requests).toBeGreaterThan(0);
    await expect(map.locator(".leaflet-flytallyAviation-pane img.leaflet-tile").first()).toBeAttached();
    await expect(map.locator(".leaflet-control-attribution")).toContainText("openAIP");
    await expect(map.getByRole("status")).toContainText("coverage and current status unverified");
    if (satelliteTrial) {
      await map.getByRole("button", { name: "Satellite map" }).click();
      await expect(airspaces).toHaveAttribute("aria-pressed", "true");
      await expect(map.locator(".leaflet-control-attribution")).toContainText("openAIP");
      await map.getByRole("button", { name: "Standard map" }).click();
      await expect(airspaces).toHaveAttribute("aria-pressed", "true");
    }
    await airspaces.click();
    await expect(airspaces).toHaveAttribute("aria-pressed", "false");
    await expect(map.locator(".leaflet-flytallyAviation-pane img.leaflet-tile")).toHaveCount(0);
    await expect(map.locator(".leaflet-control-attribution")).not.toContainText("openAIP");
  }
  // Real hit-target interaction: noninteractive aviation pane must not swallow route clicks.
  const routeHit=map.locator(".leaflet-routeLines-pane .route-click-target").first();
  await routeHit.hover();
  await expect(map.locator(".leaflet-tooltip")).toBeVisible();
  await routeHit.click();
  await expect(page).toHaveURL(/\/flights\?routePair=/);
});

test("GPS map theme changes preserve a live map instance and viewport", async ({ page }) => {
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  await seedIsolatedMapFixture(page.request);
  await openMap(page, "/map?mode=tracks");
  const map = await checkStandardPanes(page, ".track-map.responsive-map");
  await setTheme(page, "light");
  await assertSamePaneAfterTheme(page, map);
  if (satelliteTrial || airspacesTrial) await map.getByRole("button", { name: "Map settings" }).click();
  if (satelliteTrial) {
    // Fail closed on provider failure, without retrying or reinitializing the map.
    await page.route("**/api/map-tile/**", route =>
      route.request().url().includes("style=satellite")
        ? route.fulfill({ status: 502, body: "Unavailable" })
        : route.fulfill({ status: 200, contentType: "image/svg+xml", body: TILE }));
    const satellite = map.getByRole("button", { name: "Satellite map" });
    await satellite.click();
    await expect(map.getByRole("status")).toContainText("Satellite unavailable");
    await expect(satellite).toBeDisabled();
    await expect(map.getByRole("button", { name: "Standard map" })).toHaveAttribute("aria-pressed", "true");
    await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
    await expect(map.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  }
  const airspaces = map.getByRole("button", { name: "Aviation overlay" });
  await expect(airspaces).toHaveCount(airspacesTrial ? 1 : 0);
  if (airspacesTrial) {
    // Internal 503 is the expected fail-closed result without verified provider gates.
    await page.route("**/api/airspace-tile/**", route =>
      route.fulfill({ status: 503, body: "Aviation overlay unavailable" }));
    await airspaces.click();
    await expect(airspaces).toHaveAttribute("aria-pressed", "false");
    await expect(airspaces).toBeDisabled();
    await expect(map.getByRole("status").filter({ hasText: "Aviation unavailable" })).toBeVisible();
    await expect(map.locator(".leaflet-flytallyAviation-pane img.leaflet-tile")).toHaveCount(0);
    await expect(map.locator(".leaflet-flytallyBasemap-pane > .leaflet-layer")).toHaveCount(1);
  }
  await expect(map.locator(".leaflet-overlay-pane canvas").first()).toBeAttached();
});

test("flight replay retains map and playback state through theme changes", async ({ page }) => {
  // Public-share SSR follow-up adds two server reads and an isolated DB fixture.
  test.setTimeout(60_000);
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  await seedIsolatedMapFixture(page.request);
  await openMap(page, "/flights/9913?tab=gps");
  const map = await checkStandardPanes(page, ".player-responsive-map");
  if (satelliteTrial || airspacesTrial) await map.getByRole("button", { name: "Map settings" }).click();
  await expect(map.getByRole("button", { name: "Aviation overlay" })).toHaveCount(airspacesTrial ? 1 : 0);
  await setTheme(page, "light");
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("2");
  await page.getByRole("button", { name: "Play track" }).click();
  await expect(page.getByRole("button", { name: "Pause track" })).toBeVisible();
  await assertSamePaneAfterTheme(page, map);
  await expect(page.getByRole("button", { name: "Pause track" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Playback speed" })).toHaveValue("2");

  // Exercise the actual public SSR entrypoint with a source-private, isolated
  // synthetic share; route-only SSR smoke is insufficient to load Leaflet.
  const token = "FlyTallyPhase1PublicReplay20261009";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const absent = await page.request.get("/f/FlyTallyPhase1SchemaProbe20261009");
  expect(absent.status()).toBe(404); // also initializes the isolated share schema
  try {
    // Public-only state belongs to this disposable fixture, never production.
    runBrowserFlightFixtureCleanup(`
      UPDATE flights SET certified_at=NOW() WHERE id=9913 AND user_id=9001;
      DELETE FROM flight_public_shares WHERE user_id=9001 AND flight_id=9913;
      INSERT INTO flight_public_shares(user_id,flight_id,token_hash,show_registration,show_date,show_track)
      VALUES (9001,9913,'${tokenHash}',FALSE,TRUE,TRUE);
    `);
    await page.goto("/f/" + token);
    await expect(page.getByRole("heading", { name: "Replay the flight" })).toBeVisible();
    const publicMap = await checkStandardPanes(page, ".player-responsive-map");
    await expect(publicMap.getByRole("button", { name: "Map settings" })).toHaveCount(0);
    await expect(publicMap.getByRole("button", { name: "Satellite map" })).toHaveCount(0);
    await expect(publicMap.getByRole("button", { name: "Aviation overlay" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play track" })).toBeVisible();
  } finally {
    runBrowserFlightFixtureCleanup(`
      DELETE FROM flight_public_shares WHERE user_id=9001 AND flight_id=9913 AND token_hash='${tokenHash}';
      DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id=9913;
      DELETE FROM flights WHERE user_id=9001 AND id=9913;
    `);
  }
});

test("GPS import review retains its map pane across theme changes", async ({ page }) => {
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  await page.route("**/api/map-tile/**", async route => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: TILE });
  });
  await loginBrowserPilot(page, "/flights/new");
  await page.getByRole("button", { name: "Import GPS track" }).click();
  const form = page.locator("form.kml-wizard");
  const kml = '<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>' +
    '<when>2026-10-05T14:00:00Z</when><when>2026-10-05T14:01:00Z</when><when>2026-10-05T14:02:00Z</when><when>2026-10-05T14:03:00Z</when>' +
    '<gx:coord>14.10 50.10 300</gx:coord><gx:coord>14.13 50.12 450</gx:coord><gx:coord>14.18 50.16 800</gx:coord><gx:coord>14.24 50.20 500</gx:coord></gx:Track></kml>';
  await form.locator('input[name="kml"]').setInputFiles({
    name: "phase1-import-review.kml",
    mimeType: "application/vnd.google-earth.kml+xml",
    buffer: Buffer.from(kml),
  });
  const details = form.locator("details.gps-track-review");
  await expect(details).toBeAttached();
  if (!(await details.evaluate(node => node.open))) await details.locator("summary").click();
  const map = await checkStandardPanes(page, ".import-review-map");
  if (satelliteTrial || airspacesTrial) await map.getByRole("button", { name: "Map settings" }).click();
  await expect(map.getByRole("button", { name: "Aviation overlay" })).toHaveCount(airspacesTrial ? 1 : 0);
  await setTheme(page, "light");
  await assertSamePaneAfterTheme(page, map);
});

test("map tile endpoint rejects unsupported and duplicate styles before upstream fetch", async ({ request }) => {
  for (const query of [
    "style=unknown",
    "style=satelite",
    "style%5B%5D=satellite",
    "style=",
    "style=map&style=satellite",
    "style=map&style=map",
    "style%5Bfoo%5D=satellite",
    "style%5B0%5D%5B1%5D=map",
    "style=satellite&style%5Bfoo%5D=map",
    "Style=satellite",
    "style=map&STYLE=satellite",
  ]) {
    const response = await request.get("/api/map-tile/0/0/0?" + query);
    expect(response.status(), query).toBe(400);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unsupported_style" });
  }
});
