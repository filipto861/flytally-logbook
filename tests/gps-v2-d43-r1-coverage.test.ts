import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseKml} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack} from "../lib/gps-v2-advisory.ts";
import {
 inspectD43R1Coverage,d43R1LocalBinding,D43_R1_REVISION
} from "../research/gps-detection-r21/stage-d43-r1-coverage.ts";

type P={lat:number;lon:number;alt:number|null;time:string};
const utc=(s:number):string=>new Date(Date.UTC(2026,9,19,6,0,0)+s*1000)
 .toISOString().replace(".000Z","Z");
const pt=(s:number,alt:number|null=180):P=>({
 lat:50.123456789,lon:14.987654321+s*0.00001,alt,time:utc(s)
});
function kml(blocks:readonly (readonly P[])[]):string{
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  blocks.map(block=>'<gx:Track>'+
   block.map(p=>'<when>'+p.time+'</when>').join("")+
   block.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
    (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
   '</gx:Track>').join("")+'</kml>';
}
function accepted(sourceText:string,splitCuts:number[]=[]){
 const r=inspectD43R1Coverage({sourceText,splitCuts});
 if(r.status==="UNAVAILABLE")throw Error(r.reason);
 assert.equal(r.revision,D43_R1_REVISION);
 assert.equal(r.canAffectCanonicalFlight,false);
 assert.equal(r.physicalContact,"UNRESOLVED");
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(r.coverage.interpretation,
  "FIX_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN");
 assert.equal(r.coverage.unknownManeuvers,"UNAVAILABLE");
 assert.equal(r.coverage.candidateAnalysis,"NOT_PERFORMED");
 assert.equal(r.coverage.betweenFixPairsUnobserved,r.coverage.canonicalFixes-1);
 return r.coverage;
}
test("D43-R1-01 uniform 5s single gx track has observed fixes but no proven inter-fix motion",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10),pt(15),pt(20),pt(25)]]));
 assert.equal(c.sourceBlocks,1);
 assert.equal(c.rawFixes,6);
 assert.equal(c.canonicalFixes,6);
 assert.equal(c.adjacentFixPairs,5);
 assert.equal(c.v2UsableVelocityEdges,5);
 assert.equal(c.sourceCadenceMedianSeconds,5);
 assert.equal(c.sourceCadenceMaxSeconds,5);
 assert.deepEqual(c.issueEdges,[]);
 assert.ok(c.longestWithinBlockIntervals.every(x=>
  x.v2TimeEdge==="WITHIN_EXISTING_LIMIT"));
});
test("D43-R1-02 4.9-second inter-block join is a hard source break",()=>{
 const second={...pt(10),time:utc(9.9)};
 const c=accepted(kml([[pt(0),pt(5)],[second,pt(15),pt(20)]]));
 assert.equal(c.sourceBlocks,2);
 assert.equal(c.sourceBlockedEdges,1);
 const edge=c.issueEdges.find(x=>x.beforeFix===1);
 assert.ok(edge);
 assert.equal(edge.durationSeconds,4.9);
 assert.ok(edge.reasons.includes("SOURCE_BLOCK_BOUNDARY"));
 assert.equal(c.v2UsableVelocityEdges,3);
});
test("D43-R1-03 35.35s source interval remains visible and NOT a new hard threshold",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10),pt(45.35),pt(50.35)]]));
 assert.equal(c.sourceCadenceMedianSeconds,5);
 assert.equal(c.sourceCadenceMaxSeconds,35.35);
 assert.equal(c.independentlyInvalidTimeEdges,0);
 assert.ok(c.longestWithinBlockIntervals.some(x=>
  x.durationSeconds===35.35&&x.v2TimeEdge==="WITHIN_EXISTING_LIMIT"));
 assert.equal(c.issueEdges.length,0);
});
test("D43-R1-04 94.39s span invalidates V2 velocity edge, not physical contact inference",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10),pt(104.39),pt(109.39)]]));
 assert.equal(c.sourceCadenceMaxSeconds,94.39);
 assert.equal(c.independentlyInvalidTimeEdges,1);
 assert.ok(c.issueEdges.some(x=>x.beforeFix===2&&
  x.reasons.includes("V2_TIME_EDGE_INVALID")));
 assert.ok(c.longestWithinBlockIntervals.some(x=>
  x.durationSeconds===94.39&&x.v2TimeEdge==="EXCEEDS_EXISTING_LIMIT"));
});
test("D43-R1-05 491.57s same-block gap is visible with zero recognition required",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10),pt(501.57),pt(506.57)]]));
 assert.equal(c.sourceBlocks,1);
 assert.equal(c.sourceCadenceMaxSeconds,491.57);
 assert.equal(c.independentlyInvalidTimeEdges,1);
 assert.equal(c.longestWithinBlockIntervals[0].durationSeconds,491.57);
});
test("D43-R1-06 collapsed duplicate across source-block join propagates quarantine",()=>{
 const c=accepted(kml([[pt(0),pt(5)],[{...pt(5)},pt(10),pt(15)]]));
 assert.equal(c.rawFixes,5);
 assert.equal(c.canonicalFixes,4);
 assert.equal(c.sourceBlockedEdges,2);
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("CROSS_BLOCK_DEDUP")));
 assert.equal(c.v2UsableVelocityEdges,1);
});
test("D43-R1-07 conflicting collapsed altitude is a source-quality break and extra V2 context mask",()=>{
 const c=accepted(kml([[pt(0,100),pt(5,100),pt(5,130),pt(10,100),pt(15,100)]]));
 assert.equal(c.rawFixes,5);
 assert.equal(c.canonicalFixes,4);
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("ALTITUDE_CONFLICT")));
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("ALTITUDE_CONFLICT_CONTEXT")));
 assert.equal(c.v2UsableVelocityEdges,0);
});
test("D43-R1-08 distinct 9-digit UTC timestamps in same JS ms remain collision quarantined",()=>{
 const a={...pt(5),time:utc(5).replace("Z",".123456789Z")};
 const b={...pt(10),time:utc(5).replace("Z",".123456790Z")};
 assert.equal(Date.parse(a.time),Date.parse(b.time));
 const c=accepted(kml([[pt(0),a,b,pt(15)]]));
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("TIMESTAMP_COLLISION")));
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("V2_TIME_EDGE_INVALID")));
 assert.equal(c.v2UsableVelocityEdges,0);
});
test("D43-R1-09 manual flight split is independent of gx source block and preserved",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10)],[pt(15),pt(20),pt(25)]]),[1]);
 assert.equal(c.sourceBlocks,2);
 assert.equal(c.sourceBlockedEdges,1);
 assert.equal(c.manualFlightSplitEdges,1);
 assert.ok(c.issueEdges.some(x=>x.beforeFix===1&&
  x.reasons.includes("MANUAL_FLIGHT_SPLIT")));
 assert.ok(c.issueEdges.some(x=>x.beforeFix===2&&
  x.reasons.includes("SOURCE_BLOCK_BOUNDARY")));
 assert.equal(c.withinBlockPositivePairs,3);
});
test("D43-R1-10 invalid split cuts and malformed split type fail closed",()=>{
 const src=kml([[pt(0),pt(5),pt(10),pt(15),pt(20),pt(25)]]);
 for(const splitCuts of [[0],[5],[3,3],[4,2],[1.5]]){
  const r=inspectD43R1Coverage({sourceText:src,splitCuts});
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"INVALID_SPLIT");
 }
 const forged=inspectD43R1Coverage({sourceText:src,splitCuts:"bad"});
 assert.equal(forged.status,"UNAVAILABLE");
 assert.equal(forged.reason,"INVALID_CONTEXT");
});
test("D43-R1-11 source, split and revision changes invalidate local context",()=>{
 const src=kml([[pt(0),pt(5),pt(10),pt(15),pt(20)]]);
 const token=d43R1LocalBinding({sourceText:src,splitCuts:[],uploadRevision:"u1"});
 const pass=inspectD43R1Coverage({
  sourceText:src,splitCuts:[],uploadRevision:"u1",expectedBinding:token
 });
 assert.equal(pass.status,"SOURCE_COVERAGE_DIAGNOSTIC_ONLY");
 for(const changed of [
  {sourceText:src+" ",uploadRevision:"u1"},
  {sourceText:src,splitCuts:[1],uploadRevision:"u1"},
  {sourceText:src,uploadRevision:"u2"},
  {sourceText:src,uploadRevision:"u1",splitRevision:"new"},
 ]){
  const r=inspectD43R1Coverage({...changed,expectedBinding:token});
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"STALE_CONTEXT");
 }
});
test("D43-R1-12 reporting does not echo absolute UTC, coordinates or source registration",()=>{
 const source=kml([[pt(0),pt(5),pt(10),pt(15),pt(20)]])
  .replace("<kml ","<kml id=\"REG_SECRET\" ");
 const json=JSON.stringify(inspectD43R1Coverage({sourceText:source}));
 for(const literal of ["REG_SECRET","2026-10-19","50.123456789",
  "14.987654321","06:00:00"])
  assert.equal(json.includes(literal),false,literal);
});
test("D43-R1-13 reporting exists with zero recognition hypotheses",()=>{
 const source=kml([[pt(0),pt(5),pt(10),pt(104.39),pt(109.39)]]);
 const r=inspectGpsV2HorizontalTrack({
  sourceText:source,fileName:"clean.kml",canonicalPoints:parseKml(source),
  splitCuts:[],
 });
 assert.equal(r.status,"ADVISORY_ONLY");
 assert.equal(r.events.length,0);
 const c=accepted(source);
 assert.ok(c.issueEdges.length>0);
 assert.equal(c.candidateAnalysis,"NOT_PERFORMED");
});
test("D43-R1-14 exact pre-existing 60s V2 edge limit stays separate from coverage claim",()=>{
 const c=accepted(kml([[pt(0),pt(59.999),pt(119.999)]]));
 assert.equal(c.independentlyInvalidTimeEdges,1);
 assert.ok(c.longestWithinBlockIntervals.some(x=>
  x.durationSeconds===60&&x.v2TimeEdge==="EXCEEDS_EXISTING_LIMIT"));
 assert.ok(c.longestWithinBlockIntervals.some(x=>
  x.durationSeconds===59.999&&x.v2TimeEdge==="WITHIN_EXISTING_LIMIT"));
});
test("D43-R1-15 over 900kmh V2 edge invalid independently of timing",()=>{
 const far={...pt(5),lon:15.9};
 const c=accepted(kml([[pt(0),far,pt(10),pt(15)]]));
 assert.ok(c.independentlyInvalidSpeedEdges>=1);
 assert.ok(c.issueEdges.some(x=>x.reasons.includes("V2_SPEED_EDGE_INVALID")));
});
test("D43-R1-16 unsupported, unpaired and non-monotonic sources fail closed",()=>{
 const valid=kml([[pt(0),pt(5),pt(10)]]);
 for(const sourceText of [
  "INVALID SOURCE",
  valid.replace("<when>"+utc(5)+"</when>",""),
  kml([[pt(10),pt(5),pt(15)]]),
 ]){
  const result=inspectD43R1Coverage({sourceText});
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.coverage,null);
  assert.equal(result.actualLandings,"UNAVAILABLE");
 }
});
test("D43-R1-17 large source is UNAVAILABLE with no source echo",()=>{
 const r=inspectD43R1Coverage({sourceText:"SECRET"+"x".repeat(2_000_001)});
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"SOURCE_LIMIT");
 assert.equal(JSON.stringify(r).includes("SECRET"),false);
});
test("D43-R1-18 top source durations are bounded, sorted and deterministic",()=>{
 const source=kml([Array.from({length:40},(_,i)=>pt(i*i+1))]);
 const a=accepted(source),b=accepted(source);
 assert.deepEqual(a,b);
 assert.equal(a.longestWithinBlockIntervals.length,8);
 assert.ok(a.longestWithinBlockIntervals.every((x,i,arr)=>
  i===0||arr[i-1].durationSeconds>=x.durationSeconds));
});
test("D43-R1-19 source relative ratios remain descriptive, not a new rejection threshold",()=>{
 const c=accepted(kml([[pt(0),pt(5),pt(10),pt(45),pt(50),pt(55)]]));
 const gap=c.longestWithinBlockIntervals[0];
 assert.equal(gap.durationSeconds,35);
 assert.equal(gap.relativeToSourceMedian,7);
 assert.equal(gap.v2TimeEdge,"WITHIN_EXISTING_LIMIT");
 assert.equal(c.v2UsableVelocityEdges,5);
});
test("D43-R1-20 V2 still rejects native multi-block source despite research coverage",()=>{
 const source=kml([[pt(0),pt(5),pt(10)],[pt(15),pt(20),pt(25)]]);
 const c=accepted(source);
 assert.equal(c.sourceBlocks,2);
 const native=inspectGpsV2HorizontalTrack({
  sourceText:source,fileName:"private.kml",canonicalPoints:parseKml(source),
  splitCuts:[],
 });
 assert.equal(native.status,"UNAVAILABLE");
 assert.equal(native.reason,"UNSUPPORTED_SOURCE");
 assert.equal(native.canAffectCanonicalFlight,false);
});
test("D43-R1-21 unrelated source metadata and forged extra input are never accepted as authority",()=>{
 const source=kml([[pt(0),pt(5),pt(10),pt(15)]]);
 const r=inspectD43R1Coverage({sourceText:source,trustAllPositions:true});
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"INVALID_CONTEXT");
 const bare=inspectD43R1Coverage(null);
 assert.equal(bare.status,"UNAVAILABLE");
});
test("D43-R1-22 static research-only module has no file write/network paths",()=>{
 const source=readFileSync("research/gps-detection-r21/stage-d43-r1-coverage.ts","utf8");
 for(const banned of [/\bfetch\s*\(/,/\bwriteFileSync\s*\(/,
  /\bprocess\.env\b/,/https?:\/\//,/\bactualLandings:\s*[0-9]/])
  assert.doesNotMatch(source,banned);
 const v2=readFileSync("lib/gps-v2-advisory.ts","utf8");
 const canonical=readFileSync("lib/gps-v2-import-lineage.ts","utf8");
 assert.equal(v2.includes("stage-d43-r1-coverage"),false);
 assert.equal(canonical.includes("stage-d43-r1-coverage"),false);
});
