/** R2.1a OFFLINE RESEARCH ONLY — source-derived motion != confirmed logbook landing.
 * Neither this module nor the track-only analysis writes to or imports production.
 */
import type {AdvisoryPatternCount,ResearchAnalysis} from "./detector.ts";

/** Completeness must be supplied by separate, genuinely supported evidence.
 * Never infer flight completeness from a KML start/end coordinate or point count. */
export type FlightCoverageEvidence="INCOMPLETE"|"UNKNOWN"|"COMPLETE_INDEPENDENTLY_VERIFIED";

export type WholeFlightLandingCountFromGps={
  kind:"WHOLE_FLIGHT_LANDING_COUNT";
  status:"UNAVAILABLE";
  basis:"GPS_ONLY";
  reason:"INCOMPLETE_TRACK"|"COVERAGE_UNVERIFIED"|"PHYSICAL_CONTACT_UNVERIFIED";
};

/** Deliberately has no numeric count and never returns AVAILABLE for bare GPS.
 * Pilot-confirmed canonical landings remain a separate, existing logbook record. */
export function assessWholeFlightLandingsFromGps(coverage:FlightCoverageEvidence):WholeFlightLandingCountFromGps{
  const reason=coverage==="INCOMPLETE"?"INCOMPLETE_TRACK":coverage==="UNKNOWN"?"COVERAGE_UNVERIFIED":"PHYSICAL_CONTACT_UNVERIFIED";
  return{kind:"WHOLE_FLIGHT_LANDING_COUNT",status:"UNAVAILABLE",basis:"GPS_ONLY",reason};
}

export type GpsCountDistinction={
  observedPatterns:AdvisoryPatternCount;
  wholeFlightLandings:WholeFlightLandingCountFromGps;
};

/** Scope is explicit: pattern count covers only observed valid islands,
 * NOT all movements in a (possibly cropped) flight. No automatic conversion. */
export function separateGpsCounts(analysis:ResearchAnalysis,coverage:FlightCoverageEvidence):GpsCountDistinction{
  return{observedPatterns:analysis.patternCount,wholeFlightLandings:assessWholeFlightLandingsFromGps(coverage)};
}
