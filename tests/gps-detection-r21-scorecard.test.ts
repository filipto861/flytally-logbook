import test from "node:test";
import assert from "node:assert/strict";
import {analyzeResearchTrack,type SourceObservation,type ResearchAnalysis} from "../research/gps-detection-r21/detector.ts";
import {createFalsificationScorecard,type FalsificationCase} from "../research/gps-detection-r21/falsification-scorecard.ts";

// These are intentionally synthetic *pattern* references, never contact ground truth.
const START=Date.parse("2026-10-17T10:00:00Z");
const point=(i:number,lat:number,alt:number|null):SourceObservation=>({
  ordinal:i,lat,lon:10,alt,time:new Date(START+i*5000).toISOString(),
});
const altitudeCircuit=()=>{
  const altitudes=[230,260,300,350,400,430];
  for(let i=0;i<5;i++)altitudes.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  altitudes.push(390,350,310,270,240,230);
  return altitudes.map((alt,i)=>point(i,48+(95*5*i/3600/111.2),alt));
};
const speedDip=()=>{
  const speeds=[...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[];
  const output=[point(0,48,250)];let lat=48;
  for(const [i,speed] of speeds.entries()){lat+=speed*5/3600/111.2;output.push(point(i+1,lat,250));}
  return output;
};
const stationary=()=>Array.from({length:15},(_,i)=>point(i,48,250));
const suite=():FalsificationCase[]=>[
  {fixtureId:"T09",reference:{kind:"EXPECTED_PATTERN",eventType:"T_G_PATTERN_CANDIDATE"},analysis:analyzeResearchTrack(altitudeCircuit())},
  {fixtureId:"T11",reference:{kind:"EXPECTED_PATTERN",eventType:"STOP_GO_PATTERN_CANDIDATE"},analysis:analyzeResearchTrack(speedDip())},
  {fixtureId:"T04",reference:{kind:"EXPECTED_NO_PATTERN"},analysis:analyzeResearchTrack(stationary())},
  {fixtureId:"T10",reference:{kind:"UNLABELED"},analysis:analyzeResearchTrack([])},
];

test("R2.1a scorecard reports separate pattern-positive, negative, unknown and abstention denominators",()=>{
  const result=createFalsificationScorecard(suite());
  assert.equal(result.scope,"SYNTHETIC_AND_LEGACY_REGRESSION_ONLY");
  assert.equal(result.physicalContactAccuracy,"UNAVAILABLE");
  assert.equal(result.independentHoldout,false);
  assert.equal(result.fixtureTotal,4);
  assert.deepEqual(result.knownPatternPositives,{total:2,covered:2,missed:0});
  assert.deepEqual(result.knownPatternNegatives,{total:1,withoutCandidate:1,withUnexpectedCandidate:0});
  assert.deepEqual(result.unlabeled,{total:1,notScoredAsNegative:1});
  assert.equal(result.abstentions.amongKnownPositives,0);
  assert.equal(result.hardUtility.pass,true);
  assert.equal(result.safety.pass,true);
  assert.equal(result.findings.find(f=>f.fixtureId==="T10")?.unexpectedPatternOnKnownNegative,null);
});

test("R2.1a scorecard refuses to treat universal abstention as useful",()=>{
  const unknown=analyzeResearchTrack([]);
  const result=createFalsificationScorecard([
    {fixtureId:"T09",reference:{kind:"EXPECTED_PATTERN",eventType:"T_G_PATTERN_CANDIDATE"},analysis:unknown},
    {fixtureId:"T11",reference:{kind:"EXPECTED_PATTERN",eventType:"STOP_GO_PATTERN_CANDIDATE"},analysis:unknown},
  ]);
  assert.equal(result.safety.pass,true);
  assert.equal(result.hardUtility.pass,false);
  assert.deepEqual(result.hardUtility.missingOrUncovered,["T09","T11"]);
  assert.deepEqual(result.knownPatternPositives,{total:2,covered:0,missed:2});
  assert.equal(result.abstentions.amongKnownPositives,2);
});

test("R2.1a scorecard does not silently mark unlabeled data as a known negative",()=>{
  const base=analyzeResearchTrack(altitudeCircuit());
  const result=createFalsificationScorecard([
    {fixtureId:"UNLABELED_01",reference:{kind:"UNLABELED"},analysis:base},
  ]);
  assert.equal(result.knownPatternNegatives.total,0);
  assert.equal(result.unlabeled.total,1);
  assert.equal(result.findings[0].unexpectedPatternOnKnownNegative,null);
  assert.equal(result.hardUtility.pass,false,"missing required utility fixture IDs is not success");
});

test("R2.1a scorecard rejects duplicate fixture IDs",()=>{
  const xs=suite();
  assert.throws(()=>createFalsificationScorecard([xs[0],xs[0]]),/Duplicate fixture ID/);
});

test("R2.1a scorecard reveals fabricated contact, unsupported spans and precise gap-adjacent time",()=>{
  const a=analyzeResearchTrack(altitudeCircuit());
  assert.ok(a.candidates.length>0);
  const corrupted={
    ...a,
    candidates:[{
      ...a.candidates[0],
      physicalContactStatus:"CONTACT_CONFIRMED",
      support:{start:0,end:99999},
      gapAdjacent:true,
      time:"2026-10-17T10:00:00Z",
    }],
  } as unknown as ResearchAnalysis;
  const cases=suite();
  cases[0]={...cases[0],analysis:corrupted};
  const result=createFalsificationScorecard(cases);
  assert.equal(result.safety.pass,false);
  assert.ok(result.safety.violations.some(x=>x.includes("BARE_TRACK_CONTACT_ASSERTION")));
  assert.ok(result.safety.violations.some(x=>x.includes("SUPPORT_SPANS_INVALID_EDGE")));
  assert.ok(result.safety.violations.some(x=>x.includes("PRECISE_TIME_NEAR_INVALID_BOUNDARY")));
});

test("R2.1a scorecard cannot compute real-event precision or claim an untouched independent holdout",()=>{
  const card=createFalsificationScorecard(suite());
  assert.equal(card.physicalContactAccuracy,"UNAVAILABLE");
  assert.equal(card.independentHoldout,false);
  assert.ok(!("eventPrecision" in card));
  assert.ok(!("landingAccuracy" in card));
});
