import test from "node:test";
import assert from "node:assert/strict";
import {inspectTrackFile} from "../lib/track-processing.ts";
import {characterizeUnattestedLegacyInspection}
  from "../research/gps-detection-r21/source-provenance.ts";

// All inputs are synthetic. No real GPS, network or database reads.
const t=(i:number)=>"2026-10-17T09:0"+i+":00Z";
const csv=(header:string,lines:string[])=>[header,...lines].join("\n");
const sample=()=>inspectTrackFile(csv("lat,lon,altitude,time",[
  "50,14,,"+t(0),
  "50.01,14.01,0,"+t(1),
  "50.02,14.02,300,"+t(2)
]),"synthetic.csv");
const mustBeUnavailable=(input:unknown)=>{
  const r=characterizeUnattestedLegacyInspection(input);
  assert.equal(r.pilot.availability,"UNAVAILABLE");
  assert.equal(r.pilot.vertical,"UNAVAILABLE");
  assert.equal(r.pilot.horizontal,"UNAVAILABLE");
  assert.equal(r.pilot.eventTime,"UNAVAILABLE");
  assert.equal(r.pilot.normalizedToRawIndex,"UNAVAILABLE");
  assert.equal(r.pilot.groundContact,"UNRESOLVED");
  assert.equal(r.pilot.wholeFlightLandings,"UNAVAILABLE");
  assert.equal(r.pilot.canAffectCanonicalFlight,false);
  assert.ok(!Object.hasOwn(r,"landings"));
  assert.ok(!Object.hasOwn(r,"certifiedAt"));
  return r;
};

test("D2-B01: normalized parser result is diagnostic-only, never trusted ingestion",()=>{
  const r=mustBeUnavailable(sample());
  assert.equal(r.status,"DIAGNOSTIC_ONLY");
  if(r.status!=="DIAGNOSTIC_ONLY")throw new Error("missing diagnostic result");
  assert.equal(r.inputKind,"CALLER_SUPPLIED_NORMALIZED_INSPECTION");
  assert.equal(r.reason,"SOURCE_LINEAGE_NOT_ATTESTED");
  assert.equal(r.format,"csv");
  assert.equal(r.normalizedPointCount,3);
  // Current unsafe parser maps missing altitude to zero; its zero count is not real evidence.
  assert.equal(r.numericZeroAltitudeCount,2);
  assert.equal(r.nullAltitudeCount,0);
});

test("D2-B02: source and all transformations remain unavailable even with numeric data",()=>{
  const inspected=inspectTrackFile(csv("lat,lon,Altitude ft,time",[
    "50,14,1000,"+t(0),
    "50.01,14.01,1100,"+t(1)
  ]),"SkyDemon-synthetic.csv");
  const r=mustBeUnavailable(inspected);
  assert.equal(r.status,"DIAGNOSTIC_ONLY");
  if(r.status!=="DIAGNOSTIC_ONLY")return;
  assert.equal(r.sourceClaims.sourceUnit,"UNKNOWN");
  assert.equal(r.sourceClaims.parserRevision,"UNKNOWN");
  assert.equal(r.sourceClaims.externalSensorProvenance,"UNKNOWN");
  assert.deepEqual(Object.values(r.transformations),[
    "UNAVAILABLE","UNAVAILABLE","UNAVAILABLE","UNAVAILABLE"
  ]);
  assert.deepEqual(Object.values(r.sourceClaims),[
    "UNKNOWN","UNKNOWN","UNKNOWN","UNKNOWN","UNKNOWN","UNKNOWN","UNKNOWN"
  ]);
});

test("D2-B03: caller forged approval flag is rejected instead of unlocking UI",()=>{
  const input={...sample(),validated:true,sourceProvenanceStatus:"VALIDATED"};
  const r=mustBeUnavailable(input);
  assert.equal(r.status,"UNAVAILABLE");
  if(r.status==="UNAVAILABLE")assert.equal(r.reason,"MALFORMED_INSPECTION");
});

test("D2-B04: 'good' quality from current parser does not attest physical contact",()=>{
  const input=sample();
  const manipulated={...input,quality:{...input.quality,status:"good"}};
  const r=mustBeUnavailable(manipulated);
  assert.equal(r.status,"DIAGNOSTIC_ONLY");
});

test("D2-B05: malformed position, NaN, Infinity and absent GPS fields fail closed",()=>{
  const base=sample();
  const changes=[
    {...base,points:[{...base.points[0],lat:NaN}]},
    {...base,points:[{...base.points[0],lon:Infinity}]},
    {...base,points:[{...base.points[0],lat:91}]},
    {...base,points:[{...base.points[0],alt:NaN}]},
    {...base,points:[{...base.points[0],time:42}]},
    {...base,points:[{...base.points[0],alt:undefined}]},
    {...base,points:[{...base.points[0],validated:true}]},
    {...base,quality:null},
    {...base,format:"unknown"},
    {...base,source:"untrusted-source"},
    {format:"csv",source:"generic",points:[]}
  ];
  for(const item of changes){
    const r=mustBeUnavailable(item);
    assert.equal(r.status,"UNAVAILABLE");
  }
});

test("D2-B06: zero latitude/longitude can be genuine or parser-coerced, never trust",()=>{
  const in0=inspectTrackFile(csv("lat,lon,altitude,time",[
    ",14,200,"+t(0),
    "50,,210,"+t(1),
    "50.01,14.01,220,"+t(2)
  ]),"synthetic.csv");
  const result=mustBeUnavailable(in0);
  assert.equal(result.status,"DIAGNOSTIC_ONLY");
  if(result.status!=="DIAGNOSTIC_ONLY")return;
  assert.equal(result.zeroCoordinateCount,2);
  assert.equal(result.transformations.originalRowMapping,"UNAVAILABLE");
});

test("D2-B07: sorted/deduplicated parser output cannot claim a raw sample mapping",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,300,"+t(2),
    "50.01,14.01,100,"+t(0),
    "50.01,14.01,900,"+t(0),
    "50.02,14.02,200,"+t(1)
  ]);
  const input=inspectTrackFile(source,"synthetic.csv");
  const r=mustBeUnavailable(input);
  assert.equal(r.status,"DIAGNOSTIC_ONLY");
  if(r.status!=="DIAGNOSTIC_ONLY")return;
  assert.equal(r.normalizedPointCount,3);
  assert.equal(r.transformations.originalRowMapping,"UNAVAILABLE");
  assert.equal(r.transformations.deduplicationLineage,"UNAVAILABLE");
  assert.equal(r.transformations.originalSampleOrder,"UNAVAILABLE");
});

test("D2-B08: report never serializes raw coordinates, times, filenames or track ids",()=>{
  const input=sample();
  const r=mustBeUnavailable(input);
  const serialized=JSON.stringify(r);
  for(const secret of ["50.01","14.01",t(0),t(1),"synthetic.csv","flightId","userId","registration","row_abc"]) {
    assert.ok(!serialized.includes(secret),"leaked source marker: "+secret);
  }
  assert.equal(r.pilot.canAffectCanonicalFlight,false);
});

test("D2-B09: unknown time and altitude are not interpreted as source zeros",()=>{
  const input=inspectTrackFile(csv("lat,lon,time",[
    "50,14,",
    "50.01,14.01,"
  ]),"synthetic.csv");
  const r=mustBeUnavailable(input);
  assert.equal(r.status,"DIAGNOSTIC_ONLY");
  if(r.status!=="DIAGNOSTIC_ONLY")return;
  assert.equal(r.nullAltitudeCount,2);
  assert.equal(r.numericZeroAltitudeCount,0);
  assert.equal(r.nullTimestampCount,2);
  assert.equal(r.pilot.eventTime,"UNAVAILABLE");
});

test("D2-B10: all format labels remain untrusted for pilot-facing availability",()=>{
  for(const [file,source] of [
    ["synthetic.csv",csv("lat,lon,altitude,time",["50,14,10,"+t(0),"50.01,14.01,20,"+t(1)])],
    ["synthetic.gpx",'<gpx><trkpt lat="50" lon="14"><ele>10</ele></trkpt></gpx>'],
    ["synthetic.kml",'<kml><Placemark><Point><coordinates>14,50,10</coordinates></Point></Placemark></kml>']
  ] as const){
    const result=mustBeUnavailable(inspectTrackFile(source,file));
    assert.equal(result.status,"DIAGNOSTIC_ONLY");
  }
});
