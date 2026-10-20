import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {touchAndGoEvents,type KmlPoint} from "../lib/track-processing.ts";
import {
  D1_LEGACY_SOURCE_BLOB,
  diagnoseLegacyAltitudeAtIndex,
  summarizeLegacyAltitudeDiagnostics,
} from "../research/gps-detector-accuracy/d1-altitude-diagnostics.ts";

const start=Date.parse("2026-10-20T10:00:00Z");
function fixture(altitudes:readonly number[],step=5,latStep=.001):KmlPoint[]{
  return altitudes.map((alt,index)=>({
    lat:50+index*latStep,lon:14,alt,
    time:new Date(start+index*step*1000).toISOString(),
  }));
}
const valley=[360,350,340,330,320,310,300,290,280,270,260,250,245,248,253,261,273,287,305,320,340,360,380];
// Historically evidenced +30m on index +11; +10 is still 0.3m short.
const knownPlusEleven=[400,380,360,340,320,300,280,260,245,235,228,224,
 228,232,237,240,244,247,250,252,253,253.7,271,300,330];

test("D1 mirror is pinned to the exact production track-processing Git blob",async()=>{
  const bytes=await readFile(new URL("../lib/track-processing.ts",import.meta.url));
  const blob=createHash("sha1").update(Buffer.concat([
    Buffer.from("blob "+bytes.length+"\0"),bytes,
  ])).digest("hex");
  assert.equal(blob,D1_LEGACY_SOURCE_BLOB,
    "Legacy detector changed; review/reconcile the mirrored D1 predicates before trusting results.");
});

test("D1 contains no guessed contact and preserves actual production event counts",()=>{
  const points=fixture(valley),before=touchAndGoEvents(points),snapshot=JSON.stringify(points);
  const report=summarizeLegacyAltitudeDiagnostics(points);
  assert.equal(report.status,"DIAGNOSTIC_ONLY");
  assert.equal(report.sourceLineage,"NOT_ATTESTED");
  assert.equal(report.physicalContact,"UNRESOLVED");
  assert.equal(report.legacyTgCount,before.length);
  assert.equal(report.legacyAltitudeTgCount,before.filter(x=>x.signal==="altitude").length);
  assert.equal(report.legacySpeedTgCount,before.filter(x=>x.signal==="speed").length);
  assert.equal(JSON.stringify(points),snapshot,"diagnostics must not mutate input");
  assert.ok(report.inspectedAltitudeMinima>=1);
  assert.equal(diagnoseLegacyAltitudeAtIndex(points,12).outcome,"ALTITUDE_SHAPE_ADMISSIBLE");
});

test("D1 reports the real-derived +11-point missed-climb mechanism without adding event",()=>{
  const points=fixture(knownPlusEleven);
  assert.equal(diagnoseLegacyAltitudeAtIndex(points,11).outcome,"CLIMB_30M_NOT_FOUND");
  const report=summarizeLegacyAltitudeDiagnostics(points);
  assert.equal(report.legacyTgCount,touchAndGoEvents(points).length);
  assert.ok((report.outcomes.CLIMB_30M_NOT_FOUND??0)>0);
  assert.equal(report.physicalContact,"UNRESOLVED");
});

test("a 200 km/h low pass shape is speed-rejected, not made into a touchdown",()=>{
  const points=fixture(valley,5,.0025);
  assert.equal(diagnoseLegacyAltitudeAtIndex(points,12).outcome,"SPEED_OUTSIDE_LEGACY_RANGE");
  assert.equal(touchAndGoEvents(points).length,0);
});

test("gross source-height jump in the actual climb evidence rejects the shape",()=>{
  const points=fixture(valley);
  points[15]={...points[15],alt:400};
  assert.equal(diagnoseLegacyAltitudeAtIndex(points,12).outcome,"DISCONTINUITY_IN_EVIDENCE_SPAN");
  assert.equal(summarizeLegacyAltitudeDiagnostics(points).physicalContact,"UNRESOLVED");
});

test("nonpositive timestamp edges stay explicitly observed, not proof of stopping",()=>{
  const points=fixture(valley);
  points[14]={...points[14],time:points[13].time};
  const probe=diagnoseLegacyAltitudeAtIndex(points,12);
  assert.equal(probe.invalidTimeEdgeInWindow,true);
  assert.equal(probe.physicalContact,"UNRESOLVED");
});

test("unobserved >15 second source interval does not become wheel-contact evidence",()=>{
  const points=fixture(valley).map((p,i)=>i>=14?{
    ...p,time:new Date(start+i*5000+23000).toISOString(),
  }:p);
  assert.equal(diagnoseLegacyAltitudeAtIndex(points,12).unobservedOver15sInWindow,true);
  assert.equal(summarizeLegacyAltitudeDiagnostics(points).sourceLineage,"NOT_ATTESTED");
});

test("empty and truncated tracks produce only unavailable aggregate evidence",()=>{
  for(const points of [[],fixture([300,290,280,270,260])]){
    const report=summarizeLegacyAltitudeDiagnostics(points);
    assert.equal(report.legacyTgCount,0);
    assert.equal(report.inspectedAltitudeMinima,0);
    assert.equal(report.physicalContact,"UNRESOLVED");
  }
});

test("aggregate results never serialize raw fixes, timestamps, coordinates or filenames",()=>{
  const points=fixture(valley),output=JSON.stringify(summarizeLegacyAltitudeDiagnostics(points));
  assert.doesNotMatch(output,/2026-10-20|latitude|longitude|\blat\b|\blon\b|\.kml|\.gpx|\.csv|browser-auth/);
  assert.ok(!output.includes(points[0].time!));
  assert.ok(!output.includes(String(points[0].lat)));
});

test("diagnostic status never substitutes for deduplicated production altitude events",()=>{
  const points=fixture(valley),report=summarizeLegacyAltitudeDiagnostics(points);
  assert.equal(report.legacyTgCount,touchAndGoEvents(points).length);
  assert.ok((report.outcomes.ALTITUDE_SHAPE_ADMISSIBLE??0)>=report.legacyAltitudeTgCount);
});
