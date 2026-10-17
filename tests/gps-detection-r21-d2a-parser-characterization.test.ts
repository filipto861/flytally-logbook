import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectTrackFile, parseTrackFile, splitPoints, trackStats
} from "../lib/track-processing.ts";
import {
  analyzeResearchTrack, assessSourceQuality,
  type SourceMetadata
} from "../research/gps-detection-r21/detector.ts";

/**
 * R2.1c-D2-A CHARACTERIZATION ONLY. All inputs are synthetic.
 * A PASS proves only that the code behaves as observed; "KNOWN UNSAFE"
 * asserts reproduce bugs and MUST BE REPLACED by safety assertions after
 * separately reviewed production fixes. Passing is NOT source approval.
 */
const csv = (header:string, rows:string[]) => [header,...rows].join("\n");
const utc = (minute:number) => "2026-10-17T08:"+String(minute).padStart(2,"0")+":00Z";
const unknownMetadata = ():SourceMetadata=>({
  altitudeMode:{status:"UNKNOWN"},
  altitudeUnit:{status:"UNKNOWN"},
  verticalDatum:{status:"UNKNOWN"},
  horizontalAccuracyM:{status:"UNKNOWN"},
  verticalAccuracyM:{status:"UNKNOWN"},
  sourceFormat:{status:"UNKNOWN"},
  generator:{status:"UNKNOWN"},
  sensorOrigin:{status:"UNKNOWN"},
  timestampPrecisionMs:{status:"UNKNOWN"}
});

test("D2-A01 CHARACTERIZATION / KNOWN UNSAFE: CSV blank altitude currently becomes numeric zero",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,,"+utc(0),
    "50.01,14.01,0,"+utc(1),
    "50.02,14.02,321,"+utc(2)
  ]);
  assert.match(source.split("\n")[1],/^50,14,,/);
  const parsed=parseTrackFile(source,"synthetic.csv");
  assert.equal(parsed.length,3);
  assert.equal(parsed[0].alt,0,"KNOWN UNSAFE: blank source cell is parsed as measured zero");
  assert.equal(parsed[1].alt,0,"explicit measured zero is now indistinguishable from blank");
  assert.equal(parsed[2].alt,321);
  assert.notEqual(parsed[0].alt,null,"DO NOT interpret this current behavior as approved");
});

test("D2-A02 CHARACTERIZATION: CSV altitudeFeet is converted by 0.3048 without provenance return",()=>{
  const rows=[
    "50,14,1000,"+utc(0),
    "50.01,14.01,0,"+utc(1)
  ];
  const feet=inspectTrackFile(csv("lat,lon,Altitude Feet,time",rows),"synthetic.csv");
  const metres=inspectTrackFile(csv("lat,lon,Altitude Meters,time",rows),"synthetic.csv");
  assert.equal(feet.format,"csv");
  assert.equal(feet.points[0].alt,304.8);
  assert.equal(metres.points[0].alt,1000);
  assert.equal(feet.points[1].alt,0);
  assert.deepEqual(Object.keys(feet).sort(),["format","points","quality","source"]);
  assert.equal(Object.hasOwn(feet,"altitudeConversion"),false);
  assert.equal(Object.hasOwn(feet.points[0],"rawAltitudeUnit"),false);
});

test("D2-A03 CHARACTERIZATION: valid UTC points are sorted, not raw-order indexed",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,300,"+utc(3),
    "50.01,14.01,100,"+utc(1),
    "50.02,14.02,200,"+utc(2)
  ]);
  const parsed=parseTrackFile(source,"synthetic.csv");
  assert.deepEqual(parsed.map(p=>p.time),[utc(1),utc(2),utc(3)]);
  assert.deepEqual(parsed.map(p=>p.alt),[100,200,300]);
  assert.equal(parsed[0].lat,50.01);
  assert.equal(Object.hasOwn(parsed[0],"sourceRow"),false);
});

test("D2-A04 CHARACTERIZATION: duplicate position+time discards conflicting raw altitude",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,100,"+utc(0),
    "50,14,900,"+utc(0),
    "50.01,14.01,200,"+utc(1)
  ]);
  const parsed=parseTrackFile(source,"synthetic.csv");
  assert.equal(parsed.length,2);
  assert.deepEqual(parsed.map(p=>p.alt),[100,200]);
  assert.ok(!parsed.some(p=>p.alt===900));
  assert.equal(Object.hasOwn(parsed[0],"rawOrdinals"),false);
});

test("D2-A05 CHARACTERIZATION: GPX/KML absent altitude is null, explicit zero is zero",()=>{
  const gpx='<gpx><trk><trkseg>'+
    '<trkpt lat="50" lon="14"><time>'+utc(0)+'</time></trkpt>'+
    '<trkpt lat="50.01" lon="14.01"><ele>0</ele><time>'+utc(1)+'</time></trkpt>'+
    '</trkseg></trk></gpx>';
  const gp=parseTrackFile(gpx,"synthetic.gpx");
  assert.equal(gp.length,2);
  assert.equal(gp[0].alt,null);
  assert.equal(gp[1].alt,0);
  const kml='<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track>'+
    '<when>'+utc(0)+'</when><when>'+utc(1)+'</when>'+
    '<gx:coord>14 50</gx:coord><gx:coord>14.01 50.01 0</gx:coord>'+
    '</gx:Track></kml>';
  const kp=parseTrackFile(kml,"synthetic.kml");
  assert.equal(kp.length,2);
  assert.equal(kp[0].alt,null);
  assert.equal(kp[1].alt,0);
  assert.equal(Object.hasOwn(kp[0],"altitudeMode"),false);
});

test("D2-A06 CHARACTERIZATION: caller-declared KNOWN does not attest sensor origin",()=>{
  const unknown=assessSourceQuality(unknownMetadata());
  assert.equal(unknown.vertical.status,"UNVERIFIED");
  assert.equal(unknown.vertical.datum,"UNKNOWN");
  const forged=unknownMetadata();
  forged.altitudeUnit={status:"KNOWN",value:"m"};
  forged.altitudeMode={status:"KNOWN",value:"absolute"};
  forged.verticalDatum={status:"KNOWN",value:"caller claims verified MSL"};
  forged.verticalAccuracyM={status:"KNOWN",value:0};
  const report=assessSourceQuality(forged);
  assert.equal(report.vertical.status,"RELATIVE_CHANGE_ONLY");
  assert.equal(report.vertical.datum,"DECLARED_NOT_VERIFIED");
  assert.equal(report.runwayProximity,"UNAVAILABLE");
  assert.equal(Object.hasOwn(report,"sourceAuthenticated"),false);
});

test("D2-A07 CHARACTERIZATION: absent timestamps and bad coordinates cannot form valid quality island",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,300,",
    "120,14,310,",
    "50.01,14.01,320,"
  ]);
  const points=parseTrackFile(source,"synthetic.csv");
  assert.equal(points.length,2,"out-of-range latitude is discarded, without raw index mapping");
  assert.deepEqual(points.map(p=>p.time),[null,null]);
  const analyzed=analyzeResearchTrack(points.map((p,ordinal)=>({...p,ordinal})));
  assert.deepEqual(analyzed.edges.map(e=>e.reason),["MISSING_TIME"]);
  assert.deepEqual(analyzed.candidates,[]);
  assert.equal(analyzed.patternCount.status,"UNAVAILABLE");
});

test("D2-A08 CHARACTERIZATION: split-local sample indices are not raw-file identities",()=>{
  const source=csv("lat,lon,altitude,time",[
    "50,14,300,"+utc(3),
    "50.01,14.01,100,"+utc(0),
    "50.02,14.02,200,"+utc(1),
    "50.03,14.03,250,"+utc(2)
  ]);
  const normalized=parseTrackFile(source,"synthetic.csv");
  assert.deepEqual(normalized.map(p=>p.alt),[100,200,250,300]);
  const parts=splitPoints(normalized,[1]);
  assert.deepEqual(parts.map(part=>part.length),[2,2]);
  assert.equal(parts[1][0].alt,normalized[2].alt);
  assert.notEqual(parts[1][0].alt,normalized[0].alt);
  assert.equal(Object.hasOwn(parts[1][0],"sourceRow"),false);
});

test("D2-A09 CHARACTERIZATION / KNOWN UNSAFE: empty CSV latitude/longitude may become zero",()=>{
  const source=csv("lat,lon,altitude,time",[
    ",14,200,"+utc(0),
    "50,,210,"+utc(1),
    "50.01,14.01,220,"+utc(2)
  ]);
  const parsed=parseTrackFile(source,"synthetic.csv");
  assert.equal(parsed.length,3,"KNOWN UNSAFE: missing coordinate may be treated as numeric zero");
  assert.equal(parsed[0].lat,0);
  assert.equal(parsed[1].lon,0);
  assert.equal(parsed[2].alt,220);
  // No value in the output distinguishes 0 from a blank source coordinate.
  assert.equal(Object.hasOwn(parsed[0],"coordinatePresent"),false);
});

test("D2-A10 CHARACTERIZATION / KNOWN SEMANTIC LOSS: stats exclude true zero altitude",()=>{
  const points=parseTrackFile(csv("lat,lon,altitude,time",[
    "50,14,0,"+utc(0),
    "50.01,14.01,0,"+utc(1)
  ]),"synthetic.csv");
  assert.deepEqual(points.map(p=>p.alt),[0,0]);
  const stats=trackStats(points);
  assert.equal(stats.minAlt,null,"CURRENT behavior excludes valid numeric zero");
  assert.equal(stats.maxAlt,null,"CURRENT behavior excludes valid numeric zero");
  assert.equal(stats.pointCount,2);
});
