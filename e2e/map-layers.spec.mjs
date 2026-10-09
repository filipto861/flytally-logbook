import { test, expect } from "@playwright/test";
import { loginBrowserPilot } from "./browser-actions.mjs";
import { resetIntelligentReviewFormScopeFixture, runBrowserSql } from "./browser-db.mjs";

const authenticatedBrowser = process.env.FLYTALLY_AUTH_BROWSER === "1";
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#abc6d4"/><path d="M0 128H256" stroke="#456c85"/></svg>';
const coordinates = JSON.stringify([
  { lat: 50.10, lon: 14.10, alt: 300, time: "2026-09-18T10:05:00Z" },
  { lat: 50.13, lon: 14.14, alt: 600, time: "2026-09-18T10:10:00Z" },
  { lat: 50.18, lon: 14.20, alt: 450, time: "2026-09-18T10:15:00Z" },
  { lat: 50.21, lon: 14.24, alt: 300, time: "2026-09-18T10:20:00Z" },
]);

function seedIsolatedMapFixture() {
  // Isolated localhost browser DB only; the helper rejects production hosts.
  runBrowserSql("DELETE FROM flight_tracks WHERE id=9972 AND user_id=9001;");
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
  seedIsolatedMapFixture();
  await openMap(page, "/map");
  const map = await checkStandardPanes(page, ".route-overview-map", true);
  await setTheme(page, "light");
  await assertSamePaneAfterTheme(page, map);
});

test("GPS map theme changes preserve a live map instance and viewport", async ({ page }) => {
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  seedIsolatedMapFixture();
  await openMap(page, "/map?mode=tracks");
  const map = await checkStandardPanes(page, ".track-map.responsive-map");
  await setTheme(page, "light");
  await assertSamePaneAfterTheme(page, map);
  await expect(map.locator(".leaflet-overlay-pane canvas").first()).toBeAttached();
});

test("flight replay retains map and playback state through theme changes", async ({ page }) => {
  test.skip(!authenticatedBrowser, "Map acceptance requires the isolated authenticated browser DB.");
  seedIsolatedMapFixture();
  await openMap(page, "/flights/9913?tab=gps");
  const map = await checkStandardPanes(page, ".player-responsive-map");
  await setTheme(page, "light");
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("2");
  await page.getByRole("button", { name: "Play track" }).click();
  await expect(page.getByRole("button", { name: "Pause track" })).toBeVisible();
  await assertSamePaneAfterTheme(page, map);
  await expect(page.getByRole("button", { name: "Pause track" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Playback speed" })).toHaveValue("2");
});
