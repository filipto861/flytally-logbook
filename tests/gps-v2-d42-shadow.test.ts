import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseKml} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack,GPS_V2_ALGORITHM_REVISION} from "../lib/gps-v2-advisory.ts";
import {inspectD42Shadow,d42LocalBinding} from "../research/gps-detection-r21/stage-d42-shadow.ts";

type P={lat:number;lon:number;alt:number|null;time:string};
const LAT=50,START=Date.UTC(2026,0,1,10,0,0);
const lonPerKm=1/(111.1950802*Math.cos(LAT*Math.PI/180));
function flight(speeds:number[],dt:number[]=[],alt?:number[]):P[]{
 let lon=14,elapsed=0;
 const point=(s:number,a:number):P=>({
  lat:LAT,lon,alt:a,time:new Date(START+s*1000).toISOString().replace(".000Z","Z"),
 });
 const points=[point(0,alt?.[0]??100)];
 for(let i=0;i<speeds.length;i++){
  const duration=dt[i]??5;elapsed+=duration;
  lon+=speeds[i]*duration/3600*lonPerKm;
  points.push(point(elapsed,alt?.[i+1]??100));
 }
 return points;
}
function kml(blocks:readonly (readonly P[])[]):string{
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  blocks.map(block=>'<gx:Track>'+
   block.map(p=>'<when>'+p.time+'</when>').join("")+
   block.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
    (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
   '</gx:Track>').join("")+'</kml>';
}
const pattern=[5,5,60,60,60,5,5,5,60,60,60,5,5];
function accepted(sourceText:string,splitCuts:number[]=[]){
 const r=inspectD42Shadow({sourceText,splitCuts});
 if(r.status==="UNAVAILABLE")throw Error(r.reason);
 assert.equal(r.status,"RESEARCH_DIAGNOSTIC_ONLY");
 assert.equal(r.referenceRevision,GPS_V2_ALGORITHM_REVISION);
 assert.equal(r.physicalContact,"UNRESOLVED");
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(r.canAffectCanonicalFlight,false);
 return r;
}
function expectedEvents(sourceText:string,splitCuts:number[]=[]){
 const canonicalPoints=parseKml(sourceText);
 const native=inspectGpsV2HorizontalTrack({
  sourceText,fileName:"private.kml",canonicalPoints,splitCuts,
 });
 assert.equal(native.status,"ADVISORY_ONLY",native.reason??"");
 const origin=Date.parse(canonicalPoints[0].time!);
 return native.events.map(e=>({
  kind:e.kind,normalizedIndex:e.normalizedIndex,splitIndex:e.splitIndex,
  relativeSeconds:Math.round((Date.parse(e.utc)-origin)/100)/10,
 }));
}
function sameCandidates(source:string,cuts:number[]=[]){
 const r=accepted(source,cuts);
 const projection=(candidate:typeof r.hypotheticalBase[number])=>({
  kind:candidate.kind,normalizedIndex:candidate.normalizedIndex,
  splitIndex:candidate.splitIndex,relativeSeconds:candidate.relativeSeconds,
 });
 assert.deepEqual(r.hypotheticalBase.map(projection),expectedEvents(source,cuts));
 assert.deepEqual(r.candidates.map(projection),expectedEvents(source,cuts));
 return r;
}
test("D42-01 clean one-block matches exact V2 events, types, indices, splits and UTC-derived times",()=>{
 const source=kml([flight(pattern)]);
 const r=sameCandidates(source);
 assert.ok(r.candidates.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
 const points=parseKml(source);
 const reference=inspectGpsV2HorizontalTrack({
  sourceText:source,fileName:"a.kml",canonicalPoints:points,splitCuts:[],
 });
 for(const candidate of r.candidates){
  const native=reference.events.find(e=>e.kind===candidate.kind&&
   e.normalizedIndex===candidate.normalizedIndex&&e.splitIndex===candidate.splitIndex);
  assert.ok(native);
  assert.equal(native.utc,points[candidate.normalizedIndex].time);
 }
});
test("D42-02 4.9s cross-block fast-slow-fast cannot bridge; one-block is control",()=>{
 const p=flight(pattern);
 const single=accepted(kml([p]));
 assert.ok(single.hypotheticalBase.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
 const q=p.map(x=>({...x}));
 // Shift all later instants by 0.1s: the single block boundary edge = 4.9s.
 for(let i=6;i<q.length;i++)
  q[i].time=new Date(Date.parse(q[i].time)-100).toISOString();
 const mixed=accepted(kml([q.slice(0,6),q.slice(6)]));
 assert.ok(mixed.hypotheticalBase.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
 assert.ok(mixed.suppressedByBoundary.some(e=>e.kind==="STOP_GO_REVIEW_POINT"));
 assert.equal(mixed.candidates.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
 assert.equal(mixed.blockedEdges,1);
});
test("D42-03 a one-point middle block never produces a synthetic flight; empty fails closed",()=>{
 const p=flight(pattern);
 const r=accepted(kml([p.slice(0,3),p.slice(3,4),p.slice(4)]));
 assert.equal(r.sourceBlocks,3);
 assert.equal(r.blockedEdges,2);
 assert.ok(r.suppressedByBoundary.length>=0);
 const bad=inspectD42Shadow({sourceText:kml([p.slice(0,3),[],p.slice(4)])});
 assert.equal(bad.status,"UNAVAILABLE");
});
test("D42-04 collapsed cross-block fix quarantines neighboring canonical edges",()=>{
 const p=flight(pattern);
 const source=kml([p.slice(0,6),[p[5],...p.slice(6)]]);
 const r=accepted(source);
 assert.equal(r.blockedEdges,2);
 assert.equal(r.canonicalFixes,p.length);
 assert.equal(r.candidates.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
});
test("D42-05 conflicting duplicate altitude remains research-only and cannot prove height",()=>{
 const p=flight(pattern),dup={...p[6],alt:999};
 const source=kml([[...p.slice(0,7),dup,...p.slice(7)]]);
 const r=accepted(source);
 assert.ok(r.blockedEdges>=2);
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(parseKml(source)[6].alt,p[6].alt);
});
test("D42-06 submillisecond same-JS-ms positions invalidate velocity context",()=>{
 const p=flight(pattern);
 const duplicate={...p[6],lon:p[6].lon+0.001,
  time:p[6].time.replace("Z",".000000001Z")};
 const src=kml([[...p.slice(0,7),duplicate,...p.slice(7)]]);
 const r=accepted(src);
 assert.ok(r.blockedEdges>=2);
 assert.equal(r.physicalContact,"UNRESOLVED");
});
test("D42-07 35s slow evidence edge can be native-valid but is INCONCLUSIVE",()=>{
 const speeds=[5,5,60,60,60,5,60,60,60,5,5];
 const dt=speeds.map((_,i)=>i===5?35:5);
 const src=kml([flight(speeds,dt)]);
 const r=sameCandidates(src);
 const stop=r.candidates.find(e=>e.kind==="STOP_GO_REVIEW_POINT");
 assert.ok(stop);
 assert.equal(stop.slowEvidenceEdges,1);
 assert.equal(stop.disposition,"INCONCLUSIVE");
 assert.equal(stop.reason,"UNOBSERVED_CONTINUITY");
 assert.equal(r.cadence.maxSeconds,35);
 assert.equal(r.cadence.medianSeconds,5);
});
test("D42-08 94s gap splits existing V2 speed island without a new threshold",()=>{
 const speeds=[5,5,60,60,60,5,60,60,60];
 const dt=speeds.map((_,i)=>i===5?94:5);
 const src=kml([flight(speeds,dt)]);
 const r=sameCandidates(src);
 assert.equal(r.cadence.intervalsAtOrAboveExisting60sLimit,1);
 assert.equal(r.candidates.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
});
test("D42-09 low-pass and taxi-like pattern never authorizes contact or landing count",()=>{
 const src=kml([flight([60,60,60,45,40,40,50,60,60,60])]);
 const r=sameCandidates(src);
 assert.equal(r.candidates.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false);
 assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("D42-10 suspect altitude changes do not trigger research touchdown authority",()=>{
 const p=flight(pattern),i=6;
 p[i].alt=80;p[i+1].alt=95;
 p[i+1].time=new Date(Date.parse(p[i].time)+520).toISOString();
 const r=accepted(kml([p]));
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(r.physicalContact,"UNRESOLVED");
});
test("D42-11 user flight split and source block are independent; changed raw source stale",()=>{
 const p=flight(pattern),source=kml([p.slice(0,6),p.slice(6)]);
 const cuts=[8],uploadRevision="upload-1",splitRevision="split-2";
 const expectedBinding=d42LocalBinding({sourceText:source,splitCuts:cuts,uploadRevision,splitRevision});
 const r=inspectD42Shadow({sourceText:source,splitCuts:cuts,
  uploadRevision,splitRevision,expectedBinding});
 assert.equal(r.status,"RESEARCH_DIAGNOSTIC_ONLY");
 const stale=inspectD42Shadow({sourceText:source+" ",splitCuts:cuts,
  uploadRevision,splitRevision,expectedBinding});
 assert.equal(stale.status,"UNAVAILABLE");
 assert.equal(stale.reason,"STALE_CONTEXT");
});
test("D42-12 only relative times and counts reach a research report",()=>{
 const src=kml([flight(pattern)]).replace("<kml ","<kml id=\"SECRET_REG\" ");
 const r=accepted(src),json=JSON.stringify(r);
 for(const secret of ["2026-01-01T","SECRET_REG","50,","14.000","10:00:"])
  assert.equal(json.includes(secret),false,secret);
});
test("D42-13 production multi-track reader remains UNSUPPORTED_SOURCE",()=>{
 const p=flight(pattern),src=kml([p.slice(0,5),p.slice(5)]);
 const research=accepted(src);
 assert.equal(research.status,"RESEARCH_DIAGNOSTIC_ONLY");
 const native=inspectGpsV2HorizontalTrack({
  sourceText:src,fileName:"n.kml",canonicalPoints:parseKml(src),splitCuts:[],
 });
 assert.equal(native.status,"UNAVAILABLE");
 assert.equal(native.reason,"UNSUPPORTED_SOURCE");
});
test("D42-14 deterministic seeded differential fuzz on 36 one-block patterns",()=>{
 let seed=81173;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let k=0;k<36;k++){
  const speeds=Array.from({length:18+Math.floor(rand()*20)},()=>
    [0,5,10,20,40,45,55,60,100][Math.floor(rand()*9)]);
  const src=kml([flight(speeds)]);
  sameCandidates(src);
 }
});
test("D42-15 report cadence without introducing a fixed 15/35 second gate",()=>{
 const src=kml([flight([5,5,60,60,60,5,60,60,60,5,5],
  [5,5,5,5,5,35,5,5,5,5,5])]);
 const r=accepted(src);
 assert.equal(r.cadence.medianSeconds,5);
 assert.equal(r.cadence.maxSeconds,35);
 assert.equal(r.cadence.intervalsAtOrAboveExisting60sLimit,0);
});
test("D42-16 uniformly sparse telemetry is not mislabeled continuous/ground truth",()=>{
 const r=accepted(kml([flight(pattern,pattern.map(()=>35))]));
 assert.equal(r.cadence.medianSeconds,35);
 assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("D42-17 zero proposals, unsupported source and contact labels remain distinct",()=>{
 const r=accepted(kml([flight(Array(10).fill(60))]));
 assert.deepEqual(r.candidates,[]);
 assert.equal(r.actualLandings,"UNAVAILABLE");
 const unavailable=inspectD42Shadow({sourceText:"invalid source"});
 assert.equal(unavailable.status,"UNAVAILABLE");
 assert.equal(unavailable.candidates,null);
});
test("D42-18 malformed/oversized source fails closed, no raw exception echo",()=>{
 const p=flight(pattern),src=kml([p]);
 const malformed=inspectD42Shadow({sourceText:src.replace("</gx:Track>","")});
 assert.equal(malformed.status,"UNAVAILABLE");
 const huge=inspectD42Shadow({sourceText:src+"x".repeat(2_000_001)});
 assert.equal(huge.status,"UNAVAILABLE");
 assert.equal(JSON.stringify(huge).includes("14.000"),false);
});
test("D42-19 binding changes with input, split, parser or upload revision",()=>{
 const src=kml([flight(pattern)]);
 const a=d42LocalBinding({sourceText:src,splitCuts:[],uploadRevision:"u1"});
 for(const revised of [
  {sourceText:src+" "},{sourceText:src,splitCuts:[4]},
  {sourceText:src,uploadRevision:"u2"},
  {sourceText:src,splitRevision:"s2"},
 ]){
  const token=d42LocalBinding(revised);
  assert.notEqual(a,token);
 }
 const changed=inspectD42Shadow({sourceText:src,expectedBinding:a,
  uploadRevision:"u2"});
 assert.equal(changed.status,"UNAVAILABLE");
 assert.equal(changed.reason,"STALE_CONTEXT");
});
test("D42-20 research module has no persistence, network, or production imports of shadow",()=>{
 const s=readFileSync("research/gps-detection-r21/stage-d42-shadow.ts","utf8");
 assert.doesNotMatch(s,/\bfetch\s*\(|\bwriteFileSync\s*\(|\bprocess\.env\b/);
 assert.match(s,/GPS_V2_HORIZONTAL_V3/);
 assert.match(s,/inspectD4MultiGxLineage/);
});
