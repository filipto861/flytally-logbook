import test from "node:test";
import assert from "node:assert/strict";
import {aggregatePreauthorizedTracks,OBSERVATIONAL_LIMITS} from "../research/gps-detection-r21/observational-aggregate.ts";
import {analyzeResearchTrack} from "../research/gps-detection-r21/detector.ts";
import type {KmlPoint} from "../lib/track-processing.ts";

// All tracks below are synthetic motion/quality fixtures, NOT wheel-contact evidence.
const START=Date.parse("2026-10-17T10:00:00Z");
const point=(i:number,alt:number|null=200):KmlPoint=>({
  lat:48+(95*5*i/3600/111.2),lon:10,alt,
  time:new Date(START+i*5000).toISOString(),
});
const moving=(alts:readonly (number|null)[]):KmlPoint[]=>alts.map((alt,i)=>point(i,alt));
const stationary=():KmlPoint[]=>Array.from({length:12},(_,i)=>({
  lat:48,lon:10,alt:0,time:new Date(START+i*5000).toISOString(),
}));
const cohort=(first:KmlPoint[]):KmlPoint[][]=>[first,stationary(),stationary(),stationary(),stationary()];
const invalid={status:"UNAVAILABLE",reason:"INVALID_INPUT"};

test("D4-01 nonfinite numbers fail closed before any candidate or aggregate",()=>{
  const base=stationary();
  for(const [key,value] of [["lat",NaN],["lon",Infinity],["alt",-Infinity]] as const){
    const corrupted=base.map(p=>({...p}));
    corrupted[2]={...corrupted[2],[key]:value};
    assert.deepEqual(aggregatePreauthorizedTracks(cohort(corrupted)),invalid,key);
  }
});

test("D4-02 sparse, coercible or throwing inputs never become implicit observations",()=>{
  const sparse=Array<KmlPoint>(3);
  sparse[0]=point(0);sparse[2]=point(2);
  assert.deepEqual(aggregatePreauthorizedTracks(cohort(sparse)),invalid);
  const coercible=[{lat:"48",lon:10,alt:0,time:null}] as unknown as KmlPoint[];
  assert.deepEqual(aggregatePreauthorizedTracks(cohort(coercible)),invalid);
  const hostile={get lat():number{throw new Error("synthetic-private-detail");},lon:10,alt:0,time:null};
  assert.deepEqual(aggregatePreauthorizedTracks(cohort([hostile])),invalid);
});

test("D4-03 total point budget fails closed without partial diagnostic data",()=>{
  const repeated=point(0,0);
  const tracks=Array.from({length:6},()=>Array.from({length:16_667},()=>repeated));
  assert.equal(tracks.length,6);
  assert.ok(tracks.every(t=>t.length<=OBSERVATIONAL_LIMITS.maximumPointsPerTrack));
  assert.ok(tracks.reduce((sum,t)=>sum+t.length,0)>OBSERVATIONAL_LIMITS.maximumTotalPoints);
  assert.deepEqual(aggregatePreauthorizedTracks(tracks),{status:"UNAVAILABLE",reason:"TOTAL_POINTS_EXCEEDED"});
});

test("D4-04 malformed, nonmonotonic and gap timestamps are quality failures, not zero-speed contacts",()=>{
  const sample=moving([200,202,204,206,208,210,212,214,216]);
  sample[2].time="invalid";
  sample[4].time=sample[3].time;
  sample[7].time=new Date(Date.parse(sample[6].time!)+60_000).toISOString();
  sample[8].time=new Date(Date.parse(sample[7].time!)+5_000).toISOString();
  const analyzed=analyzeResearchTrack(sample.map((p,ordinal)=>({...p,ordinal})));
  for(const e of analyzed.edges.filter(e=>e.status==="UNAVAILABLE")){
    assert.equal(e.speedKmh,null);
    assert.equal(e.verticalRateMps,null);
  }
  assert.ok(analyzed.edges.some(e=>e.reason==="MISSING_TIME"));
  assert.ok(analyzed.edges.some(e=>e.reason==="NON_MONOTONIC_TIME"));
  assert.ok(analyzed.edges.some(e=>e.reason==="GAP"));
  const result=aggregatePreauthorizedTracks(cohort(sample));
  assert.equal(result.status,"AVAILABLE");
  if(result.status!=="AVAILABLE")return;
  assert.ok(result.invalidEdges.MISSING_TIME>=1);
  assert.ok(result.invalidEdges.NON_MONOTONIC_TIME>=1);
  assert.ok(result.invalidEdges.GAP>=1);
  assert.equal(result.physicalContactTruth,"UNAVAILABLE");
  assert.equal(Object.hasOwn(result,"wholeFlightLandings"),false);
});

test("D4-05 zero altitude remains distinct from missing altitude; no AGL/contact imputation",()=>{
  const sample=moving([0,null,0,0,0,0]);
  const original=sample.map(p=>p.alt);
  const analyzed=analyzeResearchTrack(sample.map((p,ordinal)=>({...p,ordinal})));
  assert.equal(sample[0].alt,0);
  assert.equal(sample[1].alt,null);
  assert.equal(analyzed.edges[0].verticalRateMps,null);
  const result=aggregatePreauthorizedTracks(cohort(sample));
  assert.equal(result.status,"AVAILABLE");
  assert.deepEqual(sample.map(p=>p.alt),original);
  if(result.status==="AVAILABLE"){
    assert.equal(result.physicalContactTruth,"UNAVAILABLE");
    assert.equal(result.preprocessingConfound,"NOT_ISOLATED");
    assert.equal(Object.hasOwn(result,"agl"),false);
  }
});

test("D4-06 candidate support never bridges a synthetic gap or certifies contact",()=>{
  const a=[230,260,300,350,400,430];
  for(let i=0;i<5;i++)a.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  a.push(390,350,310,270,240,230);
  const sample=moving(a);
  for(let i=40;i<sample.length;i++){
    sample[i].time=new Date(Date.parse(sample[i].time!)+120_000).toISOString();
  }
  const result=analyzeResearchTrack(sample.map((p,ordinal)=>({...p,ordinal})));
  assert.ok(result.edges.some(e=>e.reason==="GAP"));
  assert.ok(result.islands.length>=2);
  for(const c of result.candidates){
    assert.equal(c.physicalContactStatus,"UNRESOLVED");
    assert.ok(result.islands.some(i=>c.support.start>=i.start&&c.support.end<=i.end));
    if(c.gapAdjacent)assert.equal(c.time,null);
  }
});

test("D4-07 empty but shaped cohort is diagnostic-only, never a landing claim",()=>{
  const result=aggregatePreauthorizedTracks([[],[],[],[],[]]);
  assert.equal(result.status,"AVAILABLE");
  if(result.status!=="AVAILABLE")return;
  assert.equal(result.tracksWithValidIslands,0);
  assert.equal(result.tracksWithNoValidIslands,5);
  assert.equal(result.unavailablePatternCountTracks,5);
  assert.equal(result.physicalContactTruth,"UNAVAILABLE");
  assert.equal(result.independentEventLabels,false);
  assert.equal(result.countType,"UNCONFIRMED_MOTION_PATTERNS_ONLY");
  assert.equal(Object.hasOwn(result,"wholeFlightLandings"),false);
});

test("D4-08 finite but out-of-range coordinates retain existing reason-coded quality behavior",()=>{
  const sample=stationary();
  sample[3].lat=91;
  const result=aggregatePreauthorizedTracks(cohort(sample));
  assert.equal(result.status,"AVAILABLE");
  if(result.status==="AVAILABLE"){
    assert.ok(result.invalidEdges.BAD_COORDINATES>=2);
    assert.equal(result.physicalContactTruth,"UNAVAILABLE");
  }
});
