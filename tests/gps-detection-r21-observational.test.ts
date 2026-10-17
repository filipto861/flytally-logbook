import test from "node:test";
import assert from "node:assert/strict";
import {aggregatePreauthorizedTracks,OBSERVATIONAL_LIMITS} from "../research/gps-detection-r21/observational-aggregate.ts";
import type {KmlPoint} from "../lib/track-processing.ts";

const start=Date.parse("2026-10-17T10:00:00Z");
const track=(altitudes:readonly (number|null)[],speedKmh=95):KmlPoint[]=>altitudes.map((alt,i)=>({
  lat:48+speedKmh*(5*i)/3600/111.2,
  lon:10,alt,time:new Date(start+i*5000).toISOString(),
}));
const circuit=():KmlPoint[]=>{
  const a=[230,260,300,350,400,430];
  for(let i=0;i<5;i++)a.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  a.push(390,350,310,270,240,230);
  return track(a);
};
const missed=():KmlPoint[]=>track([400,380,360,340,320,300,280,260,245,235,228,224,228,232,237,240,244,247,250,252,253,253.7,271,300,330],100);
const stationary=():KmlPoint[]=>Array.from({length:16},(_,i)=>({lat:48,lon:10,alt:0,time:new Date(start+i*5000).toISOString()}));
const sample=():KmlPoint[][]=>[circuit(),missed(),stationary(),[],track([200,210,220,230,240])];

test("R2.1b below minimum cohort is suppressed, including singleton with known route",()=>{
  assert.deepEqual(aggregatePreauthorizedTracks([circuit()]),{status:"UNAVAILABLE",reason:"COHORT_TOO_SMALL"});
  assert.deepEqual(aggregatePreauthorizedTracks([]),{status:"UNAVAILABLE",reason:"COHORT_TOO_SMALL"});
});

test("R2.1b rejects oversized cohorts without computing partial results",()=>{
  const tracks=Array.from({length:OBSERVATIONAL_LIMITS.maximumCohortTracks+1},()=>[] as KmlPoint[]);
  assert.deepEqual(aggregatePreauthorizedTracks(tracks),{status:"UNAVAILABLE",reason:"COHORT_TOO_LARGE"});
});

test("R2.1b rejects overlong single track without leaking track identity",()=>{
  const huge=Array.from({length:OBSERVATIONAL_LIMITS.maximumPointsPerTrack+1},(_,i)=>({lat:48,lon:10,alt:0,time:new Date(start+i*5000).toISOString()}));
  const result=aggregatePreauthorizedTracks([huge,[],[],[],[]]);
  assert.deepEqual(result,{status:"UNAVAILABLE",reason:"TRACK_TOO_LARGE"});
});

test("R2.1b rejects malformed point shape instead of imputing missing altitude",()=>{
  const malformed=[...sample()] as unknown[][];
  malformed[1]=[{lat:48,lon:10,alt:undefined,time:null}];
  assert.deepEqual(aggregatePreauthorizedTracks(malformed as KmlPoint[][]),{status:"UNAVAILABLE",reason:"INVALID_INPUT"});
});

test("R2.1b report is aggregate-only and never contains coordinates, timestamps or flight metadata",()=>{
  const report=aggregatePreauthorizedTracks(sample());
  assert.equal(report.status,"AVAILABLE");
  if(report.status!=="AVAILABLE")return;
  assert.equal(report.tracks,5);
  assert.equal(report.physicalContactTruth,"UNAVAILABLE");
  assert.equal(report.independentEventLabels,false);
  assert.equal(report.comparisonBasis,"POST_NORMALIZATION_ONLY");
  assert.equal(report.preprocessingConfound,"NOT_ISOLATED");
  assert.equal(report.countType,"UNCONFIRMED_MOTION_PATTERNS_ONLY");
  assert.equal(report.tracksWithValidIslands+report.tracksWithNoValidIslands,report.tracks);
  const x=report.comparison;
  assert.equal(x.bothHaveTgPattern+x.legacyOnlyTgPattern+x.researchOnlyTgPattern+x.neitherHasTgPattern,report.tracks);
  assert.ok(x.researchOnlyTgPattern>=1,"historically missed motion shape should show a fixture-only disagreement");
  assert.ok(report.unavailablePatternCountTracks>=1,"empty track must be unavailable");
  const serialized=JSON.stringify(report);
  assert.ok(!/\b(?:lat|lon|latitude|longitude|registration|userId|flightId|fileName|route|events)\b/.test(serialized));
  assert.ok(!serialized.includes("2026-10-17T"));
  assert.ok(!serialized.includes("48."));
});

test("R2.1b nonmonotonic timestamp is a reason-coded unavailable edge, not 0 km/h",()=>{
  const t=track([200,205,210,215,220,230]);
  t[3].time=t[2].time;
  const inputs=[t,stationary(),stationary(),stationary(),stationary()];
  const result=aggregatePreauthorizedTracks(inputs);
  assert.equal(result.status,"AVAILABLE");
  if(result.status==="AVAILABLE")assert.ok(result.invalidEdges.NON_MONOTONIC_TIME>=1);
});

test("R2.1b invalid coordinates are counted as data-quality failures not coerced positions",()=>{
  const t=track([200,210,220,230,240]);
  t[2].lat=91;
  const result=aggregatePreauthorizedTracks([t,stationary(),stationary(),stationary(),stationary()]);
  assert.equal(result.status,"AVAILABLE");
  if(result.status==="AVAILABLE")assert.ok(result.invalidEdges.BAD_COORDINATES>=2);
});

test("R2.1b empty tracks and null/zero altitude cannot become a whole-flight landing total",()=>{
  const data=[[],track([0,null,0,0,0]),stationary(),stationary(),stationary()];
  const output=aggregatePreauthorizedTracks(data);
  assert.equal(output.status,"AVAILABLE");
  if(output.status==="AVAILABLE"){
    assert.ok(!("wholeFlightLandings" in output));
    assert.ok(!("certifiedMovements" in output));
    assert.equal(output.physicalContactTruth,"UNAVAILABLE");
  }
});
