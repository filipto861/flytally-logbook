import Link from "next/link";
import { getCommercialReadiness } from "@/lib/commercial-readiness";
import { LEGAL_EFFECTIVE_DATE, legalDocuments, legalDocumentKeys } from "@/lib/legal";

export const metadata={title:"Legal & compliance | FlyTally",description:"FlyTally privacy, terms, cookies, aviation safety and provider information."};

export default function LegalIndexPage(){
  const readiness=getCommercialReadiness();
  const stageLabel=readiness.effectiveStage==="external-validation"
    ? "External commercial validation"
    : readiness.effectiveStage==="commercial"
      ? "Commercial"
      : "Private beta";

  return <main className="page-shell" style={{maxWidth:"900px",margin:"0 auto"}}>
    <div className="page-heading"><div><p className="eyebrow">FLYTALLY</p><h1>Legal & compliance</h1><p className="muted">Private-beta legal, privacy and aviation-safety information. Effective {LEGAL_EFFECTIVE_DATE}.</p><p className="muted" style={{marginTop:"6px"}}>Release stage: <strong>{stageLabel}</strong>.</p></div></div>
    <section className="panel" style={{display:"grid",gap:"14px"}}>
      {legalDocumentKeys.map(key=>{const doc=legalDocuments[key];return <article key={key} style={{paddingBottom:"14px",borderBottom:"1px solid var(--border)"}}><h2 style={{marginBottom:"6px"}}><Link href={`/legal/${key}`}>{doc.title}</Link></h2><p className="muted" style={{margin:0}}>{doc.summary}</p></article>})}
      <article style={{paddingBottom:"14px",borderBottom:"1px solid var(--border)"}}><h2 style={{marginBottom:"6px"}}><Link href="/legal/commercial">Commercial launch information</Link></h2><p className="muted" style={{margin:0}}>Versioned publication boundary for future commercial Terms, pricing, cancellation/refund, withdrawal and ADR documents. These documents are not currently effective.</p></article>
      <article style={{paddingBottom:"14px",borderBottom:"1px solid var(--border)"}}><h2 style={{marginBottom:"6px"}}><Link href="/legal/regulatory">Signature & regulatory validation</Link></h2><p className="muted" style={{margin:0}}>Current FlyTally signature assurance, QES boundary and EASA / ÚCL / LAA ČR validation status.</p></article>
      <article style={{paddingBottom:"14px",borderBottom:"1px solid var(--border)"}}><h2 style={{marginBottom:"6px"}}><Link href="/legal/brand-claims">Brand & public claims</Link></h2><p className="muted" style={{margin:0}}>FlyTally trademark status, permitted product wording and claims that require external evidence before publication.</p></article>
    </section>
    <p className="muted" style={{fontSize:".78rem",marginTop:"18px"}}>{readiness.effectiveStage==="external-validation"
      ? "FlyTally remains in private beta while commercial and external validation is completed. No public commercial clearance is implied."
      : "FlyTally is currently an invitation-only private beta. Formal operator identification and external validation remain release blockers before public commercial launch."}</p>
  </main>;
}
