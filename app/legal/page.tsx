import Link from "next/link";
import { LEGAL_EFFECTIVE_DATE, legalDocuments, legalDocumentKeys } from "@/lib/legal";\nimport { getCommercialReadiness } from "@/lib/commercial-readiness";

export const metadata={title:"Legal & compliance | FlyTally",description:"FlyTally privacy, terms, cookies, aviation safety and provider information."};

export default function LegalIndexPage(){
  return <main className="page-shell" style={{maxWidth:"900px",margin:"0 auto"}}>
    <div className="page-heading"><div><p className="eyebrow">FLYTALLY</p><h1>Legal & compliance</h1><p className="muted">Private-beta legal, privacy and aviation-safety information. Effective {LEGAL_EFFECTIVE_DATE}.</p><p className="muted" style={{marginTop:"6px"}}>Release stage: <strong>{stageLabel}</strong>.</p></div></div>
    <section className="panel" style={{display:"grid",gap:"14px"}}>
      {legalDocumentKeys.map(key=>{const doc=legalDocuments[key];return <article key={key} style={{paddingBottom:"14px",borderBottom:"1px solid var(--border)"}}><h2 style={{marginBottom:"6px"}}><Link href={`/legal/${key}`}>{doc.title}</Link></h2><p className="muted" style={{margin:0}}>{doc.summary}</p></article>})}
    </section>
    <p className="muted" style={{fontSize:".78rem",marginTop:"18px"}}>{readiness.effectiveStage==="external-validation" ? "FlyTally remains in private beta while commercial and external validation is completed. No public commercial clearance is implied." : "FlyTally is currently an invitation-only private beta. Formal operator identification and external validation remain release blockers before public commercial launch."}</p>
  </main>;
}
