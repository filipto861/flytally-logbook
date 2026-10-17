/** R2.1a legacy shadow comparator. Research-only, never called by app code. */
import {inspectTrackFile,landingCount,touchAndGoEvents,type KmlPoint} from "../../lib/track-processing.ts";
import {analyzeResearchTrack,type SourceObservation,type PatternCandidate} from "./detector.ts";

export type ShadowComparison={
  basis:"PRODUCTION_PREPROCESSED_SOURCE"|"POST_NORMALIZATION_ONLY";
  preprocessingConfound:"NOT_ISOLATED";
  rawAcquisitionOrderRecovered:false;
  normalizedSampleCount:number;
  legacyTouchAndGoCount:number;
  legacySuggestedLandings:number;
  legacyIndices:number[];
  newPatternCandidateCount:number;
  newCandidates:PatternCandidate[];
  physicalContactStatus:"UNRESOLVED";
};

function compare(points:readonly KmlPoint[],basis:ShadowComparison["basis"]):ShadowComparison{
  // Same normalized observations for the two detectors; this is not an independent
  // evaluation of source parsing, lost altitudeMode or original acquisition order.
  const preserved:SourceObservation[]=points.map((p,ordinal)=>({
    lat:p.lat,lon:p.lon,alt:p.alt,time:p.time,ordinal,
  }));
  const legacy=touchAndGoEvents([...points]);
  const research=analyzeResearchTrack(preserved);
  return{
    basis,preprocessingConfound:"NOT_ISOLATED",rawAcquisitionOrderRecovered:false,
    normalizedSampleCount:points.length,
    legacyTouchAndGoCount:legacy.length,
    legacySuggestedLandings:landingCount([...points]),
    legacyIndices:legacy.map(x=>x.index),
    newPatternCandidateCount:research.candidates.length,
    newCandidates:research.candidates,
    physicalContactStatus:"UNRESOLVED",
  };
}

/** Identical already-decoded points: only post-normalization detector behavior is comparable. */
export function shadowComparePoints(points:readonly KmlPoint[]):ShadowComparison{
  return compare(points,"POST_NORMALIZATION_ONLY");
}

/** Exact production parser and detector on the same raw fixture; research receives
 * production-normalized points, so no claims about independent preprocessing gains. */
export function shadowCompareSource(rawSource:string,fileName:string):ShadowComparison{
  const inspection=inspectTrackFile(rawSource,fileName);
  return compare(inspection.points,"PRODUCTION_PREPROCESSED_SOURCE");
}
