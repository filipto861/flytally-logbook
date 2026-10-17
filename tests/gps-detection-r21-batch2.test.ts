import test from "node:test";
import assert from "node:assert/strict";
import {analyzeResearchTrack,type SourceObservation,type SourceMetadata} from "../research/gps-detection-r21/detector.ts";

const ORIGIN=Date.parse("2026-10-17T10:00:00Z");
const point=(i:number,alt:number|null,lat=48,seconds=i*5):SourceObservation=>({
  lat,lon:10,alt,time:new Date(ORIGIN+seconds*1000).toISOString(),ordinal:i,
});
const moving=(alts:(number|null)[],kmh=95,step=5)=>alts.map((alt,i)=>point(i,alt,48+kmh*(i*step)/3600/111.2,i*step));
const circuit=()=>{
  const alt=[230,260,300,350,400,430];
  for(let n=0;n<5;n++)alt.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  alt.push(390,350,310,270,240,230);
  return moving(alt);
};
const groundDip=()=>{
  const speeds=[...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[];
  const out=[point(0,250)];let lat=48;
  for(const [i,speed] of speeds.entries()){
    lat+=speed*5/3600/111.2;
    out.push(point(i+1,250,lat,(i+1)*5));
  }
  return out;
};
const unknownMetadata:SourceMetadata={
  altitudeMode:{status:"UNKNOWN"},altitudeUnit:{status:"UNKNOWN"},
  verticalDatum:{status:"UNKNOWN"},horizontalAccuracyM:{status:"UNKNOWN"},
  verticalAccuracyM:{status:"UNKNOWN"},sourceFormat:{status:"UNKNOWN"},
  generator:{status:"UNKNOWN"},sensorOrigin:{status:"UNKNOWN"},
  timestampPrecisionMs:{status:"UNKNOWN"},
};

test("A02: altitude mode and datum remain source facts; identical numbers never confirm contact",()=>{
  const same=moving([300,280,260,240,220,240,260,300,340]);
  const absolute:SourceMetadata={...unknownMetadata,altitudeMode:{status:"KNOWN",value:"absolute"},altitudeUnit:{status:"KNOWN",value:"m"}};
  const clamped:SourceMetadata={...absolute,altitudeMode:{status:"KNOWN",value:"clampToGround"}};
  for(const metadata of [absolute,clamped,unknownMetadata]){
    const result=analyzeResearchTrack(same,metadata);
    assert.ok(result.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
    assert.ok(!("agl" in result));
  }
});

test("A03: explicitly poor horizontal accuracy cannot become asserted runway proximity",()=>{
  const metadata:SourceMetadata={...unknownMetadata,horizontalAccuracyM:{status:"KNOWN",value:1500}};
  const output=analyzeResearchTrack(circuit(),metadata);
  assert.ok(output.candidates.length>0,"positive pattern must not be an all-unknown test");
  for(const c of output.candidates){assert.equal(c.physicalContactStatus,"UNRESOLVED");assert.ok(!("runwayId" in c));}
});

test("A09: negative altitude is a real finite number, not a ground-contact label",()=>{
  const xs=moving([-25,-20,-15,-10,-5,0,5,10,15]);
  const result=analyzeResearchTrack(xs,unknownMetadata);
  assert.equal(xs[0].alt,-25);assert.equal(xs[5].alt,0);
  assert.equal(result.edges[0].verticalRateMps,1);
  assert.equal(result.candidates.length,0);
});

test("A10: invalid coordinate must yield unavailable velocity, not stationary motion",()=>{
  const xs=moving([240,230,220,210,200,210,220,240,270]);
  xs[4].lat=91;
  const output=analyzeResearchTrack(xs);
  assert.equal(output.edges[3].reason,"BAD_COORDINATES");
  assert.equal(output.edges[3].speedKmh,null);
  assert.equal(output.edges[4].reason,"BAD_COORDINATES");
  assert.equal(output.edges[4].speedKmh,null);
});

test("A11: quantized timestamps prohibit deriving zero speed or event from invalid edges",()=>{
  const xs=moving([300,290,280,270,260,250,240,250,260]);
  xs[4].time=xs[3].time;xs[5].time=xs[3].time;
  const output=analyzeResearchTrack(xs);
  assert.equal(output.edges[3].reason,"NON_MONOTONIC_TIME");
  assert.equal(output.edges[3].speedKmh,null);
  assert.equal(output.edges[4].speedKmh,null);
  assert.ok(output.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});

test("A13: a supported stop-and-go candidate near a GPS gap has no precise event time",()=>{
  const xs=groundDip();
  for(let i=19;i<xs.length;i++)xs[i].time=new Date(Date.parse(xs[i].time!)+120000).toISOString();
  const output=analyzeResearchTrack(xs);
  assert.equal(output.edges[18].reason,"GAP");
  const candidates=output.candidates.filter(c=>c.type==="STOP_GO_PATTERN_CANDIDATE");
  assert.ok(candidates.length>0,"gap must not erase independently supported preceding pattern");
  assert.ok(candidates.some(c=>c.gapAdjacent&&c.time===null),"near-boundary candidate must abstain on exact time");
  for(const candidate of candidates)assert.ok(output.islands.some(island=>candidate.support.start>=island.start&&candidate.support.end<=island.end));
});

test("T13: a sixty-second edge (boundary case) is invalid, not a 0 km/h measurement",()=>{
  const xs=moving([200,210,220,230,240,250,260]);
  for(let i=3;i<xs.length;i++)xs[i].time=new Date(Date.parse(xs[i].time!)+55000).toISOString();
  const output=analyzeResearchTrack(xs);
  assert.equal(output.edges[2].dtSeconds,60);
  assert.equal(output.edges[2].reason,"GAP");
  assert.equal(output.edges[2].speedKmh,null);
});

test("T17/A15: resampling results are diagnostic only; neither track can prove touchdown",()=>{
  const original=circuit(),dense:SourceObservation[]=[];
  for(let i=0;i<original.length;i++){
    dense.push({...original[i],ordinal:dense.length});
    if(i+1<original.length){
      const a=original[i],b=original[i+1],midpoint=Date.parse(a.time!)+(Date.parse(b.time!)-Date.parse(a.time!))/2;
      dense.push({lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2,alt:a.alt===null||b.alt===null?null:(a.alt+b.alt)/2,time:new Date(midpoint).toISOString(),ordinal:dense.length});
    }
  }
  const a=analyzeResearchTrack(original),b=analyzeResearchTrack(dense);
  assert.ok(a.candidates.length>0);
  assert.ok(a.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
  assert.ok(b.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
  for(const candidate of [...a.candidates,...b.candidates])assert.ok(candidate.support.start<=candidate.index&&candidate.index<=candidate.support.end);
  // Difference in candidate counts is an observed coverage/stability diagnostic,
  // NOT asserted equivalence or an independently held-out accuracy result.
});

test("A05/A06: incomplete single-direction sequences do not invent touchdown",()=>{
  for(const alts of [[200,220,240,260,280,300,330],[330,300,280,260,240,220,200]]){
    const result=analyzeResearchTrack(moving(alts));
    assert.equal(result.candidates.length,0);
    assert.ok(!("landings" in result));
    assert.ok(!("takeoffs" in result));
    assert.equal(result.patternCount.kind,"PATTERN_ONLY");
  }
});

test("T18: timezone-less or malformed timestamp breaks quality support",()=>{
  const xs=moving([100,110,120,130,140]);
  xs[2].time="2026-10-17T10:00:10";
  const result=analyzeResearchTrack(xs);
  assert.equal(result.edges[1].reason,"MISSING_TIME");
  assert.equal(result.edges[2].reason,"MISSING_TIME");
  assert.equal(result.edges[1].speedKmh,null);
  assert.equal(result.edges[2].verticalRateMps,null);
});

test("A14: both predeclared pattern-utility controls remain nontrivial",()=>{
  const altitude=analyzeResearchTrack(circuit()),speed=analyzeResearchTrack(groundDip());
  assert.ok(altitude.candidates.some(c=>c.type==="T_G_PATTERN_CANDIDATE"));
  assert.ok(speed.candidates.some(c=>c.type==="STOP_GO_PATTERN_CANDIDATE"));
});
