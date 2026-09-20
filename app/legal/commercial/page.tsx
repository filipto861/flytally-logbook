import Link from "next/link";
import { commercialLegalArtifacts, getCommercialLegalPublicationState } from "@/lib/commercial-legal";

export const metadata={
  title:"Commercial launch information | FlyTally",
  description:"Status of FlyTally commercial legal and consumer documentation."
};

export default function CommercialLegalPage(){
  const state=getCommercialLegalPublicationState();

  return <main className="page-shell legal-page-shell">
    <div className="page-heading">
      <div>
        <p className="eyebrow">LEGAL · COMMERCIAL LAUNCH</p>
        <h1>Commercial launch information</h1>
        <p className="muted">FlyTally is not currently presenting these commercial documents as effective terms.</p>
      </div>
      <Link className="secondary-button" href="/legal">All legal notices</Link>
    </div>

    <section className="panel legal-section-stack">
      <div>
        <h2>Current status</h2>
        <p>The current private-beta terms remain the applicable FlyTally terms. Commercial documents will only become effective after the exact committed bundle has completed external review and publication controls.</p>
        <p className="muted legal-summary">Publication state: <strong>{state.publicationReady ? "Published and version-matched" : "Not effective — external review/publication incomplete"}</strong>.</p>
      </div>

      <div>
        <h2>Commercial document set</h2>
        <div className="legal-card-list">
          {commercialLegalArtifacts.map(artifact=><article key={artifact.key} className="legal-list-item">
            <strong>{artifact.title}</strong>
            <p className="muted legal-card-copy">{artifact.purpose}</p>
          </article>)}
        </div>
      </div>

      <div>
        <h2>Safety boundary</h2>
        <p className="legal-summary">This page is a publication-control surface, not legal advice and not evidence of lawyer, consumer-authority, ÚCL, LAA ČR, EASA or other regulator approval. FlyTally will not switch to commercial mode merely because a draft exists.</p>
      </div>
    </section>
  </main>;
}
