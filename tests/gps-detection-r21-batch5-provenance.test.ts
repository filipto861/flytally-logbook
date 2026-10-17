import test from "node:test";
import assert from "node:assert/strict";
import {analyzeResearchTrack,type EdgeReason,type ResearchAnalysis,type SourceObservation}
  from "../research/gps-detection-r21/detector.ts";
import {createFalsificationScorecard} from "../research/gps-detection-r21/falsification-scorecard.ts";

// Synthetic coordinates; this is a motion-pattern exercise, never wheel-contact truth.
const START=Date.parse("2026-10-17T10:00:00Z");
const stopGo=():SourceObservation[]=>{
  const speeds=[...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[];
  const points:SourceObservation[]=[{lat:48,lon:10,alt:250,time:new Date(START).toISOString(),ordinal:0}];
  let lat=48;
  for(const [i,speed] of speeds.entries()){
    lat+=speed*5/3600/111.2;
    points.push({lat,lon:10,alt:250,time:new Date(START+(i+1)*5000).toISOString(),ordinal:i+1});
  }
  return points;
};
const nearAfter=(analysis:ResearchAnalysis,reason:EdgeReason)=>
  analysis.candidates.filter(c=>c.type==="STOP_GO_PATTERN_CANDIDATE"&&
    c.invalidBoundaryEvidence.some(x=>x.side==="AFTER_ISLAND"&&x.edge.from===18&&
      x.edge.to===19&&x.reason===reason));

test("A13: uninterrupted synthetic speed dip has no fabricated invalid-edge provenance",()=>{
  const result=analyzeResearchTrack(stopGo());
  const candidates=result.candidates.filter(c=>c.type==="STOP_GO_PATTERN_CANDIDATE");
  assert.ok(candidates.length>0,"utility floor: speed-dip must remain detectable");
  for(const c of candidates){
    assert.deepEqual(c.invalidBoundaryEvidence,[]);
    assert.equal(c.gapAdjacent,false);
    assert.notEqual(c.time,null);
    assert.equal(c.physicalContactStatus,"UNRESOLVED");
  }
});

test("A13: actual GAP is labeled by exact edge, never assigned a precise event time",()=>{
  const xs=stopGo();
  for(let i=19;i<xs.length;i++)xs[i].time=new Date(Date.parse(xs[i].time!)+120000).toISOString();
  const result=analyzeResearchTrack(xs);
  assert.equal(result.edges[18].reason,"GAP");
  assert.ok(nearAfter(result,"GAP").length>0,"expected supported candidate near invalid edge");
  for(const c of nearAfter(result,"GAP")){
    assert.equal(c.time,null);
    assert.equal(c.gapAdjacent,true);
    assert.equal(c.physicalContactStatus,"UNRESOLVED");
    assert.ok(result.islands.some(island=>c.support.start>=island.start&&c.support.end<=island.end));
  }
});

test("A13: reasons are not flattened into a fictitious generic GPS time gap",()=>{
  const cases:{reason:EdgeReason;mutate:(points:SourceObservation[])=>void}[]=[
    {reason:"POSITION_JUMP",mutate:xs=>{xs[19].lat+=3;}},
    {reason:"ALTITUDE_DISCONTINUITY",mutate:xs=>{xs[19].alt=600;}},
    {reason:"NON_MONOTONIC_TIME",mutate:xs=>{xs[19].time=xs[18].time;}},
    {reason:"MISSING_TIME",mutate:xs=>{xs[19].time=null;}},
    {reason:"BAD_COORDINATES",mutate:xs=>{xs[19].lat=91;}},
  ];
  for(const {reason,mutate} of cases){
    const xs=stopGo();mutate(xs);
    const result=analyzeResearchTrack(xs);
    assert.equal(result.edges[18].reason,reason);
    const found=nearAfter(result,reason);
    assert.ok(found.length>0,`expected near-edge support for ${reason}`);
    for(const c of found){
      assert.equal(c.time,null);
      assert.equal(c.gapAdjacent,true);
      assert.ok(c.invalidBoundaryEvidence.every(x=>result.edges[x.edge.from]?.reason===x.reason));
      assert.equal(c.physicalContactStatus,"UNRESOLVED");
    }
  }
});

test("A13: falsification scorecard accepts source-matched edge reasons",()=>{
  const xs=stopGo();
  for(let i=19;i<xs.length;i++)xs[i].time=new Date(Date.parse(xs[i].time!)+120000).toISOString();
  const result=analyzeResearchTrack(xs);
  assert.ok(nearAfter(result,"GAP").length>0);
  const score=createFalsificationScorecard([{fixtureId:"A13",reference:{kind:"UNLABELED"},analysis:result}]);
  assert.equal(score.safety.pass,true);
  assert.equal(score.physicalContactAccuracy,"UNAVAILABLE");
  assert.equal(score.independentHoldout,false);
});

test("A13: scorecard rejects fabricated reason and contradictory precision flag",()=>{
  const xs=stopGo();
  for(let i=19;i<xs.length;i++)xs[i].time=new Date(Date.parse(xs[i].time!)+120000).toISOString();
  const result=analyzeResearchTrack(xs);
  const index=result.candidates.findIndex(c=>c.invalidBoundaryEvidence.some(e=>e.reason==="GAP"));
  assert.ok(index>=0);
  const original=result.candidates[index];
  const forged:ResearchAnalysis={...result,candidates:result.candidates.map((c,i)=>
    i===index?{...c,invalidBoundaryEvidence:original.invalidBoundaryEvidence.map(e=>({...e,reason:"BAD_COORDINATES" as EdgeReason})),gapAdjacent:false,time:xs[c.index].time}:c
  )};
  const score=createFalsificationScorecard([{fixtureId:"A13-FORGED",reference:{kind:"UNLABELED"},analysis:forged}]);
  assert.equal(score.safety.pass,false);
  assert.ok(score.safety.violations.some(x=>x.includes("UNSUPPORTED_INVALID_BOUNDARY_PROVENANCE")));
  assert.ok(score.safety.violations.some(x=>x.includes("INCONSISTENT_INVALID_BOUNDARY_FLAG")));
  assert.ok(score.safety.violations.some(x=>x.includes("PRECISE_TIME_NEAR_INVALID_BOUNDARY")));
});

test("A13: cropped motion without an invalid quality edge must not gain gap provenance",()=>{
  const xs=stopGo().slice(0,18);
  const result=analyzeResearchTrack(xs);
  assert.ok(result.edges.every(e=>e.status==="VALID"));
  assert.ok(result.candidates.every(c=>c.invalidBoundaryEvidence.length===0&&c.gapAdjacent===false));
  assert.ok(result.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});
