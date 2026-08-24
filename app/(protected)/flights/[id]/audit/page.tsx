import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { flightAuditChanges } from "@/lib/flight-audit";
import { integrityLabel,verifyFlightCertification } from "@/lib/certification-integrity";

export const metadata={title:"Certification audit | FlyTally"};
const text=(value:unknown)=>String(value??"").trim();
const dateTime=(value:unknown)=>{const d=new Date(String(value??""));return Number.isNaN(d.getTime())?text(value):new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(d)+" UTC"};
const snapshot=(value:unknown)=>{if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}};
const metaFields=new Set(["record_revision","certified_at","correction_reason","locked_at"]);

export default async function FlightAuditReport({params}:{params:Promise<{id:string}>}){
  const {userId}=await requireUser();const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<=0)notFound();await ensureDatabaseOptimizations();
  const [currentRows,archiveRows]=await Promise.all([
    sql`SELECT f.*,u.display_name pilot_name FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${id} AND f.user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT revision_number,certification_hash,certification_version,certified_at,superseded_at,correction_reason,snapshot_data FROM flight_certified_revisions WHERE flight_id=${id} AND user_id=${userId} ORDER BY revision_number ASC` as Promise<Array<Record<string,unknown>>>
  ]);
  const current=currentRows[0];if(!current)notFound();
  const currentRevision=Math.max(1,Number(current.record_revision||1)),currentCertified=Boolean(current.certified_at);
  const versions=archiveRows.map(row=>({revision:Number(row.revision_number),snapshot:{...snapshot(row.snapshot_data),certification_hash:row.certification_hash,certification_version:row.certification_version},certifiedAt:row.certified_at,supersededAt:row.superseded_at,reason:text(row.correction_reason),archived:true}));
  versions.push({revision:currentRevision,snapshot:current,certifiedAt:current.certified_at,supersededAt:null,reason:text(current.correction_reason),archived:false});
  versions.sort((a,b)=>a.revision-b.revision);
  const integrity=versions.map(version=>({...version,integrity:version.certifiedAt?verifyFlightCertification(version.snapshot,userId):null}));
  const problemCount=integrity.filter(item=>item.integrity&&item.integrity.status!=="verified").length;
  return <div className="print-logbook">
    <header className="page-header print-trigger"><div><p className="eyebrow">CERTIFIED RECORD AUDIT</p><h1>{text(current.registration)||"Flight"} · {text(current.date)}</h1><p className="muted">{text(current.departure)||"—"} → {text(current.arrival)||"—"} · current revision R{currentRevision}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights/${id}`}>← Flight detail</Link><PrintButton/></div></header>
    <section className="flight-summary"><div><span>Revisions</span><strong>{versions.length}</strong></div><div><span>Current state</span><strong>{currentCertified?`Certified R${currentRevision}`:`Draft R${currentRevision}`}</strong></div><div><span>Integrity</span><strong>{problemCount?`${problemCount} issue${problemCount===1?"":"s"}`:"Verified"}</strong></div></section>
    <section className="panel"><p className="eyebrow">AUDIT PURPOSE</p><h2>Certification and correction chain</h2><p className="muted">This report shows every preserved certified revision, the reason a revision was superseded, its SHA-256 verification result and the material changes made in the following revision. It does not replace the Pilot Logbook printout.</p></section>
    <section className="panel"><div className="flight-audit-list">{integrity.map((version,index)=>{const next=integrity[index+1],changes=next?flightAuditChanges(version.snapshot,next.snapshot).filter(change=>!metaFields.has(change.field)):[],result=version.integrity;return <article key={version.revision}><header><div><strong>Revision {version.revision}{version.archived?" · Certified and superseded":currentCertified?" · Current certified version":" · Current correction draft"}</strong><small>{version.certifiedAt?`Certified ${dateTime(version.certifiedAt)}`:"Not certified"}{version.supersededAt?` · Superseded ${dateTime(version.supersededAt)}`:""}</small></div>{result?<span className={`audit-action ${result.status==="verified"?"created":"deleted"}`}>{integrityLabel(result)}</span>:<span className="audit-action updated">draft</span>}</header>{result?<><p className="muted">SHA-256 {result.stored||"—"}</p>{result.status==="mismatch"?<p className="form-error">Calculated fingerprint: {result.calculated}</p>:null}</>:null}{version.reason?<p><b>Correction reason:</b> {version.reason}</p>:null}{next?<div><p className="eyebrow">CHANGES TO R{next.revision}</p>{changes.length?<div className="audit-changes">{changes.map(change=><div key={change.field}><b>{change.label}</b><del>{change.before}</del><ins>{change.after}</ins></div>)}</div>:<p className="muted">No material logbook fields changed.</p>}</div>:null}</article>})}</div></section>
    <footer className="muted">FlyTally certification audit · generated from the current server-authoritative record and immutable certified revision archive.</footer>
  </div>;
}
