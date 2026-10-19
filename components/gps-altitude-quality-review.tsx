"use client";

import {useMemo} from "react";
import type {KmlPoint} from "@/lib/track-processing";
import {
  inspectR3P1AQualityContexts,R3_P1A_REVISION,
} from "@/research/gps-detection-r21/stage-r3-p1a-source-quality-contexts";

/**
 * Experimental, opt-in local source-quality notice only.
 * No source indices, UTC, GPS location, height, touchdown label, or form values
 * leave this component. Not part of native V2 source eligibility.
 */
export function GpsAltitudeQualityReview({
  sourceText,canonicalPoints,splitCuts,
}:{
  sourceText:string;
  canonicalPoints:readonly KmlPoint[];
  splitCuts:readonly number[];
}){
  // Source/cuts are exact current owner-local upload state; never cache across
  // file replacement or manual split changes. P1A independently re-parses
  // original KML and validates canonical/source equality.
  const report=useMemo(()=>inspectR3P1AQualityContexts({
    sourceText,canonicalPoints,splitCuts,expectedRevision:R3_P1A_REVISION,
  }),[sourceText,canonicalPoints,splitCuts]);

  // UNKNOWN, unsupported or no qualifying diagnostic must not imply no
  // landing; simply leave original import/manual-review UI unchanged.
  if(report.status!=="QUALITY_REVIEW_ONLY"||report.contexts.length===0)return null;
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
