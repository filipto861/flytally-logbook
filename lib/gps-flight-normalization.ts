import {
  gpsFlightCandidate,
  type FlightDraftCandidate,
  type GpsFlightCandidateInput,
} from "./flight-draft-candidate.ts";
import { normalizeFlightDraft,type FlightInput } from "./flight-input.ts";

export type GpsFlightNormalizationResult={
  candidate:FlightDraftCandidate;
  data?:FlightInput;
  error?:string;
};

/**
 * F1.4 preparation boundary.
 *
 * Builds the source-aware GPS candidate first, then delegates all flight
 * semantics to the same pure normalizer used by Manual entry. This helper is
 * intentionally not wired into importKmlFlight until F1.5/F1.6 supply the
 * required source-authority inputs.
 */
export function normalizeGpsReviewedFlight(input:GpsFlightCandidateInput):GpsFlightNormalizationResult{
  const candidate=gpsFlightCandidate(input);
  const normalized=normalizeFlightDraft(candidate);
  return{candidate,...normalized};
}
