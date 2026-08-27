import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.4 replaces legacy CARTO raster tiles with a no-key OpenStreetMap basemap",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/tile\.openstreetmap\.org/);assert.match(leaflet,/basemaps\.cartocdn\.com/);assert.match(leaflet,/replaceLegacyCartoBasemap/);assert.doesNotMatch(leaflet,/api[_-]?key/i)});

test("v1.31.4 keeps the replacement dark to match FlyTally",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/tilePane\.style\.filter/);assert.match(leaflet,/invert\(1\)/)});

test("v1.31.4 basemap feature remains in the v1.31 release family",()=>{assert.match(JSON.parse(read("package.json")).version,/^1\.31\./)});
