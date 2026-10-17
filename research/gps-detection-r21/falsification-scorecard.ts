/** R2.1a offline falsification scorecard. NOT physical-contact accuracy validation.
 * Fixture expectations are synthetic/legacy-regression labels, not ground truth. */
import type {EventType,ResearchAnalysis} from "./detector.ts";

export type FixtureReference=
  |{kind:"EXPECTED_PATTERN";eventType:EventType}
  |{kind:"EXPECTED_NO_PATTERN"}
  |{kind:"UNLABELED"};

export type FalsificationCase={
  fixtureId:string;
  reference:FixtureReference;
  analysis:ResearchAnalysis;
};

export type FixtureFinding={
  fixtureId:string;
  reference:FixtureReference;
  predictedPatterns:number;
  matchedExpectedPattern:boolean|null;
  unexpectedPatternOnKnownNegative:boolean|null;
  abstained:boolean;
  safetyViolations:string[];
};

export type FalsificationScorecard={
  scope:"SYNTHETIC_AND_LEGACY_REGRESSION_ONLY";
  physicalContactAccuracy:"UNAVAILABLE";
  independentHoldout:false;
  fixtureTotal:number;
  knownPatternPositives:{total:number;covered:number;missed:number};
  knownPatternNegatives:{total:number;withoutCandidate:number;withUnexpectedCandidate:number};
  unlabeled:{total:number;notScoredAsNegative:number};
  abstentions:{total:number;amongKnownPositives:number};
  safety:{pass:boolean;violations:string[]};
  hardUtility:{pass:boolean;requiredIds:readonly ["T09","T11"];missingOrUncovered:string[]};
  findings:FixtureFinding[];
};

const REQUIRED_PATTERN_FIXTURES=[{id:"T09",type:"T_G_PATTERN_CANDIDATE"},{id:"T11",type:"STOP_GO_PATTERN_CANDIDATE"}] as const;

export function createFalsificationScorecard(fixtures:readonly FalsificationCase[]):FalsificationScorecard{
  const ids=new Set<string>();
  const findings:FixtureFinding[]=[];
  const safetyViolations:string[]=[];
  let positiveTotal=0,positiveCovered=0,negativeTotal=0,negativeClear=0,unknownTotal=0,abstentions=0,positiveAbstentions=0;
  for(const entry of fixtures){
    if(ids.has(entry.fixtureId))throw new Error("Duplicate fixture ID: "+entry.fixtureId);
    ids.add(entry.fixtureId);
    const {fixtureId,reference,analysis}=entry,candidates=analysis.candidates;
    const errors:string[]=[];
    const matched=reference.kind==="EXPECTED_PATTERN"?candidates.some(candidate=>candidate.type===reference.eventType):null;
    const unexpected=reference.kind==="EXPECTED_NO_PATTERN"?candidates.length>0:null;
    if(reference.kind==="EXPECTED_PATTERN"){positiveTotal++;if(matched)positiveCovered++;}
    else if(reference.kind==="EXPECTED_NO_PATTERN"){negativeTotal++;if(!unexpected)negativeClear++;}
    else unknownTotal++;
    if(analysis.patternCount.status==="UNAVAILABLE"){abstentions++;if(reference.kind==="EXPECTED_PATTERN")positiveAbstentions++;}
    for(const candidate of candidates){
      if(candidate.physicalContactStatus!=="UNRESOLVED")errors.push("BARE_TRACK_CONTACT_ASSERTION");
      if(candidate.support.start>candidate.index||candidate.index>candidate.support.end||candidate.support.start>candidate.support.end)
        errors.push("INVALID_SUPPORT_INTERVAL");
      if(!analysis.islands.some(island=>candidate.support.start>=island.start&&candidate.support.end<=island.end))
        errors.push("SUPPORT_SPANS_INVALID_EDGE");
      if(candidate.gapAdjacent!== (candidate.invalidBoundaryEvidence.length>0))
        errors.push("INCONSISTENT_INVALID_BOUNDARY_FLAG");
      if(candidate.invalidBoundaryEvidence.length>0&&candidate.time!==null)
        errors.push("PRECISE_TIME_NEAR_INVALID_BOUNDARY");
      for(const observation of candidate.invalidBoundaryEvidence){
        const original=analysis.edges.find(e=>e.from===observation.edge.from&&e.to===observation.edge.to);
        if(!original||original.status!=="UNAVAILABLE"||original.reason!==observation.reason)
          errors.push("UNSUPPORTED_INVALID_BOUNDARY_PROVENANCE");
      }
    }
    if(errors.length)safetyViolations.push(...Array.from(new Set(errors),reason=>fixtureId+": "+reason));
    findings.push({fixtureId,reference,predictedPatterns:candidates.length,matchedExpectedPattern:matched,unexpectedPatternOnKnownNegative:unexpected,abstained:analysis.patternCount.status==="UNAVAILABLE",safetyViolations:[...new Set(errors)]});
  }
  const missingOrUncovered=REQUIRED_PATTERN_FIXTURES.filter(required=>{
    const matchedFixture=fixtures.find(f=>f.fixtureId===required.id);
    return matchedFixture?.reference.kind!=="EXPECTED_PATTERN"||matchedFixture.reference.eventType!==required.type||!matchedFixture.analysis.candidates.some(c=>c.type===required.type);
  }).map(required=>required.id);
  return{
    scope:"SYNTHETIC_AND_LEGACY_REGRESSION_ONLY",
    physicalContactAccuracy:"UNAVAILABLE",
    independentHoldout:false,
    fixtureTotal:fixtures.length,
    knownPatternPositives:{total:positiveTotal,covered:positiveCovered,missed:positiveTotal-positiveCovered},
    knownPatternNegatives:{total:negativeTotal,withoutCandidate:negativeClear,withUnexpectedCandidate:negativeTotal-negativeClear},
    unlabeled:{total:unknownTotal,notScoredAsNegative:unknownTotal},
    abstentions:{total:abstentions,amongKnownPositives:positiveAbstentions},
    safety:{pass:safetyViolations.length===0,violations:safetyViolations},
    hardUtility:{pass:missingOrUncovered.length===0,requiredIds:["T09","T11"],missingOrUncovered},
    findings,
  };
}
