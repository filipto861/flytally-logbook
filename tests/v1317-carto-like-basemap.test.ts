import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.7 tunes the no-key OSM basemap toward CARTO Dark Matter",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/invert\(\.78\)/);assert.match(leaflet,/brightness\(\.92\)/);assert.match(leaflet,/contrast\(1\.08\)/);assert.match(leaflet,/saturate\(\.12\)/)});

test("v1.31.7 keeps the basemap no-key",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/tile\.openstreetmap\.org/);assert.doesNotMatch(leaflet,/api[_-]?key/i)});

test("v1.31.7 release version is current",()=>{assert.equal(JSON.parse(read("package.json")).version,"1.31.7")});
