import test from "node:test";
import assert from "node:assert/strict";
import {touchAndGoEvents,type KmlPoint} from "../lib/track-processing.ts";
import {diagnoseLegacyAdmission} from "../research/gps-detector-accuracy/d1-legacy-admission-diagnostics.ts";

const start=Date.parse("2026-10-20T09:00:00Z");
function constantSpeedTrack(altitudes:readonly number[],speedKmh=95,step=5):KmlPoint[]{
  const stepLat=(speedKmh*step/3600)/111.2;
  return altitudes.map((alt,index)=>({
    lat:50+index*stepLat,lon:14,alt,
    time:new Date(start+index*step*1000).toISOString(),
  }));
}
function fiveAltTg(){
  const values=[230,260,300,350,400,430];
  for(let i=0;i<5;i++){
    values.push(390,350,310,270,240,230);
    values.push(235,242,255,275,310,360,410,430);
  }
  values.push(390,350,310,270,240,230);
  return constantSpeedTrack(values);
}
function stopAndGo():KmlPoint[]{
  const points:KmlPoint[]=[{lat:50,lon:14,alt:250,time:new Date(start).toISOString()}];
  let lat=50,t=0;
  for(const speed of [...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[]){
    t+=5;lat+=(speed*5/3600)/111.2;
    points.push({lat,lon:14,alt:250,time:new Date(start+t*1000).toISOString()});
  }
  return points;
}
const plusEleven=[400,380,360,340,320,300,280,260,245,235,228,224,
  228,232,237,240,244,247,250,252,253,253.7,271,300,330];

test("D1-B five rolling T&G positive control matches exact frozen production events",()=>{
  const points=fiveAltTg(),snapshot=JSON.stringify(points);
  const report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,5);
  assert.equal(report.legacyAltitudeEvents,5);
  assert.equal(report.legacySpeedEvents,0);
  assert.equal(report.recomputedLegacyCount,touchAndGoEvents(points).length);
  assert.ok((report.rawAltitudeAdmissiblePoints??0)>=(report.altitudeGroupedEvents??0));
  assert.equal(JSON.stringify(points),snapshot);
});

test("D1-B real-derived +11 evidence stays missed and never auto-recovers contact",()=>{
  const points=constantSpeedTrack(plusEleven,100);
  const report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,0);
  assert.equal(report.physicalContact,"UNRESOLVED");
});

test("D1-B genuine flat-altitude stop-and-go preserves speed branch",()=>{
  const points=stopAndGo(),report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,1);
  assert.equal(report.legacySpeedEvents,1);
  assert.equal(report.speedAdmitted,1);
  assert.equal(report.legacyAltitudeEvents,0);
});

test("D1-B high-speed low pass is not promoted to a T&G",()=>{
  const vals=[350,330,300,270,240,235,240,270,300,330,350,390,420];
  const points=constantSpeedTrack(vals,210);
  const report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,0);
});

test("D1-B duplicate timestamp and long unobserved period preserve exact output parity",()=>{
  const points=fiveAltTg();
  points[15]={...points[15],time:points[14].time};
  for(let i=45;i<points.length;i++){
    points[i]={...points[i],time:new Date(Date.parse(points[i].time!)+21000).toISOString()};
  }
  const report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,touchAndGoEvents(points).length);
  assert.equal(report.physicalContact,"UNRESOLVED");
});

test("D1-B source-insufficient and large tracks fail closed, not zero landings",()=>{
  const empty=diagnoseLegacyAdmission([]);
  assert.equal(empty.status,"UNAVAILABLE");
  assert.equal(empty.reason,"INSUFFICIENT_SOURCE");
  assert.equal(empty.legacyEventCount,undefined);
  const tooLarge=diagnoseLegacyAdmission(constantSpeedTrack(Array(2049).fill(300)));
  assert.equal(tooLarge.status,"UNAVAILABLE");
  assert.equal(tooLarge.reason,"SOURCE_TOO_LARGE_FOR_D1_MIRROR");
  assert.equal(tooLarge.legacyEventCount,undefined);
});

test("D1-B report contains no source identity, coordinate, event index or UTC",()=>{
  const points=fiveAltTg(),report=diagnoseLegacyAdmission(points);
  const serial=JSON.stringify(report);
  assert.equal(report.sourceLineage,"NOT_ATTESTED");
  assert.equal(report.physicalContact,"UNRESOLVED");
  assert.doesNotMatch(serial,/2026-10-20|time|index|latitude|longitude|\blat\b|\blon\b|\.kml|\.gpx|\.csv|browser-auth/);
  assert.ok(!serial.includes(points[0].time!));
});

test("D1-B grouping counts never masquerade as contact or movement count",()=>{
  const points=fiveAltTg(),report=diagnoseLegacyAdmission(points);
  assert.equal(report.status,"PARITY_MATCHED");
  assert.equal(report.legacyEventCount,report.recomputedLegacyCount);
  assert.equal(report.rawAltitudeAdmissiblePoints,
    (report.altitudeGroupingSuppressedPoints??0)+(report.altitudeGroupedEvents??0));
  assert.equal(report.altitudeGroupedEvents,
    (report.legacyAltitudeEvents??0)+(report.altitudeSuppressedBySpeedOverlap??0));
});
