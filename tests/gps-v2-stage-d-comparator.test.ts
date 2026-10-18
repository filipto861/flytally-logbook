import test from "node:test";
import assert from "node:assert/strict";
import {compareGpsV2StageD} from "../research/gps-detection-r21/stage-d-comparator.ts";

function sampleCsv() {
  const t = (n:number) => new Date(Date.UTC(2026, 9, 18, 11, 7, 0) + n*5000)
    .toISOString().replace(".000Z", "Z");
  const speeds = [5,5,60,60,60,5,5,5,60,60,60,5,5];
  let lon = 14.987654321;
  const rows = ["50.123456789," + lon.toFixed(9) + ",," + t(0)];
  for (let i=0;i<speeds.length;i++){
    lon += speeds[i]*5/3600/(111.1950802*Math.cos(50.123456789*Math.PI/180));
    rows.push("50.123456789," + lon.toFixed(9) + ",," + t(i+1));
  }
  return ["lat,lon,altitudeM,time",...rows].join("\n");
}
function run(sourceText=sampleCsv(),splitCuts:number[]=[]) {
  return compareGpsV2StageD({
    sourceText, fileName:"private-flight.csv", anonymousSampleId:"sample01",splitCuts
  });
}
test("D1-01 comparable source emits only diagnostic hypotheses and unknown actuals",()=>{
  const report=run();
  assert.equal(report.status,"DIAGNOSTIC_ONLY");
  if(report.status!=="DIAGNOSTIC_ONLY")return;
  assert.equal(report.actualTouchAndGoes,"UNKNOWN");
  assert.equal(report.actualFullStops,"UNKNOWN");
  assert.equal(report.groundTruthComparison,"NOT_EVALUATED");
  assert.equal(report.canAffectCanonicalFlight,false);
  assert.equal(report.physicalContact,"UNRESOLVED");
  assert.equal(report.legacy.authority,"UNVERIFIED_HYPOTHESES");
  assert.equal(report.v2.wholeFlightLandings,"UNAVAILABLE");
});
test("D1-02 diagnostics do not disclose source, path, positions or absolute timestamps",()=>{
  const report=run(), serialized=JSON.stringify(report);
  for(const secret of ["private-flight.csv","50.123456789","14.987654321","2026-10-18","11:07:00Z"])
    assert.equal(serialized.includes(secret),false,secret);
  assert.equal(serialized.includes("relativeSeconds"),true);
});
test("D1-03 invalid split and unsupported content fail closed, not empty landings",()=>{
  const invalid=run(sampleCsv(),[6,6]);
  assert.equal(invalid.status,"UNAVAILABLE");
  assert.equal(invalid.reason,"INVALID_SPLIT");
  assert.equal(invalid.legacy,null);
  assert.equal(invalid.v2,null);
  const mismatched=compareGpsV2StageD({
    sourceText:sampleCsv(),fileName:"not-really.gpx",anonymousSampleId:"sample02"
  });
  assert.equal(mismatched.status,"UNAVAILABLE");
  assert.equal(mismatched.legacy,null);
  assert.equal(mismatched.actualTouchAndGoes,"UNKNOWN");
});
test("D1-04 source without a valid time origin cannot generate timing suggestions",()=>{
  const noTime='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<gx:coord>14.0001 50.0001 100</gx:coord><gx:coord>14.0002 50.0002 100</gx:coord>'+
    '</gx:Track></kml>';
  const report=compareGpsV2StageD({sourceText:noTime,fileName:"sample.kml"});
  assert.equal(report.status,"UNAVAILABLE");
  assert.equal(report.reason,"NO_VALID_TIME_BASELINE");
  assert.equal(report.legacy,null);
});
test("D1-05 no raw context can be smuggled through sample id",()=>{
  const report=compareGpsV2StageD({
    sourceText:sampleCsv(),fileName:"private.csv",anonymousSampleId:"50.12345 / pilot"
  });
  assert.equal(report.status,"UNAVAILABLE");
  assert.equal(report.reason,"INVALID_SAMPLE_ID");
  assert.equal(report.sample,null);
});
