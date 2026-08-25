export type ScoredAirportCandidate={distanceKm:number;score:number};

export type AutomaticAirportPolicy={
  maxDistanceKm:number;
  ambiguityCheckAfterKm:number;
  minimumScoreLead:number;
};

export const DEFAULT_AUTOMATIC_AIRPORT_POLICY:AutomaticAirportPolicy={
  maxDistanceKm:4,
  ambiguityCheckAfterKm:1.5,
  minimumScoreLead:1,
};

/**
 * Conservative automatic airport selection for GPS imports.
 *
 * Nearby candidates remain available for manual review even when this function
 * returns null. Automatic selection is intentionally limited to airports close
 * to the actual track edge; when the aircraft is farther from the best match,
 * the best candidate must also be clearly better than the runner-up.
 */
export function selectAutomaticAirport<T extends ScoredAirportCandidate>(
  candidates:T[],
  policy:AutomaticAirportPolicy=DEFAULT_AUTOMATIC_AIRPORT_POLICY,
):T|null{
  const best=candidates[0],second=candidates[1];
  if(!best||!Number.isFinite(best.distanceKm)||!Number.isFinite(best.score)||best.distanceKm>policy.maxDistanceKm)return null;
  if(second&&best.distanceKm>policy.ambiguityCheckAfterKm){
    const lead=Number(second.score)-Number(best.score);
    if(!Number.isFinite(lead)||lead<policy.minimumScoreLead)return null;
  }
  return best;
}
