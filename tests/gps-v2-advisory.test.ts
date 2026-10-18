import test from "node:test";
import assert from "node:assert/strict";
import {parseTrackFile} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalCsv,GPS_V2_ALGORITHM_REVISION} from "../lib/gps-v2-advisory.ts";

const S=5,lat=50;
const longitudePerKmh=(kmh:number)=>kmh*S/3600/(111.1950802*Math.cos(lat*Math.PI/180));
function track(speeds:number[]){
  let lon=14;
  const iso=(second:number)=>new Date(Date.UTC(2026,9,18,10,0,0)+second*1000).toISOString().replace(".000Z","Z");
  const rows=[`${lat},${lon.toFixed(9)},,${iso(0)}`];
  speeds.forEach((speed,i)=>{lon+=longitudePerKmh(speed);rows.push(`${lat},${lon.toFixed(9)},,${iso((i+1)*S)}`)});
  return ["lat,lon,altitudeM,time",...rows].join("\n");
}
const pattern=[5,5,60,60,60,5,5,5,60,60,60,5,5];
function inspect(sourceText:string,splitCuts:number[]=[],fileName="review.csv"){
  return inspectGpsV2HorizontalCsv({
    sourceText,fileName,canonicalPoints:parseTrackFile(sourceText,fileName),splitCuts
  });
}
const invariant=(r:ReturnType<typeof inspect>)=>{
  assert.equal(r.canAffectCanonicalFlight,false);
  assert.equal(r.wholeFlightLandings,"UNAVAILABLE");
  assert.equal(r.physicalContact,"UNRESOLVED");
  assert.equal(r.altitudeMode,"UNKNOWN");
  assert.equal(r.sourceAccuracy,"UNKNOWN");
  assert.equal(r.algorithmRevision,GPS_V2_ALGORITHM_REVISION);
  for(const event of r.events){
    assert.equal(event.basis,"OBSERVED_HORIZONTAL_MOTION_ONLY");
    assert.equal(event.physicalContact,"UNRESOLVED");
    assert.equal(event.utc.endsWith("Z"),true);
  }
};

test("V2-01 exact indexed horizontal stop-go is an unresolved pilot review point",()=>{
  const r=inspect(track(pattern));
  invariant(r);
  assert.equal(r.status,"ADVISORY_ONLY");
  assert.equal(r.reason,null);
  assert.ok(r.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
  assert.ok(r.events.every(e=>Number.isInteger(e.normalizedIndex)));
});

test("V2-02 fast low pass without a genuine slow duration never creates stop-go",()=>{
  const r=inspect(track([60,60,60,45,40,40,50,60,60,60]));
  invariant(r);
  assert.equal(r.status,"ADVISORY_ONLY");
  assert.equal(r.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
});

test("V2-03 missing/duplicate timestamp returns unavailable, not zero review events",()=>{
  const source=track(pattern);
  const lines=source.split("\n");
  lines[5]=lines[5].replace(/2026-10-18T10:00:20Z/,"2026-10-18T10:00:15Z");
  const r=inspect(lines.join("\n"));
  invariant(r);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"SOURCE_UNAVAILABLE");
});

test("V2-04 arbitrary source text or claimed GPX uses unavailable legacy fallback",()=>{
  const r=inspect(track(pattern),[],"flight.gpx");
  invariant(r);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"UNSUPPORTED_SOURCE");
  assert.deepEqual(r.events,[]);
});

test("V2-05 supplied canonical arrays cannot impersonate source-index lineage",()=>{
  const sourceText=track(pattern),points=parseTrackFile(sourceText,"review.csv");
  points[5]={...points[5],alt:0};
  const r=inspectGpsV2HorizontalCsv({sourceText,fileName:"review.csv",canonicalPoints:points,splitCuts:[]});
  invariant(r);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"CANONICAL_SOURCE_MISMATCH");
});

test("V2-06 split breaks a horizontal stop-go pattern and reindexes per part",()=>{
  const src=track(pattern),unsegmented=inspect(src),split=inspect(src,[6]);
  invariant(unsegmented);invariant(split);
  assert.ok(unsegmented.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
  assert.equal(split.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
  assert.equal(split.events.every(e=>e.splitIndex===0||e.splitIndex===1),true);
});

test("V2-07 malformed unsorted or out-of-range split indices fail closed",()=>{
  const src=track(pattern);
  for(const splitCuts of [[0],[99],[4,4],[8,6],[6.5]]){
    const r=inspect(src,splitCuts);
    invariant(r);
    assert.equal(r.status,"UNAVAILABLE");
    assert.equal(r.reason,"INVALID_SPLIT");
    assert.deepEqual(r.events,[]);
  }
});

test("V2-08 actual measured zero and missing altitude do not enable vertical evidence",()=>{
  const src=track(pattern).replace("50,14.000000000,,","50,14.000000000,0,");
  const r=inspect(src);
  invariant(r);
  assert.equal(r.status,"ADVISORY_ONLY");
  assert.equal(r.events.every(e=>e.basis==="OBSERVED_HORIZONTAL_MOTION_ONLY"),true);
});

test("V2-09 malformed coordinate or unsupported CSV dialect fails closed",()=>{
  for(const src of [
    track(pattern).replace("50,14.000000000,","0x10,14.000000000,"),
    track(pattern).replace("lat,lon,altitudeM,time","latitude,longitude,alt,time")
  ]){
    const r=inspect(src);
    invariant(r);
    assert.equal(r.status,"UNAVAILABLE");
    assert.deepEqual(r.events,[]);
  }
});

test("V2-10 source sort never fabricates raw identity or physical contact",()=>{
  const src=track(pattern),lines=src.split("\n");
  [lines[3],lines[4]]=[lines[4],lines[3]];
  const r=inspect(lines.join("\n"));
  invariant(r);
  assert.equal(r.status,"ADVISORY_ONLY");
  assert.equal(r.sourceParserRevision,"R21_D2B2_CSV_SUBSET_V1");
});
