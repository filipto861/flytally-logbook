"use client";

import type {GpsR3QualityReport} from "@/lib/gps-r3-quality-review";
import {hasGpsR3QualityReview} from "@/lib/gps-r3-quality-review";

/**
 * Render-only experimental quality notice. Exact original source/provenance is
 * checked by P1A in a separate, opt-in parent useMemo; this component cannot
 * change a flight, invent a T&G marker or emit owner-private GPS measurements.
 */
export function GpsAltitudeQualityReview({
  report,
}:{report:GpsR3QualityReport|null}){
  // NO_QUALIFYING/UNAVAILABLE is not a proof of no touchdown or GPS accuracy.
  if(!hasGpsR3QualityReview(report)||report?.status!=="QUALITY_REVIEW_ONLY")
    return null;
  const count=report.contexts.length;
  const longGap=report.contexts.some(context=>
    context.coverage==="LONG_INTERVALS_UNASSESSED");
  return <section className="gps-r3-quality-review"
    aria-label="GPS altitude source quality review"
    data-gps-r3-quality-review>
    <strong>GPS altitude needs pilot review</strong>
    <p>{count===1
      ?"One recorded altitude discontinuity affects an altitude-based detection check."
      :`${count} recorded altitude discontinuities affect altitude-based detection checks.`}</p>
    {longGap?<p>Part of this evidence has a gap between GPS observations. Movement during the gap is unknown.</p>:null}
    <p className="gps-r3-quality-review-note">GPS cannot confirm wheel contact. Review the altitude graph and enter the correct landing total yourself. This notice does not add or change any landing.</p>
  </section>;
}
