import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {parseKml} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack} from "../lib/gps-v2-advisory.ts";
import {
 inspectD43R2AltitudeQuality,d43R2QualityLocalBinding,
 D43_R2_QUALITY_REVISION,
} from "../research/gps-detection-r21/stage-d43-r2-altitude-quality.ts";

type Pt={time:string;lat:number;lon:number;alt:number|null};
const utc=(seconds:number):string=>
 new Date(Date.UTC(2026,9,19,6,0,0)+seconds*1000).toISOString()
  .replace(".000Z","Z");
const pt=(seconds:number,alt:number|null=180):Pt=>({
 time:utc(seconds),lat:50.123456789,lon:14.987654321+seconds*0.00001,alt,
});
function kml(blocks:readonly (readonly Pt[])[]):string{
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  blocks.map(block=>'<gx:Track>'+
   block.map(p=>'<when>'+p.time+'</when>').join("")+
   block.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
    (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
   '</gx:Track>').join("")+'</kml>';
}
const source=(times:readonly number[],heights?:readonly (number|null)[])=>
 kml([times.map((s,i)=>pt(s,heights?.[i]??180))]);
function ok(sourceText:string,splitCuts:number[]=[]){
 const r=inspectD43R2AltitudeQuality({sourceText,splitCuts});
 if(r.status==="UNAVAILABLE")throw Error(r.reason);
 assert.equal(r.revision,D43_R2_QUALITY_REVISION);
 assert.equal(r.physicalContact,"UNRESOLVED");
 assert.equal(r.actualLandings,"UNAVAILABLE");
 assert.equal(r.recencyEvidence,"UNAVAILABLE");
 assert.equal(r.canAffectCanonicalFlight,false);
 assert.equal(r.quality.candidateAnalysis,"NOT_PERFORMED");
 assert.equal(r.quality.sourceAltitudeDatum,"UNKNOWN");
 assert.equal(r.quality.sourceAltitudeAccuracy,"UNKNOWN");
 assert.equal(r.quality.sourceAltitudeAuthenticity,"UNKNOWN");
 assert.equal(r.quality.interveningMotionUnknownPairs,r.quality.adjacentPairs);
 return r.quality;
}
const count=(reasons:readonly {reason:string;edges:number}[],reason:string)=>
 reasons.find(r=>r.reason===reason)?.edges??0;

test("R2-1-01 available source heights are not physical contact evidence",()=>{
 const q=ok(source([0,5,10,15,20]));
 assert.equal(q.finiteAltitudeFixes,5);
 assert.equal(q.nullAltitudeFixes,0);
 assert.equal(q.referenceExceedances,0);
 assert.equal(q.referenceAssessedPairs,4);
});
test("R2-1-02 missing altitude is distinct from numeric zero",()=>{
 const q=ok(source([0,5,10,15,20],[0,null,0,100,0]));
 assert.equal(q.finiteAltitudeFixes,4);
 assert.equal(q.zeroAltitudeFixes,3);
 assert.equal(q.nullAltitudeFixes,1);
 assert.equal(q.missingHeightEndpointPairs,2);
 assert.equal(q.finiteHeightEndpointPairs,2);
});
test("R2-1-03 four-point-nine-second source block join is never assessed",()=>{
 const second={...pt(9.9,300)};
 const q=ok(kml([[pt(0,100),pt(5,100)],[second,pt(15,300)]]));
 assert.equal(q.sourceBlocks,2);
 assert.equal(q.sourceOrSplitBoundaries,1);
 assert.equal(count(q.issueReasons,"SOURCE_BLOCK_BOUNDARY"),1);
 assert.equal(q.referenceAssessedPairs,2);
 assert.equal(q.referenceExceedances,0);
});
test("R2-1-04 collapsed cross-block duplicate quarantines adjacent pairs",()=>{
 const q=ok(kml([[pt(0),pt(5)],[pt(5),pt(10),pt(15)]]));
 assert.equal(q.canonicalFixes,4);
 assert.equal(count(q.issueReasons,"CROSS_BLOCK_DEDUP"),2);
 assert.equal(q.sourceOrSplitBoundaries,2);
 assert.equal(q.referenceAssessedPairs,1);
});
test("R2-1-05 retained altitude conflict remains a source-quality anomaly",()=>{
 const q=ok(kml([[pt(0,100),pt(5,100),pt(5,130),pt(10,100),pt(15,100)]]));
 assert.ok(count(q.issueReasons,"ALTITUDE_CONFLICT")>=1);
 assert.ok(count(q.issueReasons,"ALTITUDE_CONFLICT_CONTEXT")>=1);
 assert.equal(q.referenceAssessedPairs,0);
});
test("R2-1-06 same millisecond differing UTC fixes are quarantined",()=>{
 const a={...pt(5),time:utc(5).replace("Z",".123456789Z")};
 const b={...pt(10),time:utc(5).replace("Z",".123456790Z")};
 assert.equal(Date.parse(a.time),Date.parse(b.time));
 const q=ok(kml([[pt(0),a,b,pt(15)]]));
 assert.ok(count(q.issueReasons,"TIMESTAMP_COLLISION")>=1);
 assert.ok(count(q.issueReasons,"V2_TIME_EDGE_INVALID")>=1);
 assert.equal(q.referenceAssessedPairs,0);
});
test("R2-1-07 16-second source interval is not a clean legacy guard decision",()=>{
 const q=ok(source([0,5,21,26]));
 assert.equal(q.over15SecondsUnassessedPairs,1);
 assert.equal(q.referenceAssessedPairs,2);
 assert.equal(q.sourceCadenceMaxSeconds,16);
});
test("R2-1-08 35.35 seconds stays unassessed, not a new gap threshold",()=>{
 const q=ok(source([0,5,40.35,45.35]));
 assert.equal(q.over15SecondsUnassessedPairs,1);
 assert.equal(q.referenceAssessedPairs,2);
 assert.equal(q.sourceCadenceMaxSeconds,35.35);
});
test("R2-1-09 both 94.39 and 491.57 seconds remain recorded as unassessed",()=>{
 for(const gap of [94.39,491.57]){
  const q=ok(source([0,5,5+gap,10+gap]));
  assert.equal(q.sourceCadenceMaxSeconds,gap);
  assert.equal(q.over15SecondsUnassessedPairs,1);
  assert.equal(count(q.issueReasons,"V2_TIME_EDGE_INVALID"),1);
  assert.equal(q.referenceAssessedPairs,2);
 }
});
test("R2-1-10 >25m/s is a GLOBAL source-edge comparison, NOT legacy rejection",()=>{
 const q=ok(source([0,5,10,15,20],[100,100,240,240,240]));
 assert.equal(q.referenceAssessedPairs,4);
 assert.equal(q.referenceExceedances,1);
 assert.equal(q.referenceInterpretation,
  "GLOBAL_SOURCE_EDGE_COMPARISON_NOT_LEGACY_WINDOW_REJECTION");
});
test("R2-1-11 exactly 25m/s does not exceed frozen historical reference",()=>{
 const q=ok(source([0,5,10,15],[100,100,225,225]));
 assert.equal(q.referenceExceedances,0);
});
test("R2-1-12 overlapping source and V2 timing issues are not unique-edge duplicates",()=>{
 const q=ok(kml([[pt(0),pt(5)],[pt(105),pt(110)]]));
 assert.equal(q.sourceOrSplitBoundaries,1);
 assert.equal(count(q.issueReasons,"SOURCE_BLOCK_BOUNDARY"),1);
 assert.equal(count(q.issueReasons,"V2_TIME_EDGE_INVALID"),1);
 assert.equal(q.uniqueIssueEdges,1);
});
test("R2-1-13 manual split is independent of source-block cut",()=>{
 const q=ok(kml([[pt(0),pt(5),pt(10)],[pt(15),pt(20),pt(25)]]),[1]);
 assert.equal(q.sourceOrSplitBoundaries,2);
 assert.equal(count(q.issueReasons,"MANUAL_FLIGHT_SPLIT"),1);
 assert.equal(count(q.issueReasons,"SOURCE_BLOCK_BOUNDARY"),1);
 assert.equal(q.referenceAssessedPairs,3);
});
test("R2-1-14 source, split, revision token edits fail closed",()=>{
 const text=source([0,5,10,15,20]);
 const expectedBinding=d43R2QualityLocalBinding({sourceText:text,uploadRevision:"u1"});
 const good=inspectD43R2AltitudeQuality({sourceText:text,uploadRevision:"u1",expectedBinding});
 assert.equal(good.status,"SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY");
 for(const input of [
  {sourceText:text+" ",uploadRevision:"u1"},
  {sourceText:text,splitCuts:[1],uploadRevision:"u1"},
  {sourceText:text,uploadRevision:"u2"},
  {sourceText:text,uploadRevision:"u1",splitRevision:"new"},
 ]){
  const bad=inspectD43R2AltitudeQuality({...input,expectedBinding});
  assert.equal(bad.status,"UNAVAILABLE");
  assert.equal(bad.reason,"STALE_CONTEXT");
 }
});
test("R2-1-15 unsupported, non-monotonic, invalid cuts and forged keys fail closed",()=>{
 const text=source([0,5,10,15,20,25]);
 for(const input of [
  {sourceText:"not a KML"},
  {sourceText:kml([[pt(10),pt(5),pt(15)]])},
  {sourceText:text,splitCuts:[0]},
  {sourceText:text,splitCuts:[1.5]},
  {sourceText:text,canonicalPoints:"forged"},
 ]){
  const r=inspectD43R2AltitudeQuality(input);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.quality,null);
  assert.equal(r.actualLandings,"UNAVAILABLE");
 }
});
test("R2-1-16 oversized source is unavailable without source echo",()=>{
 const r=inspectD43R2AltitudeQuality({sourceText:"REG_SECRET"+"x".repeat(2_000_001)});
 assert.equal(r.status,"UNAVAILABLE");
 assert.equal(r.reason,"SOURCE_LIMIT");
 assert.equal(JSON.stringify(r).includes("REG_SECRET"),false);
});
test("R2-1-17 no output may reveal UTC, coordinates, altitude, token or registration",()=>{
 const text=source([0,5,10,15,20],[7000,7000,7000,7000,7000])
  .replace("<kml ","<kml id=\"REG_SECRET\" ");
 const r=inspectD43R2AltitudeQuality({sourceText:text});
 const data=JSON.stringify(r);
 for(const secret of [
  "REG_SECRET","2026-10-19","50.123456789","14.987654321",
  "06:00:00","7000",
 ])assert.equal(data.includes(secret),false,secret);
});
test("R2-1-18 research data does not enable native V2 multi-block ingestion",()=>{
 const text=kml([[pt(0),pt(5),pt(10)],[pt(15),pt(20),pt(25)]]);
 ok(text);
 const v2=inspectGpsV2HorizontalTrack({
  sourceText:text,fileName:"private.kml",canonicalPoints:parseKml(text),
  splitCuts:[],
 });
 assert.equal(v2.status,"UNAVAILABLE");
 assert.equal(v2.reason,"UNSUPPORTED_SOURCE");
});
test("R2-1-19 diagnostic is deterministic and needs no candidate",()=>{
 const text=source([0,5,10,15,20]);
 const a=inspectD43R2AltitudeQuality({sourceText:text});
 const b=inspectD43R2AltitudeQuality({sourceText:text});
 assert.deepEqual(a,b);
 assert.equal(a.status,"SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY");
});
test("R2-1-20 research module static no I/O, network or production imports",()=>{
 const module=readFileSync("research/gps-detection-r21/stage-d43-r2-altitude-quality.ts","utf8");
 for(const banned of [
  /\bfetch\s*\(/,/\bwriteFileSync\s*\(/,/\bprocess\.env\b/,
  /\bactualLandings:\s*[0-9]/,/https?:\/\//,
 ])assert.doesNotMatch(module,banned);
 for(const file of [
  "lib/track-processing.ts","lib/gps-v2-advisory.ts",
  "research/gps-detection-r21/stage-d43-r1-coverage.ts",
 ])assert.equal(readFileSync(file,"utf8").includes("stage-d43-r2-altitude-quality"),false);
});
test("R2-1-21 local CLI rejects sensitive identifier and never exposes filename",()=>{
 const args=["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  "--experimental-strip-types","tooling/gps-v2-d43-r2-quality.mjs",
  "--file","REG_SECRET_PATH.kml","--id","sample03"];
 const run=spawnSync(process.execPath,args,{encoding:"utf8"});
 assert.equal(run.status,2);
 assert.ok(run.stdout.includes("LOCAL_SOURCE_UNREADABLE"));
 assert.equal((run.stdout+run.stderr).includes("REG_SECRET_PATH"),false);
 const invalid=spawnSync(process.execPath,[
  ...args.slice(0,-1),"REG_SECRET",
 ],{encoding:"utf8"});
 assert.equal(invalid.status,2);
 assert.equal(invalid.stdout.includes("REG_SECRET"),false);
 assert.ok(invalid.stdout.includes("INVALID_CONTEXT"));
});
