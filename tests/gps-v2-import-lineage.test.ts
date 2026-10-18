import test from "node:test";
import assert from "node:assert/strict";
import {parseTrackFile} from "../lib/track-processing.ts";
import {
  GPS_V2_IMPORT_LINEAGE_REVISION,inspectGpsV2SourceLineage
} from "../lib/gps-v2-import-lineage.ts";
import {inspectGpsV2HorizontalTrack} from "../lib/gps-v2-advisory.ts";

const speeds=[5,5,60,60,60,5,5,5,60,60,60,5,5];
const lat=50;
const STEP=5;
function rawFixes(){
  let lon=14;
  return [0,...speeds].map((_,i)=>{
    if(i>0)lon+=speeds[i-1]*STEP/3600/(111.1950802*Math.cos(lat*Math.PI/180));
    const time=new Date(Date.UTC(2026,9,18,10,0,i*STEP)).toISOString().replace(".000Z","Z");
    return {lat,lon:+lon.toFixed(9),alt:i%3===0?0:150,time};
  });
}
const fixes=rawFixes();
const gpx=(points=fixes)=>'<gpx version="1.1"><trk><trkseg>'+
  points.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.alt}</ele><time>${p.time}</time></trkpt>`).join("")+
  '</trkseg></trk></gpx>';
const kml=(points=fixes)=>'<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><Placemark><gx:Track>'+
  points.map(p=>`<when>${p.time}</when>`).join("")+
  points.map(p=>`<gx:coord>${p.lon} ${p.lat} ${p.alt}</gx:coord>`).join("")+
  '</gx:Track></Placemark></kml>';
const sky=(points=fixes)=>[
  "Latitude,Longitude,Altitude ft,UTC Date,UTC Time,Note",
  ...points.map((p,i)=>`${p.lat},${p.lon},${p.alt===0?"0":(p.alt/0.3048).toFixed(6)},${p.time.slice(0,10)},${p.time.slice(11)},${i===0?'"start, apron"':"flight"}`)
].join("\n");
const strict=(points=fixes)=>[
  "lat,lon,altitudeM,time",...points.map(p=>`${p.lat},${p.lon},${p.alt},${p.time}`)
].join("\n");
function inspect(sourceText:string,fileName:string,splitCuts:number[]=[]){
  return inspectGpsV2HorizontalTrack({
    sourceText,fileName,canonicalPoints:parseTrackFile(sourceText,fileName),splitCuts
  });
}
const cases=[
  {name:"strict",file:"track.csv",source:strict(),kind:"STRICT_CSV"},
  {name:"SkyDemon",file:"SkyDemon_track.csv",source:sky(),kind:"SKYDEMON_CSV"},
  {name:"GPX",file:"track.gpx",source:gpx(),kind:"GPX_TRACK"},
  {name:"gx Track KML",file:"track.kml",source:kml(),kind:"KML_GX_TRACK"}
] as const;

test("V2-F1 four verified source formats map every raw point to exact canonical normalized index",()=>{
  for(const c of cases){
    const parsed=inspectGpsV2SourceLineage(c.source,c.file);
    assert.equal(parsed.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY",c.name);
    if(parsed.status!=="SOURCE_PARSED_DIAGNOSTIC_ONLY")continue;
    assert.equal(parsed.kind,c.kind);
    const canonical=parseTrackFile(c.source,c.file);
    assert.equal(parsed.samples.length,fixes.length,c.name);
    assert.equal(canonical.length,fixes.length,c.name);
    for(let i=0;i<fixes.length;i++){
      assert.deepEqual(parsed.samples[i],{
        lat:canonical[i].lat,lon:canonical[i].lon,
        altM:canonical[i].alt,utc:canonical[i].time
      },`${c.name} index ${i}`);
    }
    assert.equal(parsed.parserRevision,
      c.kind==="STRICT_CSV"?"R21_D2B2_CSV_SUBSET_V1":GPS_V2_IMPORT_LINEAGE_REVISION);
  }
});

test("V2-F2 all verified source formats can yield only horizontal unresolved stop-go review",()=>{
  for(const c of cases){
    const r=inspect(c.source,c.file);
    assert.equal(r.status,"ADVISORY_ONLY",c.name);
    assert.ok(r.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),c.name);
    assert.equal(r.wholeFlightLandings,"UNAVAILABLE");
    assert.equal(r.canAffectCanonicalFlight,false);
    assert.equal(r.physicalContact,"UNRESOLVED");
    assert.equal(r.altitudeMode,"UNKNOWN");
    assert.ok(r.events.every(e=>e.basis==="OBSERVED_HORIZONTAL_MOTION_ONLY"));
  }
});

test("V2-F3 malformed GPX fix cannot be silently skipped by canonical parser",()=>{
  const broken=gpx().replace('lat="50" lon="14"','lat="" lon="14"');
  const result=inspect(broken,"track.gpx");
  assert.equal(result.status,"UNAVAILABLE");
  assert.deepEqual(result.events,[]);
});

test("V2-F4 missing GPX time does not become observed zero or an invented event",()=>{
  const broken=gpx().replace("<time>2026-10-18T10:00:00Z</time>","");
  const result=inspect(broken,"track.gpx");
  assert.equal(result.status,"UNAVAILABLE");
  assert.deepEqual(result.events,[]);
});

test("V2-F5 multiple GPX recording segments are unsupported without segment continuity",()=>{
  const source=gpx().replace("</trkseg>","</trkseg><trkseg></trkseg>");
  const result=inspect(source,"track.gpx");
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.reason,"UNSUPPORTED_SOURCE");
});

test("V2-F6 KML gx Track requires equal number of timestamps and coordinates",()=>{
  const broken=kml().replace("<when>2026-10-18T10:00:00Z</when>","");
  const result=inspect(broken,"track.kml");
  assert.equal(result.status,"UNAVAILABLE");
  assert.deepEqual(result.events,[]);
});

test("V2-F7 multiple KML tracks require segmentation proof and stay unavailable",()=>{
  const extra="<gx:Track><when>2026-10-18T10:10:00Z</when><gx:coord>14 50 0</gx:coord></gx:Track>";
  const broken=kml().replace("</Placemark>",extra+"</Placemark>");
  const result=inspect(broken,"track.kml");
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.reason,"UNSUPPORTED_SOURCE");
});

test("V2-F8 real-like quoted SkyDemon note with comma never shifts columns",()=>{
  const source=sky();
  assert.match(source,/"start, apron"/);
  const result=inspect(source,"SkyDemon_track.csv");
  assert.equal(result.status,"ADVISORY_ONLY");
  assert.ok(result.events.length>0);
});

test("V2-F9 malformed SkyDemon coordinate is not dropped into a plausible route",()=>{
  const broken=sky().replace("50,14,0,",",14,0,");
  const result=inspect(broken,"SkyDemon_track.csv");
  assert.equal(result.status,"UNAVAILABLE");
  assert.deepEqual(result.events,[]);
});

test("V2-F10 duplicate UTC in any supported source format fails closed",()=>{
  for(const c of cases){
    const bad=c.kind==="SKYDEMON_CSV"?
      c.source.replace("2026-10-18,10:00:05Z","2026-10-18,10:00:00Z"):
      c.source.replace("2026-10-18T10:00:05Z","2026-10-18T10:00:00Z");
    const result=inspect(bad,c.file);
    assert.equal(result.status,"UNAVAILABLE",c.name);
    assert.deepEqual(result.events,[],c.name);
  }
});

test("V2-F11 source-to-canonical equality gate refuses forged height or file-index shift",()=>{
  const sourceText=gpx();
  const canonical=parseTrackFile(sourceText,"route.gpx");
  const moved=canonical.map((p,i)=>i===3?{...p,lat:p.lat+0.0001}:p);
  const result=inspectGpsV2HorizontalTrack({
    sourceText,fileName:"route.gpx",canonicalPoints:moved,splitCuts:[]
  });
  assert.equal(result.reason,"CANONICAL_SOURCE_MISMATCH");
  assert.equal(result.events.length,0);
});

test("V2-F12 split boundaries prevent stop-go suggestions spanning separate flights",()=>{
  for(const c of cases){
    const r=inspect(c.source,c.file,[6]);
    assert.equal(r.status,"ADVISORY_ONLY",c.name);
    assert.equal(r.events.some(e=>e.kind==="STOP_GO_REVIEW_POINT"),false,c.name);
  }
});

test("V2-F13 semicolon CSV, untimed LineString KML and routepoint GPX stay legacy-only",()=>{
  for(const [source,file] of [
    [strict().replaceAll(",",";"),"track.csv"],
    ['<kml><Placemark><LineString><coordinates>14,50,0 14.1,50.1,0</coordinates></LineString></Placemark></kml>',"track.kml"],
    ['<gpx><rte><rtept lat="50" lon="14"><time>2026-10-18T10:00:00Z</time></rtept></rte></gpx>',"track.gpx"]
  ] as const){
    const result=inspect(source,file);
    assert.equal(result.status,"UNAVAILABLE");
    assert.deepEqual(result.events,[]);
  }
});

test("V2-F14 untrusted source reader never grants landing authority from valid altitude zero",()=>{
  const src=gpx().replaceAll("<ele>150</ele>","<ele>0</ele>");
  const result=inspect(src,"route.gpx");
  assert.equal(result.status,"ADVISORY_ONLY");
  assert.equal(result.canAffectCanonicalFlight,false);
  assert.equal(result.wholeFlightLandings,"UNAVAILABLE");
  assert.equal(result.physicalContact,"UNRESOLVED");
});
