import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");


test("D2-C.1 GPS import review does not fabricate altitude or leave stale file previews ready",()=>{
  const form=read("components/kml-import-form.tsx"),player=read("components/gps-import-review-player.tsx");
  assert.match(form,/fileEpoch=useRef\(0\)/);
  assert.match(form,/const epoch=\+\+fileEpoch\.current/);
  assert.match(form,/setAnalysis\(null\);setReviews\(\[\]\)/);
  assert.match(form,/if\(epoch!==fileEpoch\.current\)return/);
  assert.match(player,/interpolatedGpsAltitude\(a\.alt,b\.alt,fraction\)/);
  assert.match(player,/gpsAltitudeProfileGeometry\(alts,width,height\)/);
  assert.match(player,/Altitude unavailable/);
  assert.doesNotMatch(player,/alt:Number\(a\.alt\?\?0\)/);
  assert.doesNotMatch(player,/samples\.map\(point=>Number\(point\.alt\?\?0\)\)/);
  assert.doesNotMatch(player,/metersToFeet\(current\?\.alt\|\|0\)/);
});


test("D2-C.1 saved GPS track read/replay preserves unknown altitude and valid zero",()=>{
  const decoder=read("lib/data/tracks.ts"),saved=read("components/flight-track-player.tsx");
  assert.match(decoder,/optionalGpsNumber\(item\?\.lat\),lon=optionalGpsNumber\(item\?\.lon\)/);
  assert.match(decoder,/const alt=optionalGpsNumber\(item\?\.alt\); if\(alt!==null\)point\.alt=alt;/);
  assert.doesNotMatch(decoder,/const alt = Number\(item\?\.alt\)/);
  assert.match(saved,/interpolatedGpsAltitude\(a\.alt,b\.alt,fraction\)/);
  assert.match(saved,/gpsAltitudeProfileGeometry\(alts,w,h/);
  assert.match(saved,/Altitude unavailable/);
  assert.doesNotMatch(saved,/current\?\.alt\|\|0/);
});
