import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeResearchTrack, assessSourceQuality,
  type SourceMetadata,type SourceObservation,type ResearchAnalysis
} from "../research/gps-detection-r21/detector.ts";
import {createFalsificationScorecard} from "../research/gps-detection-r21/falsification-scorecard.ts";

// Generated synthetic shapes. Numeric altitude alone never proves a datum,
// reference surface, runway alignment or physical wheel contact.
const START=Date.parse("2026-10-17T10:00:00Z");
const circuit=():SourceObservation[]=>{
  const alt=[230,260,300,350,400,430];
  for(let n=0;n<5;n++)alt.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  alt.push(390,350,310,270,240,230);
  return alt.map((a,i)=>({
    ordinal:i,lat:48+(95*5*i/3600/111.2),lon:10,alt:a,
    time:new Date(START+5000*i).toISOString()
  }));
};
const metadata=():SourceMetadata=>({
  altitudeMode:{status:"UNKNOWN"},altitudeUnit:{status:"UNKNOWN"},
  verticalDatum:{status:"UNKNOWN"},horizontalAccuracyM:{status:"UNKNOWN"},
  verticalAccuracyM:{status:"UNKNOWN"},sourceFormat:{status:"UNKNOWN"},
  generator:{status:"UNKNOWN"},sensorOrigin:{status:"UNKNOWN"},
  timestampPrecisionMs:{status:"UNKNOWN"}
});
const cases=(md?:SourceMetadata)=>analyzeResearchTrack(circuit(),md);
const tg=(md?:SourceMetadata)=>cases(md).candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE");

test("A02: absent source metadata is UNVERIFIED, never silently assumed metric or AGL",()=>{
  const result=cases();
  assert.ok(tg().length>0,"predeclared T09 utility: baseline still emits unresolved patterns");
  assert.deepEqual(result.sourceQuality.vertical,{
    status:"UNVERIFIED",reason:"SOURCE_METADATA_UNKNOWN",datum:"UNKNOWN"
  });
  assert.equal(result.sourceQuality.horizontalAccuracy.status,"UNKNOWN");
  assert.equal(result.sourceQuality.runwayProximity,"UNAVAILABLE");
  assert.ok(result.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
  assert.ok(!("agl" in result));
});

test("A02: explicit source metric absolute mode permits only relative-change pattern hypothesis",()=>{
  const md=metadata();
  md.altitudeMode={status:"KNOWN",value:"absolute"};
  md.altitudeUnit={status:"KNOWN",value:"m"};
  const report=cases(md);
  assert.equal(report.sourceQuality.vertical.status,"RELATIVE_CHANGE_ONLY");
  assert.equal(report.sourceQuality.vertical.reason,"DECLARED_METRIC_RELATIVE_CHANGE_ONLY");
  assert.ok(report.candidates.some(c=>c.type==="T_G_PATTERN_CANDIDATE"));
  assert.ok(report.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
  assert.ok(!("groundContact" in report));
});

test("T19/A02: clampToGround source cannot justify a numeric vertical reversal",()=>{
  const md=metadata();
  md.altitudeMode={status:"KNOWN",value:"clampToGround"};
  md.altitudeUnit={status:"KNOWN",value:"m"};
  const report=cases(md);
  assert.equal(report.sourceQuality.vertical.status,"UNAVAILABLE");
  assert.equal(report.sourceQuality.vertical.reason,"CLAMPED_ALTITUDE");
  assert.equal(report.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length,0);
  assert.equal(report.sourceQuality.runwayProximity,"UNAVAILABLE");
  assert.ok(report.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});

test("T19: explicit feet without source-approved conversion cannot pass 30-meter reversal criteria",()=>{
  const md=metadata();
  md.altitudeMode={status:"KNOWN",value:"absolute"};
  md.altitudeUnit={status:"KNOWN",value:"ft"};
  const report=cases(md);
  assert.equal(report.sourceQuality.vertical.status,"UNAVAILABLE");
  assert.equal(report.sourceQuality.vertical.reason,"FEET_NOT_CONVERTED");
  assert.equal(report.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length,0);
  assert.equal(report.patternCount.kind,"PATTERN_ONLY");
  assert.equal(report.sourceQuality.vertical.datum,"UNKNOWN");
});

test("T19: unsupported altitudeMode remains unavailable even if altitudeUnit is m",()=>{
  const md=metadata();
  md.altitudeMode={status:"KNOWN",value:"other"};
  md.altitudeUnit={status:"KNOWN",value:"m"};
  assert.equal(cases(md).sourceQuality.vertical.reason,"UNSUPPORTED_ALTITUDE_MODE");
  assert.equal(tg(md).length,0);
});

test("T19: flat/quantized-looking vertical samples alone cannot prove sensor resolution or contact",()=>{
  const quantized=circuit().map(p=>({...p,alt:250}));
  const r=analyzeResearchTrack(quantized);
  assert.equal(r.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length,0);
  assert.equal(r.sourceQuality.vertical.status,"UNVERIFIED");
  assert.ok(!("altitudeResolutionM" in r.sourceQuality));
  assert.ok(!("agl" in r));
  assert.equal(r.sourceQuality.runwayProximity,"UNAVAILABLE");
});

test("A02/A09: unknown vertical datum is not fabricated; known text is only declared",()=>{
  const m=metadata();m.altitudeMode={status:"KNOWN",value:"relativeToGround"};
  m.altitudeUnit={status:"KNOWN",value:"m"};
  let q=assessSourceQuality(m);
  assert.equal(q.vertical.datum,"UNKNOWN");
  assert.equal(q.vertical.status,"RELATIVE_CHANGE_ONLY");
  m.verticalDatum={status:"KNOWN",value:"an unverified source declaration"};
  q=assessSourceQuality(m);
  assert.equal(q.vertical.datum,"DECLARED_NOT_VERIFIED");
  assert.equal(q.runwayProximity,"UNAVAILABLE");
  assert.ok(cases(m).candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"));
});

test("A03: 1500 m source-declared horizontal accuracy never becomes runway alignment",()=>{
  const m=metadata();m.horizontalAccuracyM={status:"KNOWN",value:1500};
  const r=cases(m);
  assert.deepEqual(r.sourceQuality.horizontalAccuracy,{
    status:"DECLARED_NOT_VERIFIED",declaredMeters:1500
  });
  assert.equal(r.sourceQuality.runwayProximity,"UNAVAILABLE");
  assert.ok(r.candidates.length>0,"no hidden tuning or all-abstain utility loophole");
  assert.ok(r.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"&&!Object.hasOwn(c,"runwayId")));
});

test("A03: malformed known horizontal accuracy must fail closed, not default to zero",()=>{
  for(const invalid of [-1,NaN,Infinity]){
    const m=metadata();m.horizontalAccuracyM={status:"KNOWN",value:invalid};
    const r=cases(m);
    assert.equal(r.sourceQuality.horizontalAccuracy.status,"INVALID");
    assert.equal(r.sourceQuality.horizontalAccuracy.declaredMeters,null);
    assert.equal(r.patternCount.status,"UNAVAILABLE");
    if(r.patternCount.status==="UNAVAILABLE")assert.equal(r.patternCount.reason,"INVALID_SOURCE_METADATA");
    assert.deepEqual(r.candidates,[]);
    assert.ok(r.edges.length>0,"quality diagnostics remain available");
  }
});

test("T19: negative or nonfinite known vertical accuracy disables vertical pattern only",()=>{
  for(const invalid of [-1,NaN,Infinity]){
    const m=metadata();
    m.altitudeUnit={status:"KNOWN",value:"m"};
    m.altitudeMode={status:"KNOWN",value:"absolute"};
    m.verticalAccuracyM={status:"KNOWN",value:invalid};
    const r=cases(m);
    assert.equal(r.sourceQuality.vertical.status,"UNAVAILABLE");
    assert.equal(r.sourceQuality.vertical.reason,"MALFORMED_VERTICAL_ACCURACY");
    assert.equal(r.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length,0);
  }
});

test("A02: source unknown is distinct from zero, missing and explicit incompatible unit",()=>{
  const unknown=metadata(),feet=metadata();
  feet.altitudeUnit={status:"KNOWN",value:"ft"};
  assert.equal(assessSourceQuality(unknown).vertical.reason,"ALTITUDE_UNIT_UNKNOWN");
  assert.equal(assessSourceQuality(feet).vertical.reason,"FEET_NOT_CONVERTED");
  const m=metadata();m.altitudeUnit={status:"KNOWN",value:"m"};
  assert.equal(assessSourceQuality(m).vertical.reason,"ALTITUDE_MODE_UNKNOWN");
  assert.equal(assessSourceQuality(m).horizontalAccuracy.status,"UNKNOWN");
  m.horizontalAccuracyM={status:"KNOWN",value:0};
  assert.deepEqual(assessSourceQuality(m).horizontalAccuracy,{
    status:"DECLARED_NOT_VERIFIED",declaredMeters:0
  });
});

test("T19: scorecard refuses forged altitude candidate where source units were incompatible",()=>{
  const declaredFeet=metadata();
  declaredFeet.altitudeMode={status:"KNOWN",value:"absolute"};
  declaredFeet.altitudeUnit={status:"KNOWN",value:"ft"};
  const denied=cases(declaredFeet),reference=candidatesFixture();
  const candidate=reference.candidates.find(c=>c.type==="T_G_PATTERN_CANDIDATE");
  assert.ok(candidate,"reference motion hypothesis is required for non-vacuous forgery test");
  const forged:ResearchAnalysis={...denied,candidates:[candidate]};
  const card=createFalsificationScorecard([{
    fixtureId:"T19-FORGED-ALT",reference:{kind:"UNLABELED"},analysis:forged
  }]);
  assert.equal(card.safety.pass,false);
  assert.ok(card.safety.violations.some(v=>v.includes("VERTICAL_CANDIDATE_WITH_UNAVAILABLE_SOURCE")));
  assert.equal(card.physicalContactAccuracy,"UNAVAILABLE");
});

test("A03: scorecard refuses tampered source quality and ghost candidate",()=>{
  const malformed=metadata();malformed.horizontalAccuracyM={status:"KNOWN",value:-5};
  const denied=cases(malformed),candidate=candidatesFixture().candidates[0];
  assert.ok(candidate);
  const forged:ResearchAnalysis={...denied,candidates:[candidate]};
  const bad=createFalsificationScorecard([{
    fixtureId:"A03-FORGED",reference:{kind:"UNLABELED"},analysis:forged
  }]);
  assert.equal(bad.safety.pass,false);
  assert.ok(bad.safety.violations.some(v=>v.includes("CANDIDATES_WITH_INVALID_HORIZONTAL_METADATA")));
  const missing={...cases(),sourceQuality:undefined} as unknown as ResearchAnalysis;
  const missingScore=createFalsificationScorecard([{
    fixtureId:"T19-UNKNOWN-QUALITY",reference:{kind:"UNLABELED"},analysis:missing
  }]);
  assert.equal(missingScore.safety.pass,false);
  assert.ok(missingScore.safety.violations.some(v=>v.includes("MISSING_SOURCE_QUALITY_ASSESSMENT")));
});

function candidatesFixture(){return cases();}

test("T19: explicit feet and clamp must not feed metre-based vertical-rate edge discontinuity",()=>{
  const xs=circuit().map((p,i)=>({...p,alt:i%2===0?0:9000}));
  const metres=metadata();metres.altitudeMode={status:"KNOWN",value:"absolute"};
  metres.altitudeUnit={status:"KNOWN",value:"m"};
  const reference=analyzeResearchTrack(xs,metres);
  assert.ok(reference.edges.some(e=>e.reason==="ALTITUDE_DISCONTINUITY"),"metric baseline exercises the guard");
  const feet=metadata();feet.altitudeMode={status:"KNOWN",value:"absolute"};
  feet.altitudeUnit={status:"KNOWN",value:"ft"};
  const clamped=metadata();clamped.altitudeMode={status:"KNOWN",value:"clampToGround"};
  clamped.altitudeUnit={status:"KNOWN",value:"m"};
  for(const md of [feet,clamped]){
    const report=analyzeResearchTrack(xs,md);
    assert.ok(report.edges.every(e=>e.status==="VALID"),"horizontal quality remains independent of incompatible altitude source");
    assert.ok(report.edges.every(e=>e.verticalRateMps===null));
    assert.ok(report.edges.some(e=>e.speedKmh!==null),"horizontal speed is preserved");
    assert.equal(report.candidates.filter(e=>e.type==="T_G_PATTERN_CANDIDATE").length,0);
    assert.equal(report.sourceQuality.vertical.status,"UNAVAILABLE");
  }
});
