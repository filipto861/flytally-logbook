import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.6 uses a genuinely dark no-key OSM treatment",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/invert\(1\).*brightness\(\.46\).*contrast\(1\.45\)/);assert.match(leaflet,/saturate\(\.18\)/)});

test("v1.31.6 keeps route overlays independent from tile filtering",()=>{const leaflet=read("components/leaflet-mobile.ts");assert.match(leaflet,/tilePane\.style\.filter/);const map=read("components/route-overview-map.tsx");assert.match(map,/pane:"routeLines"/);assert.match(map,/pane:"airportMarkers"/)});

test("v1.31.6 release version is current",()=>{assert.equal(JSON.parse(read("package.json")).version,"1.31.6")});
