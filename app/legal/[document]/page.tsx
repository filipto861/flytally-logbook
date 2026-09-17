import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {LEGAL_EFFECTIVE_DATE,legalDocuments,legalDocumentKeys,type LegalDocumentKey} from "@/lib/legal";

export function generateStaticParams(){return legalDocumentKeys.map(document=>({document}));}
export async function generateMetadata({params}:{params:Promise<{document:string}>}):Promise<Metadata>{const key=(await params).document as LegalDocumentKey;const doc=legalDocuments[key];return doc?{title:`${doc.title} | FlyTally`,description:doc.summary}:{title:"Legal | FlyTally"};}

export default async function LegalDocumentPage({params}:{params:Promise<{document:string}>}){
  const key=(await params).document as LegalDocumentKey,doc=legalDocuments[key];if(!doc)notFound();
  return <main className="page-shell" style={{maxWidth:"900px",margin:"0 auto"}}>
    <div className="page-heading"><div><p className="eyebrow">LEGAL · EFFECTIVE {LEGAL_EFFECTIVE_DATE.toUpperCase()}</p><h1>{doc.title}</h1><p className="muted">{doc.summary}</p></div><Link className="secondary-button" href="/legal">All legal notices</Link></div>
    <section className="panel" style={{display:"grid",gap:"24px"}}>{doc.sections.map(section=><article key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</article>)}</section>
  </main>;
}
