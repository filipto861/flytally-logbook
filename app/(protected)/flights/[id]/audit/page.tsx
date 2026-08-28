import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { flightAuditChanges } from "@/lib/flight-audit";
import { integrityLabel,verifyFlightCertification } from "@/lib/certification-integrity";
import { storedObject,verificationCryptographicStatus,verificationIdentity,verificationSource } from "@/lib/authority-verification";

export const metadata={title:"Certification audit | FlyTally"};
const text=(value:unknown)=>String(value??"").trim();
const dateTime=(value:unknown)=>{const d=new Date(String(value??""));return Number.isNaN(d.getTime())?text(value):new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(d)+" UTC"};
const metaFields=new Set(["record_revision","certified_at","correction_reason","locked_at"]);
type CertifiedRow=Record<string,unknown>&{certification_hash:unknown;certification_version:unknown};

export default async function FlightAuditReport({params}:{params:Promise<{id:string}>}){
  const {userId}=await requireUser();const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<=0)notFound();await ensureDatabaseOptimizations();
  const [currentRows,archiveRows,approvalRows,verificationRows]=await Promise.all([
    sql`SELECT f.*,u.display_name pilot_name FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${id} AND f.user_id=${userId} LIMIT 1` as Promise<Array<CertifiedRow>>,
    sql`SELECT revision_number,certification_hash,certification_version,certified_at,superseded_at,correction_reason,snapshot_data FROM flight_certified_revisions WHERE flight_id=${id} AND user_id=${userId} ORDER BY revision_number ASC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT a.record_revision,a.status,a.requested_at,a.decided_at,a.decision_note,u.display_name instructor_name FROM instructor_flight_approvals a JOIN users u ON u.id=a.instructor_user_id WHERE a.flight_id=${id} AND a.student_user_id=${userId} ORDER BY a.record_revision` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT v.*,u.display_name signer_name FROM flight_verifications v LEFT JOIN users u ON u.id=v.signer_user_id WHERE v.flight_id=${id} AND v.flight_user_id=${userId} ORDER BY v.record_revision,v.id` as Promise<Array<Record<string,unknown>>>
  ]);
  const current=currentRows[0];if(!current)notFound();
  const currentRevision=Math.max(1,Number(current.record_revision||1)),currentCertified=Boolean(current.certified_at);
  const versions=archiveRows.map(row=>({revision:Number(row.revision_number),snapshot:{...storedObject(row.snapshot_data),certification_hash:row.certification_hash,certification_version:row.certification_version} as CertifiedRow,certifiedAt:row.certified_at,supersededAt:row.superseded_at,reason:text(row.correction_reason),archived:true}));
  versions.push({revision:currentRevision,snapshot:current,certifiedAt:current.certified_at,supersededAt:null,reason:text(current.correction_reason),archived:false});
  versions.sort((a,b)=>a.revision-b.revision);
  const integrity=versions.map(version=>({...version,integrity:version.certifiedAt?verifyFlightCertification(version.snapshot,userId):null}));
  const problemCount=integrity.filter(item=>item.integrity&&item.integrity.status!=="verified").length;
  return <div className="print-logbook">
    <header className="page-header print-trigger"><div><p className="eyebrow">CERTIFIED RECORD AUDIT</p><h1>{text(current.registration)||"Flight"} · {text(current.date)}</h1><p className="muted">{text(current.departure)||"—"} → {text(current.arrival)||"—"} · current revision R{currentRevision}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights/${id}`}>← Flight detail</Link><Link className="primary-button" href={`/flights/${id}/verification-report`}>Verification report</Link><PrintButton/></div></header>
    <section className="flight-summary"><div><span>Revisions</span><strong>{versions.length}</strong></div><div><span>Current state</span><strong>{currentCertified?`Certified R${currentRevision}`:`Draft R${currentRevision}`}</strong></div><div><span>Integrity</span><strong>{problemCount?`${problemCount} issue${problemCount===1?"":"s"}`:"Verified"}</strong></div></section>
    <section className="panel"><p className="eyebrow">AUDIT PURPOSE</p><h2>Certification and correction chain</h2><p className="muted">Every preserved certified revision is checked against its stored SHA-256 fingerprint. Changes to the next revision and verification history remain separate from the pilot's current editable record.</p></section>
    <section className="panel"><div className="flight-audit-list">{integrity.map((version,index)=>{const next=integrity[index+1],changes=next?flightAuditChanges(version.snapshot,next.snapshot).filter(change=>!metaFields.has(change.field)):[],result=version.integrity;return <article key={version.revision}><header><div><strong>Revision {version.revision}{version.archived?" · Certified and superseded":currentCertified?" · Current certified version":" · Current correction draft"}</strong><small>{version.certifiedAt?`Certified ${dateTime(version.certifiedAt)}`:"Not certified"}{version.supersededAt?` · Superseded ${dateTime(version.supersededAt)}`:""}</small></div>{result?<span className={`audit-action ${result.status==="verified"?"created":"deleted"}`}>{integrityLabel(result)}</span>:<span className="audit-action updated">draft</span>}</header>{result?<><p className="muted">SHA-256 {result.stored||"—"}</p>{result.status==="mismatch"?<p className="form-error">Calculated fingerprint: {result.calculated}</p>:null}</>:null}{version.reason?<p><b>Correction reason:</b> {version.reason}</p>:null}{next?<div><p className="eyebrow">CHANGES TO R{next.revision}</p>{changes.length?<div className="audit-changes">{changes.map(change=><div key={change.field}><b>{change.label}</b><del>{change.before}</del><ins>{change.after}</ins></div>)}</div>:<p className="muted">No material logbook fields changed.</p>}</div>:null}</article>})}</div></section>
    {approvalRows.length?<section className="panel"><p className="eyebrow">LEGACY REQUEST HISTORY</p><h2>Instructor decision projection</h2><div className="flight-audit-list">{approvalRows.map((row,index)=><article key={`${text(row.record_revision)}-${index}`}><header><div><strong>Revision {text(row.record_revision)} · {text(row.instructor_name)}</strong><small>Requested {dateTime(row.requested_at)}{row.decided_at?` · Decided ${dateTime(row.decided_at)}`:""}</small></div><span className={`audit-action ${row.status==="approved"?"created":row.status==="declined"?"deleted":"updated"}`}>{text(row.status)}</span></header>{row.decision_note?<p>{text(row.decision_note)}</p>:null}</article>)}</div></section>:null}
    {verificationRows.length?<section className="panel"><p className="eyebrow">VERIFICATION EVIDENCE</p><h2>Signature history</h2><div className="flight-audit-list">{verificationRows.map(row=>{const crypto=verificationCryptographicStatus(row);return <article key={text(row.id)}><header><div><strong>R{text(row.record_revision)} · {verificationIdentity(row)} · {text(row.verification_role)}</strong><small>{row.signed_at?`Signed ${dateTime(row.signed_at)}`:"Not signed"}{row.revoked_at?` · Revoked ${dateTime(row.revoked_at)}`:""}</small></div><span className={`audit-action ${row.status==="signed"&&crypto==="verified"?"created":"deleted"}`}>{text(row.status)} · HMAC {crypto}</span></header><p className="muted">Identity source: {verificationSource(row)} · flight SHA-256 {text(row.payload_hash)||text(row.flight_hash)||"—"}</p>{row.revocation_reason?<p><b>Revocation reason:</b> {text(row.revocation_reason)}</p>:null}</article>})}</div></section>:null}
    <footer className="muted">FlyTally certification audit · generated from the current server-authoritative record and immutable certified revision archive.</footer>
  </div>;
}
