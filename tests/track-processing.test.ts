import test from "node:test";
import assert from "node:assert/strict";
import { airportCandidateScore,flightEnvelope,hasAirborneMovement,inspectTrackFile,landingCount,parseKml,parseTrackFile,splitPoints,suggestedSplitDetails,suggestedSplits,touchAndGoEvents,trackEndpointCandidates,trackQuality,type KmlPoint } from "../lib/track-processing.ts";

const point=(time:string,lat=50,lon=14):KmlPoint=>({lat,lon,alt:300,time});

test("all gx:Track blocks are parsed",()=>{
  const kml=`<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-08-21T08:00:00Z</when><when>2026-08-21T08:01:00Z</when><gx:coord>14 50 300</gx:coord><gx:coord>14.01 50.01 320</gx:coord></gx:Track><gx:Track><when>2026-08-21T10:00:00Z</when><when>2026-08-21T10:01:00Z</when><gx:coord>14.02 50.02 300</gx:coord><gx:coord>14.03 50.03 330</gx:coord></gx:Track></kml>`;
  const points=parseKml(kml);
  assert.equal(points.length,4);
  assert.equal(points[3].time,"2026-08-21T10:01:00Z");
});

test("quoted CSV and separate UTC date/time columns are parsed",()=>{
  const csv='Latitude,Longitude,Altitude ft,UTC Date,UTC Time,Note\n50.0000,14.0000,1000,2026-08-25,08:00:00Z,"start, apron"\n50.0100,14.0100,1200,2026-08-25,08:01:00Z,"airborne"';
  const points=parseTrackFile(csv,"SkyDemon_track.csv");
  assert.equal(points.length,2);
  assert.equal(points[0].time,"2026-08-25T08:00:00Z");
  assert.ok(Math.abs((points[0].alt||0)-304.8)<.01);
  const inspection=inspectTrackFile(csv,"SkyDemon_track.csv");
  assert.equal(inspection.format,"csv");
  assert.equal(inspection.source,"skydemon");
});

test("a long pause near the same airport proposes a split",()=>{
  const points=[point("2026-08-21T08:00:00Z"),point("2026-08-21T08:01:00Z",50.01,14.01),point("2026-08-21T08:02:00Z",50.02,14.02),point("2026-08-21T10:00:00Z",50.0201,14.0201),point("2026-08-21T10:01:00Z",50.03,14.03),point("2026-08-21T10:02:00Z",50.04,14.04)];
  const cuts=suggestedSplits(points);
  assert.deepEqual(cuts,[2]);
  assert.deepEqual(splitPoints(points,cuts).map(part=>part.length),[3,3]);
  assert.match(suggestedSplitDetails(points)[0].reason,/118 minute gap/);
});

test("an airborne coverage gap does not split a flight",()=>{
  const points=[point("2026-08-21T08:00:00Z"),point("2026-08-21T08:01:00Z",50.1,14.1),point("2026-08-21T08:31:00Z",51.1,15.1),point("2026-08-21T08:32:00Z",51.2,15.2)];
  assert.deepEqual(suggestedSplits(points),[]);
});

test("a moderate coverage gap with nearby but moving endpoints remains one flight",()=>{
  const points=[point("2026-08-21T08:00:00Z",50,14),point("2026-08-21T08:01:00Z",50.02,14.02),point("2026-08-21T08:26:00Z",50.07,14.07),point("2026-08-21T08:27:00Z",50.09,14.09)];
  assert.deepEqual(suggestedSplits(points),[]);
});

test("one ground stop cannot create a third stationary flight",()=>{
  const at=(seconds:number,lat:number):KmlPoint=>({lat,lon:14,alt:300,time:new Date(Date.parse("2026-08-21T08:00:00Z")+seconds*1000).toISOString()});
  const points=[at(0,50),at(20,50.01),at(40,50.02),at(60,50.03),at(80,50.0301),at(1280,50.0301),at(1300,50.0301),at(1320,50.0301),at(1340,50.04),at(1360,50.05),at(1380,50.06)];
  const cuts=suggestedSplits(points),parts=splitPoints(points,cuts);
  assert.equal(cuts.length,1);
  assert.equal(parts.length,2);
  assert.ok(parts.every(part=>part.length>=4));
  assert.ok(parts.every(hasAirborneMovement));
});

test("ground-only movement can never be confirmed as a flight",()=>{
  const ground=[point("2026-08-21T08:00:00Z",50,14),point("2026-08-21T08:00:30Z",50.00002,14),point("2026-08-21T08:01:00Z",50.00003,14),point("2026-08-21T08:01:30Z",50.00004,14)];
  assert.equal(hasAirborneMovement(ground),false);
  assert.equal(trackQuality(ground).status,"poor");
});

test("a short but credible airborne segment remains a flight",()=>{
  const flight=[point("2026-08-21T08:00:00Z",50,14),point("2026-08-21T08:00:30Z",50.01,14.01),point("2026-08-21T08:01:00Z",50.02,14.02),point("2026-08-21T08:01:30Z",50.03,14.03)];
  assert.equal(hasAirborneMovement(flight),true);
});

test("track quality surfaces implausible position jumps",()=>{
  const points=[point("2026-08-21T08:00:00Z",50,14),point("2026-08-21T08:00:10Z",51,15),point("2026-08-21T08:01:00Z",51.01,15.01),point("2026-08-21T08:02:00Z",51.02,15.02)];
  const quality=trackQuality(points);
  assert.equal(quality.status,"review");
  assert.ok(quality.implausibleJumps>=1);
  assert.match(quality.warnings.join(" "),/implausible position/);
});

test("SkyDemon near-instant teleport stays a warning without delaying later credible take-off evidence",()=>{
  const rows=[
    ["2026-10-03T14:23:14.706Z",50.31796,14.262853,237.69078],
    ["2026-10-03T14:23:35.221Z",50.31796,14.262853,236.25081],
    ["2026-10-03T14:23:35.222Z",50.31796,14.262853,236.25081],
    ["2026-10-03T14:23:35.223Z",50.33195,14.250404,289.72714],
    ["2026-10-03T14:23:39.179Z",50.33322,14.249202,303.48788],
    ["2026-10-03T14:23:40.162Z",50.33322,14.249202,308.66898],
    ["2026-10-03T14:23:42.187Z",50.334274,14.248592,323.775],
    ["2026-10-03T14:23:43.162Z",50.334274,14.248592,323.775],
    ["2026-10-03T14:23:45.164Z",50.335014,14.248411,332.61212],
    ["2026-10-03T14:23:47.165Z",50.335754,14.248477,342.73056],
    ["2026-10-03T14:23:49.161Z",50.33647,14.248766,352.29407],
    ["2026-10-03T14:23:51.163Z",50.33714,14.249294,360.71793],
    ["2026-10-03T14:23:53.165Z",50.337727,14.2500105,369.055],
    ["2026-10-03T14:24:00.163Z",50.33961,14.253916,390.3822],
    ["2026-10-03T14:24:03.163Z",50.340054,14.25497,398.1865],
    ["2026-10-03T14:24:08.163Z",50.341328,14.258233,422.01672],
  ] as const;
  const points:KmlPoint[]=rows.map(([time,lat,lon,alt])=>({time,lat,lon,alt}));
  const envelope=flightEnvelope(points),quality=trackQuality(points);
  assert.equal(points[envelope.takeoffIndex].time,"2026-10-03T14:23:39.179Z");
  assert.ok(quality.implausibleJumps>=1);
  assert.match(quality.warnings.join(" "),/implausible position/);
});

test("airport ranking prefers the actual arrival edge over an earlier exact match",()=>{
  const arrival={lat:50.5,lon:15},departure={lat:50,lon:14},candidates=[arrival,{lat:50.35,lon:14.7},departure];
  assert.ok(airportCandidateScore(candidates,arrival).score<airportCandidateScore(candidates,departure).score);
});

test("arrival candidates are ordered from the end and do not span a long route",()=>{
  const points=[point("2026-08-21T08:00:00Z",50,14),point("2026-08-21T08:05:00Z",50.1,14),point("2026-08-21T08:10:00Z",50.2,14),point("2026-08-21T08:15:00Z",50.3,14),point("2026-08-21T08:20:00Z",50.4,14)];
  const candidates=trackEndpointCandidates(points,true);
  assert.equal(candidates[0],points.at(-1));
  assert.ok(!candidates.includes(points[0]));
});

function circuitTrack(minimumSpeedKmh=75){
  const start=Date.parse("2026-08-25T08:00:00Z"),points:KmlPoint[]=[];
  const altitudes:number[]=[];
  for(const [from,to,count] of [[250,500,30],[500,250,30],[250,500,30],[500,250,30]] as const)for(let index=0;index<count;index++)altitudes.push(from+(to-from)*index/(count-1));
  const stepKm=minimumSpeedKmh*5/3600,latitudeStep=stepKm/111.2;
  altitudes.forEach((alt,index)=>points.push({lat:50+latitudeStep*index,lon:14,alt,time:new Date(start+index*5000).toISOString()}));
  return points;
}


function irregularRollingTouchAndGo(extraSamplesAfterEvidence=false,corruptionInsideEvidence=false){
  const start=Date.parse("2026-09-23T16:09:42Z");
  let seconds=corruptionInsideEvidence
    ?[-43,-41,-39,-37,-31,-24,-23,-17,-11,0,15,15.001,17,33,40,44,46,48,50,52,54]
    :[-43,-41,-39,-37,-31,-24,-23,-17,-11,0,15,17,33,40,44,46,48,50,50.001,52,54];
  let altitudes=corruptionInsideEvidence
    ?[410,405,395,385,378,346,322,315,284,233,236,241,237,282,314,325,331,336,343,353,361]
    :[410,405,395,385,378,346,322,315,284,233,236,237,282,314,325,331,336,343,348,353,361];

  // Same physical T&G and distant timestamp artifact, but add harmless climb
  // samples so the artifact moves beyond the legacy candidate+10 index window.
  if(extraSamplesAfterEvidence&&!corruptionInsideEvidence){
    seconds=[...seconds.slice(0,14),41,42,43,...seconds.slice(14)];
    altitudes=[...altitudes.slice(0,14),317,320,323,...altitudes.slice(14)];
  }

  const points:KmlPoint[]=[];
  let latitude=50,lastSeconds:number|null=null;
  seconds.forEach((offset,index)=>{
    if(lastSeconds!==null)latitude+=(100*(offset-lastSeconds)/3600)/111.2;
    points.push({lat:latitude,lon:14,alt:altitudes[index],time:new Date(start+offset*1000).toISOString()});
    lastSeconds=offset;
  });
  return points;
}

test("a distant near-zero-timestamp altitude pair cannot invalidate the physical T&G evidence span",()=>{
  const sparse=irregularRollingTouchAndGo(false,false),dense=irregularRollingTouchAndGo(true,false);

  // These fixtures describe the same touchdown geometry. The only material
  // difference is point density after the +30 m climb evidence has completed.
  assert.equal(touchAndGoEvents(dense).length,1);
  assert.equal(landingCount(dense),2);

  assert.equal(touchAndGoEvents(sparse).length,1);
  assert.equal(landingCount(sparse),2);
});

test("near-zero timestamp corruption inside the qualifying T&G evidence span remains fail-closed",()=>{
  const points=irregularRollingTouchAndGo(false,true);
  assert.deepEqual(touchAndGoEvents(points),[]);
  assert.equal(landingCount(points),1);
});

test("a rolling touch-and-go is counted without splitting the flight",()=>{
  const points=circuitTrack();
  assert.deepEqual(suggestedSplits(points),[]);
  assert.equal(landingCount(points),2);
  const events=touchAndGoEvents(points);
  assert.equal(events.length,1);
  assert.equal(events[0].signal,"altitude");
  assert.match(events[0].time||"",/^2026-08-25T08:04:/);
});

test("a fast low pass is not misclassified as a touch-and-go",()=>{
  assert.equal(landingCount(circuitTrack(170)),1);
  assert.deepEqual(touchAndGoEvents(circuitTrack(170)),[]);
});

test("touch-and-go detection is recalculated independently after a manual split",()=>{
  const points=circuitTrack(),parts=splitPoints(points,[59]);
  assert.equal(parts.length,2);
  assert.deepEqual(parts.map(part=>touchAndGoEvents(part).length),[0,0]);
  assert.deepEqual(parts.map(landingCount),[1,1]);
});
