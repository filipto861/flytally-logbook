import Link from "next/link";

import { getCommercialReleaseAudit } from "@/lib/commercial-release-audit";

export const metadata={
  title:"Release status | FlyTally",
  description:"Current FlyTally commercial release status."
};

export default function ReleaseStatusPage(){
  const audit=getCommercialReleaseAudit();
  const enabled=audit.commercialLaunchEnabled;
  const transitionReady=audit.verdict==="READY_FOR_TRANSITION";

  return <main className="page-shell" style={{maxWidth:"900px",margin:"0 auto"}}>
    <div className="page-heading">
      <div>
        <p className="eyebrow">LEGAL · RELEASE STATUS</p>
        <h1>FlyTally release status</h1>
        <p className="muted">The v2.9 technical commercial-release controls are implemented. Commercial availability is enabled only after the complete release gate is cleared.</p>
      </div>
      <Link className="secondary-button" href="/legal">All legal notices</Link>
    </div>

    <section className="panel">
      <p className="eyebrow">CURRENT STATE</p>
      <h2>{enabled?"Commercial release gate cleared":transitionReady?"Validated and ready for deliberate transition":"Commercial launch not cleared"}</h2>
      <p>Effective release stage: <strong>{audit.effectiveStage.replaceAll("-"," ")}</strong>.</p>
      <p className="muted">{enabled
        ?"The canonical release gate is currently clear for commercial operation."
        :transitionReady
          ?"All release gates are validated, but commercial mode is not enabled until a separate deliberate launch-stage transition is deployed."
          :"FlyTally remains outside commercial launch while required legal, operational, billing, regulatory, rights and brand evidence is incomplete. No approval or commercial clearance should be inferred from the technical implementation alone."}</p>
    </section>

    <section className="panel">
      <p className="eyebrow">AUDIT CONTROL</p>
      <h2>Fail-closed release boundary</h2>
      <p className="muted">Final audit version {audit.auditVersion}. A production build that requests the commercial stage is rejected unless the complete canonical release gate is clear.</p>
    </section>
  </main>;
}
