import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseKml, type KmlPoint} from "../lib/track-processing.ts";
import {
  inspectD4MultiGxLineage,D4_LINEAGE_REVISION,
} from "../research/gps-detection-r21/multi-gx-track-lineage.ts";

type P={lat:number;lon:number;alt:number|null;time:string};
const utc=(seconds:number,fraction="")=>
  new Date(Date.UTC(2026,9,18,8,0,0)+seconds*1000).toISOString()
    .replace(".000Z",fraction+"Z");
const pt=(s:number,alt:number|null=140):P=>({
  lat:50.123456789,lon:14.987654321+s*0.0001,alt,time:utc(s),
});
function kml(blocks:readonly (readonly P[])[]):string {
  return '<?xml version="1.0" encoding="UTF-8"?>'+
    '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
    blocks.map(points=>'<gx:Track>'+
      points.map(p=>'<when>'+p.time+'</when>').join("")+
      points.map(p=>'<gx:coord>'+p.lon+' '+p.lat+
        (p.alt===null?"":" "+p.alt)+'</gx:coord>').join("")+
      '</gx:Track>').join("")+
    '</kml>';
}
function accepted(source:string){
  const r=inspectD4MultiGxLineage(source);
  assert.equal(r.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY",r.status==="UNAVAILABLE"?r.reason:"");
  if(r.status==="UNAVAILABLE")throw Error(r.reason);
  assert.equal(r.revision,D4_LINEAGE_REVISION);
  assert.equal(r.canAffectCanonicalFlight,false);
  assert.equal(r.physicalContact,"UNRESOLVED");
  assert.equal(r.actualLandings,"UNAVAILABLE");
  assert.equal(r.canonical.length,parseKml(source).length);
  return r;
}
test("D4-SOURCE-01 two blocks 4.9-second apart remain a hard evidence boundary",()=>{
  const source=kml([
    [pt(0),pt(5),pt(10)],
    [{...pt(15),time:utc(14.9)},pt(20),pt(25)],
  ]);
  const r=accepted(source);
  assert.equal(r.blockCount,2);
  assert.deepEqual(r.blockedEdges,[2]);
  assert.deepEqual(r.continuousIslands,[{first:0,last:2},{first:3,last:5}]);
  assert.deepEqual(r.blockedEdgeReasons[0].reasons,["SOURCE_BLOCK_BOUNDARY"]);
});
test("D4-SOURCE-02 35/94 second telemetry-like outages are not silently bridged",()=>{
  const r=accepted(kml([
    [pt(0),pt(5)],[pt(40),pt(45)],[pt(139),pt(144)],
  ]));
  assert.deepEqual(r.blockedEdges,[1,3]);
  assert.equal(r.continuousIslands.length,3);
  assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("D4-SOURCE-03 empty middle gx block fails closed instead of inventing motion",()=>{
  const r=inspectD4MultiGxLineage(kml([[pt(0),pt(5)],[],[pt(50),pt(55)]]));
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"MALFORMED_SOURCE");
  assert.equal(r.canonical,null);
  assert.equal(r.blockedEdges,null);
});
test("D4-SOURCE-04 unpaired timestamp/coordinate is source unavailable",()=>{
  const broken=kml([[pt(0),pt(5),pt(10)]])
    .replace("<when>"+utc(5)+"</when>","");
  const r=inspectD4MultiGxLineage(broken);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"MALFORMED_SOURCE");
});
test("D4-SOURCE-05 adjacent duplicate stays linked to its raw fix ordinal",()=>{
  const duplicate={...pt(5)};
  const r=accepted(kml([[pt(0),pt(5),duplicate,pt(10)]]));
  assert.equal(r.rawFixCount,4);
  assert.equal(r.canonicalFixCount,3);
  assert.deepEqual(r.canonical[1].retained,{blockOrdinal:0,fixOrdinal:1});
  assert.deepEqual(r.canonical[1].collapsed,[{blockOrdinal:0,fixOrdinal:2}]);
  assert.equal(r.canonical[1].altitudeConflict,false);
});
test("D4-SOURCE-05b duplicate at block boundary never conceals boundary motion",()=>{
  const overlap={...pt(5)};
  const r=accepted(kml([[pt(0),pt(5)],[overlap,pt(10),pt(15)]]));
  assert.deepEqual(r.canonical[1].collapsed,[{blockOrdinal:1,fixOrdinal:0}]);
  assert.deepEqual(r.blockedEdges,[0,1]);
  assert.ok(r.blockedEdgeReasons.every(edge=>edge.reasons.includes("CROSS_BLOCK_DEDUP")));
});
test("D4-SOURCE-06 conflicting height preserves canonical chosen fix but quarantines both edges",()=>{
  const original=pt(5,100),conflict=pt(5,150);
  const source=kml([[pt(0,120),original,conflict,pt(10,130)]]);
  const r=accepted(source);
  assert.equal(parseKml(source)[1].alt,100); // frozen legacy contract
  assert.equal(r.canonical[1].altitudeConflict,true);
  assert.deepEqual(r.blockedEdges,[0,1]);
  assert.deepEqual(r.blockedEdgeReasons[0].reasons,["ALTITUDE_CONFLICT"]);
});
test("D4-SOURCE-07 submillisecond UTC conflict refuses computable motion despite distinct points",()=>{
  const a={...pt(5),time:utc(5).replace("Z",".123456789Z")};
  const b={...pt(10),time:utc(5).replace("Z",".123456790Z")};
  assert.equal(Date.parse(a.time),Date.parse(b.time));
  const r=accepted(kml([[pt(0),a,b,pt(15)]]));
  assert.deepEqual(r.blockedEdges,[0,1,2]);
  assert.ok(r.blockedEdgeReasons[1].reasons.includes("TIMESTAMP_COLLISION"));
});
test("D4-SOURCE-08 out-of-order timestamps fail rather than silently canonical-sort",()=>{
  const source=kml([[pt(10),pt(0),pt(15)]]);
  const r=inspectD4MultiGxLineage(source);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"SOURCE_ORDER_UNAVAILABLE");
});
test("D4-SOURCE-09 null altitude remains distinct from a measured zero",()=>{
  const source=kml([[pt(0,null),pt(5,0),pt(10,140)]]);
  const r=accepted(source);
  assert.equal(r.canonicalFixCount,3);
  assert.equal(r.canonical[0].altitudeConflict,false);
  assert.equal(parseKml(source)[0].alt,null);
  assert.equal(parseKml(source)[1].alt,0);
});
test("D4-CONTRACT-01 forged caller canonical data cannot establish source parity",()=>{
  const source=kml([[pt(0),pt(5),pt(10)]]);
  const canonical=parseKml(source);
  const forged:KmlPoint[]=canonical.map(p=>({...p}));
  forged[1].alt=999;
  const r=inspectD4MultiGxLineage(source,forged);
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.reason,"CANONICAL_SOURCE_MISMATCH");
  const good=accepted(source);
  assert.equal(good.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY");
});
test("D4-CONTRACT-02 malformed XML/pseudo track remains unavailable",()=>{
  const source=kml([[pt(0),pt(5),pt(10)]]);
  const r=inspectD4MultiGxLineage(source.replace("</gx:Track>",""));
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(r.canonical,null);
  assert.equal(r.actualLandings,"UNAVAILABLE");
});
test("D4-SOURCE-10 synthetic multi-block parity: 1+large+one source islands",()=>{
  const long=Array.from({length:65},(_,i)=>pt(5+(i+1)*5));
  const r=accepted(kml([[pt(0)],long,[pt(335)]]));
  assert.equal(r.blockCount,3);
  assert.equal(r.canonicalFixCount,67);
  assert.equal(r.blockedEdges.length,2);
});
test("D4-CONTRACT-03 no raw times, positions or registration-like strings in diagnostic output",()=>{
  const source=kml([[pt(0),pt(5),pt(10)]])
    .replace("<kml ", '<kml id="OK-SECRET" ');
  const report=JSON.stringify(inspectD4MultiGxLineage(source));
  for(const secret of ["2026-10-18","50.123456789","14.987654321","OK-SECRET","08:00:00"])
    assert.equal(report.includes(secret),false,secret);
});
test("D4-CONTRACT-04 new sidecar is not used by production and has no IO or network",()=>{
  const s=readFileSync("research/gps-detection-r21/multi-gx-track-lineage.ts","utf8");
  assert.doesNotMatch(s,/\bfetch\s*\(|\bwriteFileSync\s*\(|\bprocess\.env\b|https?:\/\//);
  assert.match(s,/parseKml/);
  assert.match(s,/actualLandings:"UNAVAILABLE"/);
});
