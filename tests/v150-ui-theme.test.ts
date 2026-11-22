import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("maps use one FlyTally-proxied basemap and adapt overlays when theme changes",()=>{
  const helper=read("components/leaflet-mobile.ts"),runtime=read("components/theme-runtime.ts"),proxy=read("app/api/map-tile/[z]/[x]/[y]/route.ts"),layers=read("components/map-layer-controller.ts");
  assert.match(helper,/addFlyTallyBasemap/);assert.match(helper,/FLYTALLY_MAP_TILES/);assert.doesNotMatch(helper,/tile\.openstreetmap\.org/);assert.match(proxy,/OSM_TILE_HOST/);assert.match(proxy,/Referer: referer/);assert.match(helper,/applyStandardMapTheme/);assert.match(layers,/STANDARD_DARK_FILTER/);assert.match(layers,/state\.basePane\.style\.filter/);assert.doesNotMatch(layers,/tilePane\.style\.filter/);assert.match(helper,/MutationObserver/);
  assert.match(runtime,/useResolvedTheme/);assert.match(runtime,/mapThemePalette/);assert.match(runtime,/flytally:themechange/);
  for(const file of ["components/route-overview-map.tsx","components/tracks-map.tsx","components/flight-track-player.tsx","components/gps-import-review-player.tsx"]){const source=read(file);assert.match(source,/addFlyTallyBasemap/);assert.doesNotMatch(source,/dark_all/)}
});
