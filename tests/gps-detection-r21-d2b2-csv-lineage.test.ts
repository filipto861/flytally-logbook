import test from "node:test";
import assert from "node:assert/strict";
import {examineStrictCsvSourceLineage,CSV_LINEAGE_PARSER_REVISION}
  from "../research/gps-detection-r21/csv-lineage.ts";

const time=(minute:number)=>"2026-10-17T10:"+String(minute).padStart(2,"0")+":00Z";
const csv=(header:string,rows:string[])=>[header,...rows].join("\n");
const m=(rows:string[])=>csv("lat,lon,altitudeM,time",rows);
const f=(rows:string[])=>csv("lat,lon,altitudeFt,time",rows);
const good=(text:string)=>{
  const result=examineStrictCsvSourceLineage(text);
  assert.equal(result.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY");
  if(result.status!=="SOURCE_PARSED_DIAGNOSTIC_ONLY")throw Error("missing lineage report");
  assert.equal(result.pilot.status,"UNAVAILABLE");
  assert.equal(result.pilot.wholeFlightLandings,"UNAVAILABLE");
  assert.equal(result.pilot.physicalContact,"UNRESOLVED");
  assert.equal(result.pilot.canAffectCanonicalFlight,false);
  assert.equal(result.sourceClaims.sensorAccuracy,"UNKNOWN");
  assert.equal(result.sourceClaims.altitudeMode,"UNKNOWN");
  assert.equal(result.sourceClaims.verticalDatum,"UNKNOWN");
  return result;
};
const denied=(text:unknown,reason:string)=>{
  const result=examineStrictCsvSourceLineage(text);
  assert.equal(result.status,"UNAVAILABLE");
  if(result.status==="UNAVAILABLE")assert.equal(result.reason,reason);
};

test("D2-B2-01 exact CSV metre header preserves measured zero and missing altitude separately",()=>{
  const r=good(m(["50,14,,"+time(0),"50.01,14.01,0,"+time(1)]));
  assert.equal(r.parserRevision,CSV_LINEAGE_PARSER_REVISION);
  assert.equal(r.sourceUnit,"m");
  assert.equal(r.conversion,"NONE");
  assert.equal(r.reorder,"UNCHANGED");
  assert.deepEqual(r.samples.map(p=>p.altM),[null,0]);
  assert.deepEqual(r.samples.map(p=>p.altitudeInput),["MISSING","DECLARED_METRIC"]);
  assert.deepEqual(r.samples.map(p=>p.sourceLine),[2,3]);
  assert.equal(r.droppedSourceLines,0);
});

test("D2-B2-02 original ft header has exact conversion but never sensor approval",()=>{
  const r=good(f(["50,14,1000,"+time(0),"50.01,14.01,0,"+time(1)]));
  assert.equal(r.sourceUnit,"ft");
  assert.equal(r.conversion,"SOURCE_HEADER_FT_TO_M_EXACT_0_3048");
  assert.equal(r.samples[0].altM,304.8);
  assert.equal(r.samples[0].altitudeInput,"CONVERTED_FEET_HEADER");
  assert.equal(r.sourceClaims.unitSemantics,"HEADER_DECLARATION_ONLY");
  assert.equal(r.pilot.status,"UNAVAILABLE");
});

test("D2-B2-03 out-of-order UTC has explicit source line-to-normalized mapping",()=>{
  const r=good(m([
    "50,14,300,"+time(3),
    "50.01,14.01,100,"+time(1),
    "50.02,14.02,200,"+time(2)
  ]));
  assert.equal(r.reorder,"SORTED_BY_EXPLICIT_UTC");
  assert.deepEqual(r.samples.map(p=>p.sourceLine),[3,4,2]);
  assert.deepEqual(r.samples.map(p=>p.normalizedIndex),[0,1,2]);
  assert.deepEqual(r.samples.map(p=>p.altM),[100,200,300]);
});

test("D2-B2-04 duplicate timestamp fails closed, no silent dedup and no fabricated index",()=>{
  denied(m(["50,14,100,"+time(0),"50.01,14.01,200,"+time(0)]),"DUPLICATE_TIMESTAMP");
  denied(m(["50,14,100,"+time(0),"50,14,100,"+time(0)]),"DUPLICATE_TIMESTAMP");
});

test("D2-B2-05 missing coordinate is rejected, not equator or Greenwich",()=>{
  denied(m([",14,100,"+time(0),"50,14,200,"+time(1)]),"INVALID_POSITION");
  denied(m(["50,,100,"+time(0),"50,14,200,"+time(1)]),"INVALID_POSITION");
  denied(m(["91,14,100,"+time(0),"50,14,200,"+time(1)]),"INVALID_POSITION");
  denied(m(["50,181,100,"+time(0),"50,14,200,"+time(1)]),"INVALID_POSITION");
});

test("D2-B2-06 invalid altitude fails but true zero and negative values remain finite",()=>{
  denied(m(["50,14,bad,"+time(0),"50,14,200,"+time(1)]),"INVALID_ALTITUDE");
  denied(m(["50,14,Infinity,"+time(0),"50,14,200,"+time(1)]),"INVALID_ALTITUDE");
  const r=good(m(["50,14,-12,"+time(0),"50.01,14.01,0,"+time(1)]));
  assert.deepEqual(r.samples.map(p=>p.altM),[-12,0]);
});

test("D2-B2-07 ambiguous/invalid dates and offsets are not silently corrected",()=>{
  denied(m(["50,14,100,2026-10-17T10:00:00","50,14,200,"+time(1)]),"INVALID_UTC");
  denied(m(["50,14,100,2026-02-30T10:00:00Z","50,14,200,"+time(1)]),"INVALID_UTC");
  denied(m(["50,14,100,2026-10-17T10:00:00+02:00","50,14,200,"+time(1)]),"INVALID_UTC");
});

test("D2-B2-08 unsupported CSV dialects and arbitrary source claims cannot grant provenance",()=>{
  denied(csv("lat,lon,altitude,time",["50,14,100,"+time(0),"50.01,14.01,200,"+time(1)]),"UNSUPPORTED_CSV_DIALECT");
  denied(m(['"50",14,100,'+time(0),"50.01,14.01,200,"+time(1)]),"UNSUPPORTED_CSV_DIALECT");
  denied(m(["50;14;100;"+time(0),"50.01,14.01,200,"+time(1)]),"UNSUPPORTED_CSV_DIALECT");
  denied({source:m(["50,14,100,"+time(0),"50.01,14.01,200,"+time(1)]),validated:true},"INVALID_SOURCE_SHAPE");
});

test("D2-B2-09 does not silently discard malformed/blank rows",()=>{
  denied(m(["50,14,100,"+time(0),"", "50.01,14.01,200,"+time(1)]),"INVALID_SOURCE_SHAPE");
  denied(m(["50,14,100,"+time(0),"50,14,200"]),"INVALID_SOURCE_SHAPE");
  denied(m(["50,14,100,"+time(0)]),"INVALID_SOURCE_SHAPE");
});

test("D2-B2-10 no output can pretend certified contact or whole-flight counts",()=>{
  const r=good(f(["50,14,1000,"+time(0),"50.01,14.01,1200,"+time(1)]));
  const asJson=JSON.stringify(r);
  assert.ok(!asJson.includes("certifiedAt"));
  assert.ok(!asJson.includes("flightId"));
  assert.ok(!asJson.includes("userId"));
  assert.ok(!asJson.includes("runwayId"));
  assert.ok(!asJson.includes('"canAffectCanonicalFlight":true'));
  assert.equal(r.pilot.canAffectCanonicalFlight,false);
});
