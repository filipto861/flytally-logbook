/** R2.1b experimental in-memory diagnostic. No DB/auth/network/file I/O.
 * SECURITY: callers MUST establish record-level owner authorization BEFORE
 * providing points. This function is not an authorization boundary.
 * No routes, coordinates, timestamps, user IDs or per-track results are returned.
 * Model disagreement is NOT verified touchdown accuracy.
 */
import {touchAndGoEvents,type KmlPoint} from "../../lib/track-processing.ts";
import {analyzeResearchTrack,type EdgeReason} from "./detector.ts";

export const OBSERVATIONAL_LIMITS=Object.freeze({
  minimumCohortTracks:5,
  maximumCohortTracks:50,
  maximumPointsPerTrack:20000,
  maximumTotalPoints:100000,
});
export type UnavailableAggregate={
  status:"UNAVAILABLE";
  reason:"COHORT_TOO_SMALL"|"COHORT_TOO_LARGE"|"TRACK_TOO_LARGE"|"TOTAL_POINTS_EXCEEDED"|"INVALID_INPUT";
};
export type AggregateQualityReason=EdgeReason;
export type AvailableAggregate={
  status:"AVAILABLE";
  scope:"PREAUTHORIZED_PERSISTED_SEQUENCES_ONLY";
  comparisonBasis:"POST_NORMALIZATION_ONLY";
  preprocessingConfound:"NOT_ISOLATED";
  physicalContactTruth:"UNAVAILABLE";
  independentEventLabels:false;
  countType:"UNCONFIRMED_MOTION_PATTERNS_ONLY";
  tracks:number;
  observedPoints:number;
  tracksWithValidIslands:number;
  tracksWithNoValidIslands:number;
  invalidEdges:Record<AggregateQualityReason,number>;
  researchPatternCandidates:{altitudeReversal:number;speedDip:number};
  legacyTgCandidates:number;
  comparison:{
    bothHaveTgPattern:number;
    legacyOnlyTgPattern:number;
    researchOnlyTgPattern:number;
    neitherHasTgPattern:number;
  };
  unavailablePatternCountTracks:number;
};
export type ObservationalAggregate=UnavailableAggregate|AvailableAggregate;

const blankReasons=():Record<AggregateQualityReason,number>=>({
  MISSING_TIME:0,NON_MONOTONIC_TIME:0,BAD_COORDINATES:0,
  GAP:0,POSITION_JUMP:0,ALTITUDE_DISCONTINUITY:0,
});
function validShape(points:unknown):points is readonly KmlPoint[]{
  if(!Array.isArray(points))return false;
  for(let i=0;i<points.length;i++){
    // Array.every skips holes. Missing point slots must never become implicit fixes.
    if(!Object.hasOwn(points,i))return false;
    const p:unknown=points[i];
    if(p===null||typeof p!=="object")return false;
    const item=p as Partial<KmlPoint>;
    if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon)||
      !(item.alt===null||Number.isFinite(item.alt))||
      !(item.time===null||typeof item.time==="string"))return false;
  }
  return true;
}

/** Called only with already-authorized input. NO source access, output identities,
 * persisted changes or per-track predictions. Workload guard fails before computing. */
export function aggregatePreauthorizedTracks(tracks:readonly (readonly KmlPoint[])[]):ObservationalAggregate{
  if(!Array.isArray(tracks))return{status:"UNAVAILABLE",reason:"INVALID_INPUT"};
  if(tracks.length<OBSERVATIONAL_LIMITS.minimumCohortTracks)return{status:"UNAVAILABLE",reason:"COHORT_TOO_SMALL"};
  if(tracks.length>OBSERVATIONAL_LIMITS.maximumCohortTracks)return{status:"UNAVAILABLE",reason:"COHORT_TOO_LARGE"};
  let totalPoints=0;
  try{
    for(const points of tracks){
      if(!Array.isArray(points))return{status:"UNAVAILABLE",reason:"INVALID_INPUT"};
      if(points.length>OBSERVATIONAL_LIMITS.maximumPointsPerTrack)return{status:"UNAVAILABLE",reason:"TRACK_TOO_LARGE"};
      if(!validShape(points))return{status:"UNAVAILABLE",reason:"INVALID_INPUT"};
      totalPoints+=points.length;
      if(totalPoints>OBSERVATIONAL_LIMITS.maximumTotalPoints)return{status:"UNAVAILABLE",reason:"TOTAL_POINTS_EXCEEDED"};
    }
  }catch{
    // Malformed input/getters must fail before any aggregate is computed.
    return{status:"UNAVAILABLE",reason:"INVALID_INPUT"};
  }
  const invalidEdges=blankReasons();
  let tracksWithValidIslands=0,tracksWithNoValidIslands=0,altitudeReversal=0,speedDip=0;
  let legacyTgCandidates=0,bothHaveTgPattern=0,legacyOnlyTgPattern=0,researchOnlyTgPattern=0,neitherHasTgPattern=0,unavailablePatternCountTracks=0;
  try{
    for(const points of tracks){
      const research=analyzeResearchTrack(points.map((p:KmlPoint,ordinal:number)=>({...p,ordinal})));
      const legacy=touchAndGoEvents([...points]);
      if(research.islands.length)tracksWithValidIslands++;
      else tracksWithNoValidIslands++;
      if(research.patternCount.status==="UNAVAILABLE")unavailablePatternCountTracks++;
      for(const edge of research.edges)if(edge.status==="UNAVAILABLE"&&edge.reason)invalidEdges[edge.reason]++;
      const tg=research.candidates.filter(c=>c.type==="T_G_PATTERN_CANDIDATE").length;
      altitudeReversal+=tg;
      speedDip+=research.candidates.filter(c=>c.type==="STOP_GO_PATTERN_CANDIDATE").length;
      legacyTgCandidates+=legacy.length;
      if(legacy.length&&tg)bothHaveTgPattern++;
      else if(legacy.length)legacyOnlyTgPattern++;
      else if(tg)researchOnlyTgPattern++;
      else neitherHasTgPattern++;
    }
  }catch{
    // Fail closed without partial counts or leaking source-derived errors.
    return{status:"UNAVAILABLE",reason:"INVALID_INPUT"};
  }
  return{
    status:"AVAILABLE",scope:"PREAUTHORIZED_PERSISTED_SEQUENCES_ONLY",
    comparisonBasis:"POST_NORMALIZATION_ONLY",preprocessingConfound:"NOT_ISOLATED",
    physicalContactTruth:"UNAVAILABLE",independentEventLabels:false,
    countType:"UNCONFIRMED_MOTION_PATTERNS_ONLY",
    tracks:tracks.length,observedPoints:totalPoints,
    tracksWithValidIslands,tracksWithNoValidIslands,invalidEdges,
    researchPatternCandidates:{altitudeReversal,speedDip},
    legacyTgCandidates,
    comparison:{bothHaveTgPattern,legacyOnlyTgPattern,researchOnlyTgPattern,neitherHasTgPattern},
    unavailablePatternCountTracks,
  };
}
