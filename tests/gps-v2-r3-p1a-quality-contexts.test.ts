import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {parseKml,landingCount,touchAndGoEvents} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack} from "../lib/gps-v2-advisory.ts";
import {inspectD43R2LegacyShapeAudit} from
 "../research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts";
import {R3_P1A_REVISION,inspectR3P1AQualityContexts} from
 "../research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts";

type Point={time:string;lat:number;lon:number;alt:number|null};
const values=[320,310,300,290,270,250,230,210,190,180,170,171,
 180,190,235,245,270,300,320,340,350];
function make(relativeStep=false,constantPosition=false):Point[]{
 return values.map((alt,i)=>({
   lat:50.001,lon:14.002+(constantPosition?0:i*.001),
   alt:relativeStep&&i===14?190:alt,
   time:new Date(Date.UTC(2026,9,19,7,0,0)+
     (i===14?66:i*5)*1000).toISOString().replace(".000Z","Z"),
 }));
}
function source(blocks:readonly (readonly Point[])[]):string{
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  blocks.map(rows=>'<gx:Track>'+
   rows.map(p=>'<when>'+p.time+'</when>').join("")+
   rows.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
     (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
   '</gx:Track>').join("")+'</kml>';
}
const analyze=(text:string,splitCuts:readonly number[]=[],
    other:Readonly<Record<string,unknown>>={})=>
 inspectR3P1AQualityContexts({
  sourceText:text,canonicalPoints:parseKml(text),splitCuts,
  expectedRevision:R3_P1A_REVISION,...other,
 });
const mustQuality=(text:string)=>{
 const r=analyze(text);
 assert.equal(r.status,"QUALITY_REVIEW_ONLY",r.status==="UNAVAILABLE"?r.reason:"");
 if(r.status!=="QUALITY_REVIEW_ONLY")throw Error("unavailable");
 assert.equal(r.canAffectCanonicalFlight,false);
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(r.physicalContact,"UNRESOLVED");
 assert.equal(r.recencyEvidence,"UNAVAILABLE");
 return r.contexts;
};
test("P1A-01 one common bad height edge groups overlapping frozen legacy minima",()=>{
 const text=source([make()]);
 const contexts=mustQuality(text);
 assert.equal(contexts.length,1);
 assert.ok(contexts[0].affectedGeometryWindows>=2);
 assert.equal(contexts[0].reason,"OBSERVED_HEIGHT_STEP_IN_FROZEN_LEGACY_EVIDENCE_SPAN");
 assert.equal(contexts[0].physicalContact,"UNRESOLVED");
 const frozen=inspectD43R2LegacyShapeAudit({sourceText:text});
 assert.equal(frozen.status,"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY");
 if(frozen.status!=="LEGACY_SOURCE_SHAPE_COMPARISON_ONLY")throw Error("frozen unavailable");
 assert.equal(contexts.reduce((n,c)=>n+c.affectedGeometryWindows,0),
   frozen.comparison.inSpanDerivativeRejectedWindows);
});
test("P1A-02 no source height discontinuity means no diagnostic, not no landing",()=>{
 const text=source([make(true)]);
 const r=analyze(text);
 assert.equal(r.status,"NO_QUALIFYING_DIAGNOSTIC");
 assert.deepEqual(r.contexts,[]);
 assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("P1A-03 slow-position fake descent/climb never becomes a contact hint",()=>{
 const r=analyze(source([make(false,true)]));
 assert.equal(r.status,"NO_QUALIFYING_DIAGNOSTIC");
 assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("P1A-04 a long (>15s) interval is explicitly unassessed motion",()=>{
 const rows=make();
 const t0=Date.UTC(2026,9,19,7);
 for(let i=9;i<rows.length;i++){
  if(i===14)rows[i]={...rows[i],time:new Date(t0+86000).toISOString()};
  else rows[i]={...rows[i],time:new Date(t0+(i*5+20)*1000).toISOString()};
 }
 const r=analyze(source([rows]));
 if(r.status==="QUALITY_REVIEW_ONLY")
  assert.ok(r.contexts.some(x=>x.coverage==="LONG_INTERVALS_UNASSESSED"));
 else assert.equal(r.status,"UNAVAILABLE");
});
test("P1A-05 bad edge at gx block join is never a connected quality context",()=>{
 const rows=make();
 const r=analyze(source([rows.slice(0,14),rows.slice(14)]));
 assert.notEqual(r.status,"QUALITY_REVIEW_ONLY");
});
test("P1A-06 multi-gx original source remains UNAVAILABLE to native V2",()=>{
 const rows=make();
 const text=source([rows.slice(0,5),rows.slice(5)]);
 const native=inspectGpsV2HorizontalTrack({
  sourceText:text,fileName:"owner-private.kml",
  canonicalPoints:parseKml(text),splitCuts:[],
 });
 assert.equal(native.status,"UNAVAILABLE");
 assert.equal(native.reason,"UNSUPPORTED_SOURCE");
});
test("P1A-07 explicit split between minimum and height edge removes stale context",()=>{
 const text=source([make()]);
 const base=mustQuality(text);
 assert.ok(base.length>=1);
 const split=analyze(text,[12]);
 assert.notEqual(split.status,"QUALITY_REVIEW_ONLY");
});
test("P1A-08 malformed split, duplicate split and out-of-range split fail closed",()=>{
 const text=source([make()]);
 for(const splitCuts of [[0],[20],[4,4],[16,3]]){
  const r=analyze(text,splitCuts);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.contexts,null);
 }
 for(const splitCuts of [[1],[2,18]]){
  const r=analyze(text,splitCuts);
  assert.notEqual(r.status,"UNAVAILABLE");
  if(r.status==="QUALITY_REVIEW_ONLY")
   assert.ok(r.contexts.every(c=>!splitCuts.includes(c.sourceEdgeBeforeFix)));
 }
});
test("P1A-09 forged canonical point fails source parity",()=>{
 const text=source([make()]);
 const canonical=parseKml(text);
 const r=inspectR3P1AQualityContexts({
  sourceText:text,canonicalPoints:canonical.map((p,i)=>i===10?{...p,alt:0}:p),
  splitCuts:[],expectedRevision:R3_P1A_REVISION,
 });
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"CANONICAL_SOURCE_MISMATCH");
 assert.equal(r.contexts,null);
});
test("P1A-10 source replacement invalidates previous canonical identity",()=>{
 const text=source([make()]);
 const other=source([make(true)]);
 const r=inspectR3P1AQualityContexts({
  sourceText:other,canonicalPoints:parseKml(text),splitCuts:[],
  expectedRevision:R3_P1A_REVISION,
 });
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"CANONICAL_SOURCE_MISMATCH");
});
test("P1A-11 wrong algorithm revision and unknown input keys never default",()=>{
 const text=source([make()]);
 const canonicalPoints=parseKml(text);
 for(const input of [
  null,{sourceText:text,canonicalPoints,splitCuts:[]},
  {sourceText:text,canonicalPoints,splitCuts:[],expectedRevision:"V0"},
  {sourceText:text,canonicalPoints,splitCuts:[],expectedRevision:R3_P1A_REVISION,actualLandings:8},
 ]){
  const r=inspectR3P1AQualityContexts(input);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.contexts,null);
 }
});
test("P1A-12 unsupported GPX/other source is no diagnostic",()=>{
 const r=inspectR3P1AQualityContexts({
  sourceText:"<gpx></gpx>",canonicalPoints:[],splitCuts:[],
  expectedRevision:R3_P1A_REVISION,
 });
 assert.equal(r.status,"UNAVAILABLE");
});
test("P1A-13 missing altitude and observed zero are NOT conflated",()=>{
 const blank=make().map(p=>({...p,alt:null}));
 const r=analyze(source([blank]));
 assert.equal(r.status,"NO_QUALIFYING_DIAGNOSTIC");
 assert.equal(r.actualLandings,"UNAVAILABLE");
 const zero=make();zero[10]={...zero[10],alt:0};
 const z=analyze(source([zero]));
 assert.notEqual(z.status,"UNAVAILABLE");
});
test("P1A-14 source character limit fails closed before heavy parsing",()=>{
 const r=inspectR3P1AQualityContexts({
  sourceText:"<kml>"+ "x".repeat(2_000_100)+"</kml>",
  canonicalPoints:[],splitCuts:[],expectedRevision:R3_P1A_REVISION,
 });
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"SOURCE_LIMIT");
});
test("P1A-15 response has no route/time/height/source filename or digest",()=>{
 const sourceText=source([make()]);
 const s=JSON.stringify(analyze(sourceText));
 for(const secret of ["50.001","14.002","2026-10-19T07:00","owner-private",
  "235","sourceText","latitude","longitude","sha256"]){
  assert.equal(s.includes(secret),false,secret);
 }
});
test("P1A-16 preview diagnosis does NOT mutate legacy landing count",()=>{
 const text=source([make()]);
 const points=parseKml(text);
 const events=touchAndGoEvents(points),old=landingCount(points);
 const r=analyze(text);
 assert.ok(["QUALITY_REVIEW_ONLY","NO_QUALIFYING_DIAGNOSTIC"].includes(r.status));
 assert.equal(landingCount(points),old);
 assert.deepEqual(touchAndGoEvents(points),events);
});
test("P1A-17 module is browser-safe and never imported by production paths",()=>{
 const filename="research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts";
 const content=readFileSync(filename,"utf8");
 for(const pattern of [/node:crypto/,/node:fs/,/\bprocess\.env\b/,
  /\bfetch\s*\(/,/\bwriteFileSync\s*\(/,/console\./])
   assert.doesNotMatch(content,pattern);
 for(const path of ["components/kml-import-form.tsx",
  "lib/gps-v2-advisory.ts","lib/gps-v2-import-lineage.ts",
  "lib/track-processing.ts","app/(protected)/flights/actions.ts"]){
  assert.ok(!readFileSync(path,"utf8").includes("stage-r3-p1a-source-quality-contexts"));
 }
});
test("P1A-18 private CLI invalid input never echoes private file name",()=>{
 const privateName="PRIVATE_AIRCRAFT_OWNER_SECRET.kml";
 const args=["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
   "--experimental-strip-types","tooling/gps-v2-r3-p1a-quality-contexts.mjs",
   "--file",privateName,"--id","sample07"];
 const p=spawnSync(process.execPath,args,{encoding:"utf8"});
 assert.equal(p.status,2);
 assert.ok(p.stdout.includes("LOCAL_SOURCE_UNREADABLE"));
 assert.equal((p.stdout+p.stderr).includes(privateName),false);
 const q=spawnSync(process.execPath,[...args.slice(0,-1),"PRIVATE_SECRET"],
  {encoding:"utf8"});
 assert.equal(q.status,2);
 assert.ok(q.stdout.includes("INVALID_CONTEXT"));
 assert.equal((q.stdout+q.stderr).includes("PRIVATE_SECRET"),false);
});
