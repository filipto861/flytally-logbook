import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {parseKml,touchAndGoEvents} from "../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack} from "../lib/gps-v2-advisory.ts";
import {
 inspectD43R2LegacyShapeAudit,d43R2ShapeLocalBinding,
 D43_R2_SHAPE_AUDIT_REVISION,
} from "../research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts";

type P={time:string;lat:number;lon:number;alt:number|null};
function utc(s:number):string{
 return new Date(Date.UTC(2026,9,19,6)+s*1000).toISOString().replace(".000Z","Z");
}
function point(i:number,h:number|null,seconds=i*5):P{
 return {lat:50.123456789,lon:14.987654321+i*0.001,alt:h,time:utc(seconds)};
}
function kml(blocks:readonly (readonly P[])[]):string{
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  blocks.map(block=>'<gx:Track>'+
   block.map(p=>'<when>'+p.time+'</when>').join("")+
   block.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
    (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
   '</gx:Track>').join("")+'</kml>';
}
const altitudes=[300,300,300,300,295,280,260,240,220,200,180,190,210,240,270,300,310,320,330,350,350,350];
function track(overrides:Readonly<Record<number,number|null>>={},timeOverrides:Readonly<Record<number,number>>={}):P[]{
 return altitudes.map((h,i)=>point(i,Object.hasOwn(overrides,i)?overrides[i]:h,
   Object.hasOwn(timeOverrides,i)?timeOverrides[i]:i*5));
}
const src=(p:readonly P[])=>kml([p]);
function accepted(sourceText:string,splitCuts:number[]=[]){
 const result=inspectD43R2LegacyShapeAudit({sourceText,splitCuts});
 if(result.status==="UNAVAILABLE")throw Error(result.reason);
 assert.equal(result.revision,D43_R2_SHAPE_AUDIT_REVISION);
 assert.equal(result.status,"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY");
 assert.equal(result.canAffectCanonicalFlight,false);
 assert.equal(result.physicalContact,"UNRESOLVED");
 assert.equal(result.actualLandings,"UNAVAILABLE");
 assert.equal(result.recencyEvidence,"UNAVAILABLE");
 assert.equal(result.comparison.referenceStatus,"SHADOW_LEGACY_PARITY_VERIFIED");
 assert.equal(result.comparison.geometryWindowMeaning,"SOURCE_PATTERNS_NOT_LANDINGS");
 return result.comparison;
}

test("R2-2-01 clean anchored shape matches frozen legacy emitted altitude indices",()=>{
 const source=src(track());
 const actual=touchAndGoEvents(parseKml(source)).filter(x=>x.signal==="altitude");
 assert.ok(actual.length>0,"fixture must exercise at least one frozen rolling-altitude emission");
 const c=accepted(source);
 assert.equal(c.legacyEmittedAltitudeProposals,actual.length);
 assert.ok(c.legacyPreGroupEligibleWindows>=c.legacyGroupedAltitudeShapes);
 assert.equal(c.inSpanDerivativeRejectedWindows,0);
});
test("R2-2-02 geometry patterns are counted, never physical contacts",()=>{
 const c=accepted(src(track()));
 assert.ok(c.geometryWindows>0);
 assert.equal(c.geometryWindowMeaning,"SOURCE_PATTERNS_NOT_LANDINGS");
});
test("R2-2-03 30m descent/climb anchors absent yields no geometry",()=>{
 const p=track();
 const flat=p.map(x=>({...x,alt:200}));
 const c=accepted(src(flat));
 assert.equal(c.geometryWindows,0);
 assert.equal(c.legacyEmittedAltitudeProposals,0);
});
test("R2-2-04 a timed intermediate climb is required",()=>{
 const p=track();
 // At fixed minimum, the next point is identical altitude, and the
 // first rising sample is already the +30m anchor.
 p[11]={...p[11],alt:180};
 const c=accepted(src(p));
 assert.ok(c.geometryWindows>0);
 assert.ok(c.intermediateClimbRejectedWindows>0);
});
test("R2-2-05 in-span >25m/s remains rejection, not recovered event",()=>{
 const p=track({8:480});
 const c=accepted(src(p));
 assert.ok(c.geometryWindows>0);
 assert.ok(c.inSpanDerivativeRejectedWindows>0);
});
test("R2-2-06 unrelated out-of-span altitude spike does not poison clean reference span",()=>{
 const p=track({1:600});
 const c=accepted(src(p));
 assert.ok(c.geometryWindows>0);
 // The true min's nearest qualifying descent anchor is near the min,
 // so a corruption at index 1 is outside that specific anchor span.
 assert.ok(c.legacyEmittedAltitudeProposals>0);
});
test("R2-2-07 source boundary inside a geometry window is quality-affected, not bridged",()=>{
 const p=track();
 const c=accepted(kml([p.slice(0,10),p.slice(10)]));
 assert.ok(c.geometryWindows>0);
 assert.ok(c.sourceQualityAffectedWindows>0);
});
test("R2-2-08 explicit manual cut partitions the frozen legacy scan",()=>{
 const p=track();
 const baseline=accepted(src(p));
 assert.ok(baseline.legacyEmittedAltitudeProposals>0);
 const split=accepted(src(p),[10]);
 assert.equal(split.legacyEmittedAltitudeProposals,0);
});
test("R2-2-09 long >15s interval stays a source-quality caveat",()=>{
 const p=track();
 for(let i=9;i<p.length;i++)p[i]={...p[i],time:utc(i*5+25)};
 const c=accepted(src(p));
 assert.ok(c.geometryWindows>0);
 assert.ok(c.over15sIntervalWindows>0);
});
test("R2-2-10 provenance cross-block dedup cannot be silently trusted",()=>{
 const p=track();
 const duplicate={...p[9]};
 const c=accepted(kml([p.slice(0,10),[duplicate,...p.slice(10)]]));
 assert.ok(c.sourceQualityAffectedWindows>0);
});
test("R2-2-11 zero and missing altitude are different; no fake zero minimum",()=>{
 const p=track({10:null});
 const c=accepted(src(p));
 const q=accepted(src(track({10:0})));
 assert.ok(q.geometryWindows>0);
 // A null height cannot silently become a synthetic numeric-zero minimum.
 assert.ok(c.geometryWindows<=q.geometryWindows);
 assert.notEqual(c.legacyEmittedAltitudeProposals,q.legacyEmittedAltitudeProposals);
});
test("R2-2-12 no result may contain route, raw UTC, source height, registration or fingerprints",()=>{
 const text=src(track()).replace("<kml ","<kml id=\"REG_SECRET\" ");
 const data=JSON.stringify(inspectD43R2LegacyShapeAudit({sourceText:text}));
 for(const secret of ["REG_SECRET","2026-10-19","50.123456789",
   "14.987654321","06:00:00","480","sha256"])
  assert.equal(data.includes(secret),false,secret);
});
test("R2-2-13 token tracks exact source and validated split identity",()=>{
 const text=src(track());
 const binding=d43R2ShapeLocalBinding({sourceText:text,uploadRevision:"v1"});
 const good=inspectD43R2LegacyShapeAudit({sourceText:text,uploadRevision:"v1",expectedBinding:binding});
 assert.equal(good.status,"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY");
 for(const changed of [
  {sourceText:text+" ",uploadRevision:"v1"},
  {sourceText:text,uploadRevision:"v2"},
  {sourceText:text,uploadRevision:"v1",splitRevision:"new"},
  {sourceText:text,splitCuts:[10],uploadRevision:"v1"},
 ]){
  const result=inspectD43R2LegacyShapeAudit({...changed,expectedBinding:binding});
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.reason,"STALE_CONTEXT");
 }
});
test("R2-2-14 invalid, oversized, unordered and unsupported input fails closed",()=>{
 const good=src(track());
 for(const input of [
  null,{sourceText:good,forgedLandings:5},
  {sourceText:good,splitCuts:[0]},
  {sourceText:good,splitCuts:[10,10]},
  {sourceText:"NOT_KML"},
  {sourceText:"PRIVATE"+"x".repeat(2_000_001)},
  {sourceText:kml([[point(2,100),point(1,120),point(3,100)]])},
 ]){
  const result=inspectD43R2LegacyShapeAudit(input);
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.comparison,null);
  assert.equal(result.actualLandings,"UNAVAILABLE");
 }
});
test("R2-2-15 deterministic and bounded aggregate-only report",()=>{
 const text=src(track());
 assert.deepEqual(inspectD43R2LegacyShapeAudit({sourceText:text}),
  inspectD43R2LegacyShapeAudit({sourceText:text}));
 const c=accepted(text);
 assert.ok(c.geometryWindows<=parseKml(text).length);
});
test("R2-2-16 original native V2 source constraints unchanged",()=>{
 const text=kml([track().slice(0,12),track().slice(12)]);
 const r=inspectD43R2LegacyShapeAudit({sourceText:text});
 assert.equal(r.status,"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY");
 const native=inspectGpsV2HorizontalTrack({
  sourceText:text,fileName:"private.kml",canonicalPoints:parseKml(text),splitCuts:[],
 });
 assert.equal(native.status,"UNAVAILABLE");
 assert.equal(native.reason,"UNSUPPORTED_SOURCE");
});
test("R2-2-17 no production import, persistence, outbound network or raw logging",()=>{
 const path="research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts";
 const code=readFileSync(path,"utf8");
 for(const rule of [/\bfetch\s*\(/,/\bwriteFileSync\s*\(/,/\bprocess\.env\b/,
  /console\.(?:log|error)\s*\(/,/\bactualLandings:\s*\d/])
  assert.doesNotMatch(code,rule);
 for(const entry of ["lib/track-processing.ts","lib/gps-v2-advisory.ts"]){
  assert.equal(readFileSync(entry,"utf8").includes("stage-d43-r2-2-legacy-shape-audit"),false);
 }
});
test("R2-2-18 CLI fails private filename/identifier closed without echo",()=>{
 const f="REG_SECRET_LOCATION.kml";
 const args=["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON","--experimental-strip-types",
  "tooling/gps-v2-d43-r2-2-shape-audit.mjs","--file",f,"--id","sample07"];
 const bad=spawnSync(process.execPath,args,{encoding:"utf8"});
 assert.equal(bad.status,2);
 assert.ok(bad.stdout.includes("LOCAL_SOURCE_UNREADABLE"));
 assert.equal((bad.stdout+bad.stderr).includes(f),false);
 const invalid=spawnSync(process.execPath,[
  ...args.slice(0,-1),"REG_SECRET"
 ],{encoding:"utf8"});
 assert.equal(invalid.status,2);
 assert.ok(invalid.stdout.includes("INVALID_CONTEXT"));
 assert.equal((invalid.stdout+invalid.stderr).includes("REG_SECRET"),false);
});
