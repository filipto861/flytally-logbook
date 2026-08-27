import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.5 dims and desaturates the no-key OSM basemap",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/brightness\(\.38\)/);assert.match(leaflet,/contrast\(1\.35\)/);assert.match(leaflet,/saturate\(\.06\)/)});

test("v1.31.5 increases route contrast above the basemap",()=>{const map=read("components/route-overview-map.tsx");assert.match(map,/baseOpacity=\.58\+\.36/);assert.match(map,/weight=2\+4\.5/)});

test("v1.31.5 release version is current",()=>{assert.equal(JSON.parse(read("package.json")).version,"1.31.5")});
