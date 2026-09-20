import Link from "next/link";

import {
  flyTallyBrandStatus,
  getBrandClaimsReadiness,
  publicClaimRegistry,
} from "@/lib/brand-claims";

export const metadata={
  title:"Brand & public claims | FlyTally",
  description:"FlyTally brand, trademark and public marketing/regulatory claim boundaries."
};

export default function BrandClaimsPage(){
  const readiness=getBrandClaimsReadiness();

  return <main className="page-shell legal-page-shell legal-page-shell-wide">
    <div className="page-heading">
      <div>
        <p className="eyebrow">LEGAL · BRAND & PUBLIC CLAIMS</p>
        <h1>Brand & public claims</h1>
        <p className="muted">What FlyTally may say publicly about the product, and which claims require external evidence first.</p>
      </div>
      <Link className="secondary-button" href="/legal">All legal notices</Link>
    </div>

    <section className="panel">
      <p className="eyebrow">BRAND STATUS</p>
      <h2>{flyTallyBrandStatus.name}</h2>
      <p>{flyTallyBrandStatus.note}</p>
      <div className="audit-changes">
        <div><b>Registered trademark claimed</b><ins>NO</ins></div>
        <div><b>® symbol allowed</b><ins>NO</ins></div>
        <div><b>Registration status</b><ins>{flyTallyBrandStatus.registrationStatus}</ins></div>
      </div>
    </section>

    <section className="panel legal-section-stack">
      <div>
        <p className="eyebrow">CLAIM REGISTRY</p>
        <h2>Approved wording and evidence boundaries</h2>
      </div>
      {publicClaimRegistry.map(item=><article key={item.id} className="legal-list-item">
        <strong>{item.label}</strong>
        <p className="muted legal-copy-tight">Status: {item.status.replaceAll("_"," ")}</p>
        {item.approvedWording.length?<p className="legal-copy-tight"><b>Permitted wording:</b> {item.approvedWording.join(" · ")}</p>:null}
        <p className="legal-summary">{item.boundary}</p>
      </article>)}
    </section>

    <section className="panel">
      <p className="eyebrow">COMMERCIAL RELEASE GATE</p>
      <h2>{readiness.commercialReady?"Brand/claims evidence gate complete":"External brand/claims validation incomplete"}</h2>
      <p className="muted">Policy version {readiness.policyVersion}. A trademark/brand decision and marketing-claims review must be explicit, and matching external evidence must be committed before commercial mode can rely on those claims.</p>
    </section>
  </main>;
}
