import test from "node:test";
import assert from "node:assert/strict";
import {parseTrackFile} from "../lib/track-processing.ts";
import {examineStrictCsvSourceLineage} from "../research/gps-detection-r21/csv-lineage.ts";

const csv=(rows:string[])=>["lat,lon,altitudeM,time",...rows].join("\n");

test("D2-B2 main rebaseline: production CSV and strict research parser retain absent versus measured zero",()=>{
  const source=csv([
    "50.10,14.10,,2026-10-18T09:00:00Z",
    "50.12,14.12,0,2026-10-18T09:01:00Z",
    "50.14,14.14,150,2026-10-18T09:02:00Z"
  ]);
  const runtime=parseTrackFile(source,"d2c-bridge.csv");
  assert.deepEqual(runtime.map(point=>point.alt),[null,0,150]);
  const evidence=examineStrictCsvSourceLineage(source);
  assert.equal(evidence.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY");
  if(evidence.status!=="SOURCE_PARSED_DIAGNOSTIC_ONLY")return;
  assert.deepEqual(evidence.samples.map(sample=>sample.altM),[null,0,150]);
  assert.deepEqual(evidence.samples.map(sample=>sample.sourceLine),[2,3,4]);
  assert.equal(evidence.pilot.status,"UNAVAILABLE");
  assert.equal(evidence.pilot.physicalContact,"UNRESOLVED");
  assert.equal(evidence.pilot.canAffectCanonicalFlight,false);
});

test("D2-B2 main rebaseline: malformed CSV coordinates are never accepted by either source path",()=>{
  const cases=[
    csv(["50.10,14.10,100,2026-10-18T09:00:00Z",",14.12,200,2026-10-18T09:01:00Z"]),
    csv(["50.10,14.10,100,2026-10-18T09:00:00Z","0x10,14.12,200,2026-10-18T09:01:00Z"]),
  ];
  for(const source of cases){
    assert.deepEqual(parseTrackFile(source,"d2c-bad.csv"),[]);
    const evidence=examineStrictCsvSourceLineage(source);
    assert.equal(evidence.status,"UNAVAILABLE");
    if(evidence.status==="UNAVAILABLE")assert.equal(evidence.reason,"INVALID_POSITION");
  }
});

test("D2-B2 main rebaseline: source declaration and conversion never confer GPS landing authority",()=>{
  const source=[
    "lat,lon,altitudeFt,time",
    "50.10,14.10,1000,2026-10-18T09:00:00Z",
    "50.12,14.12,0,2026-10-18T09:01:00Z"
  ].join("\n");
  const legacy=parseTrackFile(source,"d2c-ft.csv");
  assert.deepEqual(legacy.map(point=>point.alt),[304.8,0]);
  const evidence=examineStrictCsvSourceLineage(source);
  assert.equal(evidence.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY");
  if(evidence.status!=="SOURCE_PARSED_DIAGNOSTIC_ONLY")return;
  assert.equal(evidence.conversion,"SOURCE_HEADER_FT_TO_M_EXACT_0_3048");
  assert.equal(evidence.sourceClaims.unitSemantics,"HEADER_DECLARATION_ONLY");
  assert.equal(evidence.sourceClaims.altitudeMode,"UNKNOWN");
  assert.equal(evidence.pilot.wholeFlightLandings,"UNAVAILABLE");
  assert.equal(evidence.pilot.canAffectCanonicalFlight,false);
});
