/**
 * Explicit P1B opt-in bridge from the tested browser-safe P1A source-quality
 * inspector to existing GPS import REVIEW. This is NOT native V2 source
 * eligibility, GPS event detection, or logbook authority.
 */
import type {KmlPoint} from "./track-processing";
import {
  inspectR3P1AQualityContexts,R3_P1A_REVISION,
  type R3P1AQualityContexts,
} from "../research/gps-detection-r21/stage-r3-p1a-source-quality-contexts";

export type GpsR3QualityReport=R3P1AQualityContexts;

export function inspectGpsR3QualityReview(
  sourceText:string,canonicalPoints:readonly KmlPoint[],
  splitCuts:readonly number[]
):GpsR3QualityReport{
  return inspectR3P1AQualityContexts({
    sourceText,canonicalPoints,splitCuts,expectedRevision:R3_P1A_REVISION,
  });
}
export function hasGpsR3QualityReview(report:GpsR3QualityReport|null):boolean{
  return report?.status==="QUALITY_REVIEW_ONLY"&&report.contexts.length>0;
}
