/** Offline fixture-only diagnostic, not a physical-contact accuracy benchmark. */
import type {KmlPoint} from "../../lib/track-processing.ts";
import {shadowComparePoints} from "./legacy-shadow.ts";
import {analyzeResearchTrack} from "./detector.ts";

export type ComparisonFixtureKind=
  "KNOWN_PATTERN_POSITIVE"|"SYNTHETIC_NO_PATTERN"|"HISTORICALLY_DOCUMENTED_LEGACY_MISS_SHAPE"|"UNLABELED";
export type ComparisonFixture={
  id:string;
  kind:ComparisonFixtureKind;
  points:readonly KmlPoint[];
};
export type PatternComparisonRow={
  id:string;
  kind:ComparisonFixtureKind;
  legacyTgPatterns:number;
  legacySuggestedLandings:number;
  researchTgPatterns:number;
  researchStopGoPatterns:number;
  researchPatternCountStatus:"AVAILABLE"|"UNAVAILABLE";
  researchAbstained:boolean;
  researchAllContactsUnresolved:boolean;
  preprocessingConfound:"NOT_ISOLATED";
};
export type LegacyPatternComparison={
  classification:"FIXTURE_ONLY_PATTERN_DIAGNOSTIC_NOT_EVENT_ACCURACY";
  independentHoldout:false;
  contactTruthAvailable:false;
  caseCount:number;
  knownPatternPositives:{cases:number;legacyWithTgPattern:number;researchWithAnyPattern:number};
  knownNoPattern:{cases:number;legacyWithTgPattern:number;researchWithAnyPattern:number};
  legacyMissShapes:{cases:number;legacyMissed:number;researchTgCandidateFound:number;researchStillMissing:number};
  unlabeled:{cases:number;notScored:number};
  rows:PatternComparisonRow[];
};
export function compareLegacyPatterns(fixtures:readonly ComparisonFixture[]):LegacyPatternComparison{
  const ids=new Set<string>();
  let positives=0,legacyPos=0,researchPos=0,negatives=0,legacyFalse=0,researchFalse=0;
  let missTotal=0,legacyMissed=0,researchRecovered=0,missUnresolved=0,unlabeled=0;
  const rows:PatternComparisonRow[]=[];
  for(const fixture of fixtures){
    if(ids.has(fixture.id))throw new Error("Duplicate comparison fixture ID: "+fixture.id);
    ids.add(fixture.id);
    const shadow=shadowComparePoints(fixture.points);
    const current=analyzeResearchTrack(fixture.points.map((p,i)=>({...p,ordinal:i})));
    const researchTgPatterns=current.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length;
    const researchStopGoPatterns=current.candidates.filter(c=>c.type==="STOP_GO_PATTERN_CANDIDATE").length;
    const any=researchTgPatterns+researchStopGoPatterns>0;
    const oldAny=shadow.legacyTouchAndGoCount>0;
    if(fixture.kind==="KNOWN_PATTERN_POSITIVE"){positives++;if(oldAny)legacyPos++;if(any)researchPos++;}
    else if(fixture.kind==="SYNTHETIC_NO_PATTERN"){negatives++;if(oldAny)legacyFalse++;if(any)researchFalse++;}
    else if(fixture.kind==="HISTORICALLY_DOCUMENTED_LEGACY_MISS_SHAPE"){
      missTotal++;if(!oldAny)legacyMissed++;if(researchTgPatterns>0)researchRecovered++;else missUnresolved++;
    }else unlabeled++;
    rows.push({
      id:fixture.id,kind:fixture.kind,legacyTgPatterns:shadow.legacyTouchAndGoCount,
      legacySuggestedLandings:shadow.legacySuggestedLandings,
      researchTgPatterns,researchStopGoPatterns,researchPatternCountStatus:current.patternCount.status,
      researchAbstained:current.patternCount.status==="UNAVAILABLE",
      researchAllContactsUnresolved:current.candidates.every(c=>c.physicalContactStatus==="UNRESOLVED"),
      preprocessingConfound:"NOT_ISOLATED",
    });
  }
  return{
    classification:"FIXTURE_ONLY_PATTERN_DIAGNOSTIC_NOT_EVENT_ACCURACY",independentHoldout:false,
    contactTruthAvailable:false,caseCount:fixtures.length,
    knownPatternPositives:{cases:positives,legacyWithTgPattern:legacyPos,researchWithAnyPattern:researchPos},
    knownNoPattern:{cases:negatives,legacyWithTgPattern:legacyFalse,researchWithAnyPattern:researchFalse},
    legacyMissShapes:{cases:missTotal,legacyMissed,researchTgCandidateFound:researchRecovered,researchStillMissing:missUnresolved},
    unlabeled:{cases:unlabeled,notScored:unlabeled},
    rows,
  };
}
