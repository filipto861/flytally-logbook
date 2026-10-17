import test from "node:test";
import assert from "node:assert/strict";
import {analyzeResearchTrack,type SourceObservation} from "../research/gps-detection-r21/detector.ts";
import {separateGpsCounts,assessWholeFlightLandingsFromGps} from "../research/gps-detection-r21/flight-count-contract.ts";
import {compareLegacyPatterns,type ComparisonFixture} from "../research/gps-detection-r21/legacy-pattern-comparison.ts";
import type {KmlPoint} from "../lib/track-processing.ts";

// Reconstructed synthetic shapes from the already checked-in v351 regression test.
// These are MOTION-PATTERN fixtures, not independently timed wheel-contact labels.
const START=Date.parse("2026-10-07T12:00:00Z");
const moving=(alts:readonly number[],speedKmh=95,stepSeconds=5):KmlPoint[]=>alts.map((alt,i)=>({
  lat:50+(speedKmh*stepSeconds*i/3600/111.2),lon:14,alt,
  time:new Date(START+stepSeconds*i*1000).toISOString(),
}));
const asObserved=(points:readonly KmlPoint[]):SourceObservation[]=>points.map((p,i)=>({...p,ordinal:i}));
function fiveCircuits():KmlPoint[]{
  const alt=[230,260,300,350,400,430];
  for(let n=0;n<5;n++)alt.push(390,350,310,270,240,230,235,242,255,275,310,360,410,430);
  alt.push(390,350,310,270,240,230);return moving(alt);
}
function flatStopGo():KmlPoint[]{
  const speeds=[...Array(8).fill(80),...Array(6).fill(10),...Array(8).fill(80)] as number[];
  const out:KmlPoint[]=[{lat:50,lon:14,alt:250,time:new Date(START).toISOString()}];
  let lat=50;
  for(const [i,speed] of speeds.entries()){
    lat+=speed*5/3600/111.2;
    out.push({lat,lon:14,alt:250,time:new Date(START+(i+1)*5000).toISOString()});
  }
  return out;
}
// The specific +11-point missed rolling T&G shape in tests/v351-gps-tg-reliability.test.ts
const knownMissedShape=():KmlPoint[]=>moving([
  400,380,360,340,320,300,280,260,245,235,228,224,
  228,232,237,240,244,247,250,252,253,253.7,271,300,330,
],100,5);
const stationary=():KmlPoint[]=>Array.from({length:15},(_,i)=>({
  lat:50,lon:14,alt:250,time:new Date(START+i*5000).toISOString(),
}));
const suite=():ComparisonFixture[]=>[
  {id:"T09",kind:"KNOWN_PATTERN_POSITIVE",points:fiveCircuits()},
  {id:"T11",kind:"KNOWN_PATTERN_POSITIVE",points:flatStopGo()},
  {id:"T10",kind:"HISTORICALLY_DOCUMENTED_LEGACY_MISS_SHAPE",points:knownMissedShape()},
  {id:"T04",kind:"SYNTHETIC_NO_PATTERN",points:stationary()},
  {id:"UNLABELED_01",kind:"UNLABELED",points:[]},
];

test("T14: incomplete GPS gives observed-island pattern count, NOT full-flight landing count",()=>{
  const observed=analyzeResearchTrack(asObserved(moving([200,230,260,300,340,380])));
  const counts=separateGpsCounts(observed,"INCOMPLETE");
  assert.deepEqual(counts.observedPatterns,{kind:"PATTERN_ONLY",status:"AVAILABLE",scope:"OBSERVED_VALID_ISLANDS_ONLY",value:0});
  assert.deepEqual(counts.wholeFlightLandings,{kind:"WHOLE_FLIGHT_LANDING_COUNT",status:"UNAVAILABLE",basis:"GPS_ONLY",reason:"INCOMPLETE_TRACK"});
  assert.equal(Object.hasOwn(counts.wholeFlightLandings,"value"),false);
});

test("Unknown GPS coverage must not manufacture any whole-flight landing count",()=>{
  const counts=separateGpsCounts(analyzeResearchTrack(asObserved(fiveCircuits())),"UNKNOWN");
  assert.equal(counts.wholeFlightLandings.status,"UNAVAILABLE");
  assert.equal(counts.wholeFlightLandings.reason,"COVERAGE_UNVERIFIED");
  assert.equal(counts.observedPatterns.kind,"PATTERN_ONLY");
});

test("Even independently verified complete track coverage is not independently verified touchdown",()=>{
  const assessment=assessWholeFlightLandingsFromGps("COMPLETE_INDEPENDENTLY_VERIFIED");
  assert.equal(assessment.status,"UNAVAILABLE");
  assert.equal(assessment.reason,"PHYSICAL_CONTACT_UNVERIFIED");
  assert.equal(Object.hasOwn(assessment,"value"),false);
});

test("T10 legacy genuinely misses documented synthetic +11 shape; new engine reports unresolved T&G pattern",()=>{
  const report=compareLegacyPatterns([{id:"T10",kind:"HISTORICALLY_DOCUMENTED_LEGACY_MISS_SHAPE",points:knownMissedShape()}]);
  assert.equal(report.legacyMissShapes.cases,1);
  assert.equal(report.legacyMissShapes.legacyMissed,1);
  assert.equal(report.legacyMissShapes.researchTgCandidateFound,1);
  assert.equal(report.legacyMissShapes.researchStillMissing,0);
  assert.equal(report.rows[0].legacyTgPatterns,0);
  assert.ok(report.rows[0].researchTgPatterns>=1);
  assert.equal(report.rows[0].researchAllContactsUnresolved,true);
  assert.equal(report.contactTruthAvailable,false);
});

test("Shadow fixture matrix keeps positives, negatives, misses and unlabeled denominators separate",()=>{
  const result=compareLegacyPatterns(suite());
  assert.equal(result.classification,"FIXTURE_ONLY_PATTERN_DIAGNOSTIC_NOT_EVENT_ACCURACY");
  assert.equal(result.independentHoldout,false);
  assert.equal(result.contactTruthAvailable,false);
  assert.equal(result.caseCount,5);
  assert.deepEqual(result.knownPatternPositives,{cases:2,legacyWithTgPattern:2,researchWithAnyPattern:2});
  assert.deepEqual(result.knownNoPattern,{cases:1,legacyWithTgPattern:0,researchWithAnyPattern:0});
  assert.deepEqual(result.legacyMissShapes,{cases:1,legacyMissed:1,researchTgCandidateFound:1,researchStillMissing:0});
  assert.deepEqual(result.unlabeled,{cases:1,notScored:1});
  assert.ok(result.rows.every(r=>r.researchAllContactsUnresolved));
  assert.ok(result.rows.every(r=>r.preprocessingConfound==="NOT_ISOLATED"));
});

test("Old minimum-one landing suggestion remains explicitly unrelated to new pattern hypotheses",()=>{
  const result=compareLegacyPatterns([{id:"EMPTY",kind:"UNLABELED",points:[]}]);
  assert.equal(result.rows[0].legacySuggestedLandings,1);
  assert.equal(result.rows[0].researchPatternCountStatus,"UNAVAILABLE");
  assert.equal(result.rows[0].researchAbstained,true);
  assert.equal(result.contactTruthAvailable,false);
});

test("Duplicate IDs cannot silently double-count a favorable pattern fixture",()=>{
  const first=suite()[0];
  assert.throws(()=>compareLegacyPatterns([first,first]),/Duplicate comparison fixture ID/);
});
