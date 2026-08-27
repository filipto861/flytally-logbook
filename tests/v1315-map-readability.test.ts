import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.5 keeps the no-key OSM basemap filtered for FlyTally readability",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/tilePane\.style\.filter/);assert.match(leaflet,/tile\.openstreetmap\.org/)});

test("v1.31.5 increases route contrast above the basemap",()=>{const map=read("components/route-overview-map.tsx");assert.match(map,/baseOpacity=\.58\+\.36/);assert.match(map,/weight=2\+4\.5/)});

test("v1.31.5 map readability feature remains in the v1.31 release family",()=>{assert.match(JSON.parse(read("package.json")).version,/^1\.31\./)});
