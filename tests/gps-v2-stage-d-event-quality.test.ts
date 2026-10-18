import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {type KmlPoint, touchAndGoEvents} from "../lib/track-processing.ts";
import {inspectLegacyProposalQuality} from "../research/gps-detection-r21/stage-d-event-quality.ts";

function syntheticRollingTouchAndGo():KmlPoint[]{
  const lat=50.987654321;
  let lon=14.123456789;
  const result:KmlPoint[]=[];
  for(let i=0;i<33;i++){
    if(i>0)lon+=(70*5/3600)/(111.1950802*Math.cos(lat*Math.PI/180));
    result.push({
      lat,lon,alt:100+Math.abs(16-i)*5,
      time:new Date(Date.UTC(2026,9,18,11,7,0)+5000*i).toISOString(),
    });
  }
  return result;
}
test("D2-01 known smooth rolling shape yields source-quality context, never wheel-contact authority",()=>{
  const points=syntheticRollingTouchAndGo();
  const legacy=touchAndGoEvents(points);
  assert.ok(legacy.some(p=>p.signal==="altitude"));
  const quality=inspectLegacyProposalQuality(points);
  assert.equal(quality.status,"DIAGNOSTIC_ONLY");
  assert.equal(quality.canAffectCanonicalFlight,false);
  assert.equal(quality.physicalContact,"UNRESOLVED");
  assert.ok(quality.proposals && quality.proposals.length>=1);
  const at=quality.proposals!.find(p=>p.signal==="altitude");
  assert.ok(at);
  assert.equal(at?.altitude.status,"SOURCE_ALTITUDE_SHAPE_ONLY");
  if(at?.altitude.status==="SOURCE_ALTITUDE_SHAPE_ONLY"){
    assert.ok((at.altitude.prior10MaxHeightAboveCandidateM??0)>=30);
    assert.ok((at.altitude.next10MaxHeightAboveCandidateM??0)>=30);
    assert.ok((at.altitude.qualifyingSpanSeconds??0)>0);
    assert.equal(at.altitude.qualifyingSpanEdgeQuality?.sourceAltitudeRateAbove25,0);
  }
});
test("D2-02 detailed quality report never contains original coordinates or absolute GPS times",()=>{
  const points=syntheticRollingTouchAndGo();
  const text=JSON.stringify(inspectLegacyProposalQuality(points));
  for(const secret of ["50.987654321","14.123456789","2026-10-18","11:07:00.000Z"])
    assert.equal(text.includes(secret),false,secret);
  assert.ok(text.includes("relativeSeconds"));
  assert.ok(!text.includes("altitudeM\":100"));
});
test("D2-03 missing timing cannot silently claim no movements",()=>{
  const points=syntheticRollingTouchAndGo().map(p=>({...p,time:null}));
  const report=inspectLegacyProposalQuality(points);
  assert.equal(report.status,"UNAVAILABLE");
  assert.equal(report.proposals,null);
  assert.equal(report.canAffectCanonicalFlight,false);
});
test("D2-04 diagnostic remains source quality, not event truth, with measured zero altitude",()=>{
  const points=syntheticRollingTouchAndGo().map(p=>({...p,alt:0}));
  const report=inspectLegacyProposalQuality(points);
  assert.equal(report.status,"DIAGNOSTIC_ONLY");
  assert.deepEqual(report.proposals,[]);
  assert.equal(report.physicalContact,"UNRESOLVED");
});
test("D2-05 no network, database, writes, or raw-source echo paths in the new probe",()=>{
  const code=readFileSync("tooling/gps-v2-stage-d-quality.mjs","utf8");
  assert.doesNotMatch(code,/\bfetch\s*\(|https?:\/\/|\bwriteFileSync\s*\(|\bcreateWriteStream\s*\(|\bprocess\.env\./);
  assert.match(code,/parseTrackFile/);
  assert.match(code,/compareGpsV2StageD/);
});
