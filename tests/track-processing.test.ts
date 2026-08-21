import test from "node:test";
import assert from "node:assert/strict";
import { parseKml,splitPoints,suggestedSplits,type KmlPoint } from "../lib/track-processing.ts";

const point=(time:string,lat=50,lon=14):KmlPoint=>({lat,lon,alt:300,time});

test("all gx:Track blocks are parsed",()=>{
  const kml=`<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-08-21T08:00:00Z</when><when>2026-08-21T08:01:00Z</when><gx:coord>14 50 300</gx:coord><gx:coord>14.01 50.01 320</gx:coord></gx:Track><gx:Track><when>2026-08-21T10:00:00Z</when><when>2026-08-21T10:01:00Z</when><gx:coord>14.02 50.02 300</gx:coord><gx:coord>14.03 50.03 330</gx:coord></gx:Track></kml>`;
  const points=parseKml(kml);
  assert.equal(points.length,4);
  assert.equal(points[3].time,"2026-08-21T10:01:00Z");
});

test("a long pause near the same airport proposes a split",()=>{
  const points=[point("2026-08-21T08:00:00Z"),point("2026-08-21T08:01:00Z",50.01,14.01),point("2026-08-21T08:02:00Z",50.02,14.02),point("2026-08-21T10:00:00Z",50.0201,14.0201),point("2026-08-21T10:01:00Z",50.03,14.03),point("2026-08-21T10:02:00Z",50.04,14.04)];
  const cuts=suggestedSplits(points);
  assert.deepEqual(cuts,[2]);
  assert.deepEqual(splitPoints(points,cuts).map(part=>part.length),[3,3]);
});

test("an airborne coverage gap does not split a flight",()=>{
  const points=[point("2026-08-21T08:00:00Z"),point("2026-08-21T08:01:00Z",50.1,14.1),point("2026-08-21T08:31:00Z",51.1,15.1),point("2026-08-21T08:32:00Z",51.2,15.2)];
  assert.deepEqual(suggestedSplits(points),[]);
});
