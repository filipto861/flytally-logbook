"use client";

import Link from "next/link";

export type FlightWorkflowState={
  certified:boolean;
  correctionDraft:boolean;
  locked:boolean;
  blockers:number;
  recordRevision:number;
  shareHref:string;
};

export function FlightWorkflowProgress({state,activeTab,onSelectTab}:{state:FlightWorkflowState;activeTab:"overview"|"gps"|"logbook";onSelectTab:(tab:"overview"|"gps"|"logbook")=>void}){
  const draft=!state.certified;
  const certificationBlocked=draft&&(state.locked||state.blockers>0);
  const stage=(label:string,status:"done"|"current"|"next"|"blocked")=><div className={`flight-workflow-step ${status}`} aria-current={status==="current"?"step":undefined}><span aria-hidden="true">{status==="done"?"✓":status==="blocked"?"!":"•"}</span><strong>{label}</strong></div>;
  const reviewStatus=state.certified?"done":"current";
  const certifyStatus=state.certified?"done":certificationBlocked?"blocked":"next";
  const shareStatus=state.certified?"current":"blocked";
  const heading=state.certified?`Certified revision ${state.recordRevision}`:state.correctionDraft?`Review correction R${state.recordRevision}`:state.locked?"Record locked":state.blockers?`${state.blockers} ${state.blockers===1?"issue":"issues"} before certification`:"Review, then certify";
  const description=state.certified?"The protected record is ready for sharing. Corrections create a new revision and preserve this one.":state.correctionDraft?"Review the corrected Logbook data before certifying this new revision.":state.locked?"Unlock the record from Overview before editing or certification.":state.blockers?"Resolve the blocking Logbook data below. Certification stays unavailable until those issues are fixed.":"Check the final Logbook data, then certify when the record is complete.";
  return <section className="flight-workflow" aria-label="Flight record workflow">
    <header><div><p className="eyebrow">RECORD WORKFLOW</p><h2>{heading}</h2><p className="muted">{description}</p></div>
      <div className="flight-workflow-primary">
        {state.certified?<Link className="primary-button" href={state.shareHref}>Share flight</Link>:state.locked?<button className="secondary-button" type="button" onClick={()=>onSelectTab("overview")}>Open record controls</button>:activeTab==="logbook"&&state.blockers?<span className="flight-workflow-hint">Fix the highlighted issues below</span>:activeTab==="logbook"?<button className="primary-button" type="button" onClick={()=>onSelectTab("overview")}>Continue to certification</button>:<button className="primary-button" type="button" onClick={()=>onSelectTab("logbook")}>{state.blockers?"Review issues":"Review Logbook data"}</button>}
      </div>
    </header>
    <div className="flight-workflow-steps">
      {stage("Saved","done")}
      {stage("Review",reviewStatus)}
      {stage("Certify",certifyStatus)}
      {stage("Share",shareStatus)}
    </div>
  </section>;
}
