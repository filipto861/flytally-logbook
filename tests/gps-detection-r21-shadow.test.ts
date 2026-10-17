import test from "node:test";
import assert from "node:assert/strict";
import {shadowComparePoints,shadowCompareSource} from "../research/gps-detection-r21/legacy-shadow.ts";
import type {KmlPoint} from "../lib/track-processing.ts";

const start=Date.parse("2026-10-17T10:00:00Z");
const elevations=[230,260,300,350,400,430];
for(let i=0;i<5;i++)elevations.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
elevations.push(390,350,310,270,240,230);
const samples:KmlPoint[]=elevations.map((alt,i)=>({
  lat:48+(95*5/3600/111.2)*i,lon:10,alt,time:new Date(start+5000*i).toISOString(),
}));

test("R2.1a shadow: same normalized sample sequence yields comparable candidate counts only",()=>{
  const result=shadowComparePoints(samples);
  assert.equal(result.basis,"POST_NORMALIZATION_ONLY");
  assert.equal(result.preprocessingConfound,"NOT_ISOLATED");
  assert.equal(result.rawAcquisitionOrderRecovered,false);
  assert.equal(result.normalizedSampleCount,samples.length);
  assert.equal(result.legacyTouchAndGoCount,5);
  assert.equal(result.legacySuggestedLandings,6);
  assert.equal(result.newPatternCandidateCount,5);
  assert.ok(result.newCandidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});

test("R2.1a shadow: raw gx:Track uses exact production parser; confound remains explicit",()=>{
  const body=samples.map(p=>"<when>"+p.time+"</when>").join("")+
    samples.map(p=>"<gx:coord>"+p.lon+" "+p.lat+" "+p.alt+"</gx:coord>").join("");
  const source="<kml xmlns:gx=\"http://www.google.com/kml/ext/2.2\"><gx:Track>"+body+"</gx:Track></kml>";
  const result=shadowCompareSource(source,"synthetic.kml");
  assert.equal(result.basis,"PRODUCTION_PREPROCESSED_SOURCE");
  assert.equal(result.preprocessingConfound,"NOT_ISOLATED");
  assert.equal(result.rawAcquisitionOrderRecovered,false);
  assert.equal(result.normalizedSampleCount,samples.length);
  assert.equal(result.legacySuggestedLandings,6);
  assert.ok(result.newCandidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});
