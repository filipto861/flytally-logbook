import Link from "next/link";

import {
  getRegulatoryReadiness,
  regulatoryAuthorityStatuses,
  signatureAssuranceCatalog,
} from "@/lib/regulatory-validation";

export const metadata={
  title:"Signature & regulatory validation | FlyTally",
  description:"FlyTally signature assurance and aviation-regulatory validation status."
};

export default function RegulatoryValidationPage(){
  const readiness=getRegulatoryReadiness();

  return <main className="page-shell" style={{maxWidth:"960px",margin:"0 auto"}}>
    <div className="page-heading">
      <div>
        <p className="eyebrow">LEGAL · SIGNATURES & REGULATORY VALIDATION</p>
        <h1>Signature & regulatory validation</h1>
        <p className="muted">Technical evidence capabilities are separate from qualified electronic signatures and authority acceptance.</p>
      </div>
      <Link className="secondary-button" href="/legal">All legal notices</Link>
    </div>

    <section className="panel" style={{display:"grid",gap:"18px"}}>
      <div>
        <h2>Current signature assurance</h2>
        <p>FlyTally stores evidence that can bind a signer action to an exact record and detect later modification. FlyTally does <strong>not</strong> currently represent any of these mechanisms as an eIDAS qualified electronic signature (QES) or as an advanced electronic signature.</p>
      </div>
      <div style={{display:"grid",gap:"12px"}}>
        {signatureAssuranceCatalog.map(item=><article key={item.kind} style={{paddingBottom:"12px",borderBottom:"1px solid var(--border)"}}>
          <strong>{item.label}</strong>
          <p className="muted" style={{margin:"4px 0"}}>{item.identityAssurance}</p>
          <p className="muted" style={{margin:0}}>{item.integrityBinding}</p>
        </article>)}
      </div>
    </section>

    <section className="panel" style={{display:"grid",gap:"14px"}}>
      <div>
        <p className="eyebrow">AUTHORITY STATUS</p>
        <h2>No authority approval is implied</h2>
        <p className="muted">The statuses below describe FlyTally's validation work only. They are not approvals of FlyTally, a pilot, a licence, a flight, a signature or a training record.</p>
      </div>
      {regulatoryAuthorityStatuses.map(item=><article key={item.id} style={{paddingBottom:"12px",borderBottom:"1px solid var(--border)"}}>
        <strong>{item.label}</strong>
        <p className="muted" style={{margin:"4px 0"}}>Status: {item.status.replaceAll("_"," ")}</p>
        <p style={{margin:0}}>{item.note}</p>
      </article>)}
    </section>

    <section className="panel">
      <p className="eyebrow">COMMERCIAL RELEASE GATE</p>
      <h2>{readiness.commercialReady?"Regulatory evidence gate complete":"External validation incomplete"}</h2>
      <p className="muted">Strategy version {readiness.strategyVersion}. The commercial release remains blocked until the QES/signature strategy and aviation-validation strategy are explicitly resolved and the matching external evidence is committed to the release record.</p>
    </section>
  </main>;
}
