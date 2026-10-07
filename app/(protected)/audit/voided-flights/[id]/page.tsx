import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { integrityLabel,verifyFlightCertification } from "@/lib/certification-integrity";
import { storedObject,verificationCryptographicStatus,verificationIdentity,verificationSource } from "@/lib/authority-verification";
import { voidEvidenceSha256 } from "@/lib/void-evidence";

export const metadata={title:"Voided flight audit | FlyTally"};

const text=(value:unknown)=>String(value??"").trim();
const dateTime=(value:unknown)=>{const d=new Date(String(value??""));return Number.isNaN(d.getTime())?text(value):new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(d)+" UTC"};
const countByKind=(rows:Array<Record<string,unknown>>):Record<string,number>=>rows.reduce<Record<string,number>>((out,row)=>{const key=text(row.item_kind)||"OTHER";out[key]=(out[key]??0)+1;return out},{});
type CertifiedRow=Record<string,unknown>&{certification_hash:unknown;certification_version:unknown};

export default async function VoidedFlightAuditPage({params}:{params:Promise<{id:string}>}){
  const{userId}=await requireUser(),id=Number((await params).id);if(!Number.isSafeInteger(id)||id<=0)notFound();await ensureDatabaseOptimizations();

  const[parentRows,revisionRows,verificationRows,itemRows]=await Promise.all([
    sql`SELECT v.*,actor.display_name voided_by_name,certifier.display_name certified_by_name
      FROM voided_certified_flights v
      LEFT JOIN users actor ON actor.id=v.voided_by_user_id
      LEFT JOIN users certifier ON certifier.id=v.certified_by_user_id
      WHERE v.id=${id} AND v.user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT * FROM voided_flight_certified_revisions WHERE voided_flight_id=${id} ORDER BY revision_number,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT * FROM voided_flight_verifications WHERE voided_flight_id=${id} ORDER BY record_revision,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT item_kind,source_key,source_data,source_sha256,archived_at FROM voided_flight_archive_items WHERE voided_flight_id=${id} ORDER BY item_kind,id` as Promise<Array<Record<string,unknown>>>,
  ]);

  const parent=parentRows[0];if(!parent)notFound();
  const snapshot=storedObject(parent.flight_snapshot) as CertifiedRow;
  const archiveHashCalculated=voidEvidenceSha256(snapshot),archiveHashStored=text(parent.flight_snapshot_sha256),archiveIntegrity=archiveHashStored===archiveHashCalculated;
  const certificationIntegrity=verifyFlightCertification(snapshot,userId);
  const itemCounts=countByKind(itemRows);
  const registration=text(snapshot.registration)||"Flight",date=text(snapshot.date),route=`${text(snapshot.departure)||"—"} → ${text(snapshot.arrival)||"—"}`;
  const verificationIntegrityProblems=verificationRows.filter(row=>verificationCryptographicStatus(storedObject(row.source_data))!=="verified"&&text(row.status)==="signed").length;

  return <div className="print-logbook">
    <header className="page-header print-trigger">
      <div><p className="eyebrow">VOIDED CERTIFIED RECORD AUDIT</p><h1>{registration} · {date}</h1><p className="muted">{route} · removed from active logbook use</p></div>
      <div className="detail-navigation"><Link className="secondary-link" href="/flights">← Flights</Link><PrintButton/></div>
    </header>

    <section className="flight-summary">
      <div><span>State</span><strong>VOIDED</strong><small>Not active logbook data</small></div>
      <div><span>Certified revision</span><strong>R{text(parent.record_revision)}</strong><small>Certification v{text(parent.certification_version)}</small></div>
      <div><span>Archive integrity</span><strong>{archiveIntegrity?"Verified":"Review required"}</strong></div>
      <div><span>Certification integrity</span><strong>{integrityLabel(certificationIntegrity)}</strong></div>
    </section>

    <section className="panel danger-zone">
      <p className="eyebrow">REMOVAL EVENT</p>
      <h2>Certified flight removed from active logbook</h2>
      <p>This record no longer appears in operational logbook views and contributes no totals, statistics, map, export or recency/compliance credit. The evidence below is retained only as immutable audit history.</p>
      <div className="audit-changes">
        <div><b>Removed</b><ins>{dateTime(parent.voided_at)}</ins></div>
        <div><b>Removed by</b><ins>{text(parent.voided_by_name)||`User ${text(parent.voided_by_user_id)}`}</ins></div>
        <div><b>Reason</b><ins>{text(parent.void_reason)}</ins></div>
        <div><b>Original flight ID</b><ins>{text(parent.original_flight_id)}</ins></div>
      </div>
    </section>

    <section className="panel">
      <p className="eyebrow">CERTIFIED SNAPSHOT</p>
      <h2>Protected source record</h2>
      <div className="audit-changes">
        <div><b>Flight</b><ins>{registration} · {route}</ins></div>
        <div><b>Role</b><ins>{text(snapshot.role)||"—"}</ins></div>
        <div><b>Logbook</b><ins>{text(snapshot.evidence)||"—"}</ins></div>
        <div><b>Certified</b><ins>{dateTime(parent.certified_at)}</ins></div>
        <div><b>Certification SHA-256</b><ins>{text(parent.certification_hash)||"—"}</ins></div>
        <div><b>Archive SHA-256</b><ins>{archiveHashStored||"—"}</ins></div>
      </div>
      {!archiveIntegrity?<p className="form-error">Stored archive snapshot hash does not match the current immutable snapshot payload.</p>:null}
      {certificationIntegrity.status!=="verified"?<p className="form-error">The preserved certification fingerprint requires review: {integrityLabel(certificationIntegrity)}.</p>:null}
    </section>

    <section className="panel">
      <p className="eyebrow">CERTIFICATION HISTORY</p>
      <h2>Preserved revisions</h2>
      {revisionRows.length?<div className="flight-audit-list">{revisionRows.map(row=>{
        const data={...storedObject(row.snapshot_data),certification_hash:row.certification_hash,certification_version:row.certification_version} as CertifiedRow;
        const integrity=verifyFlightCertification(data,userId),snapshotHash=voidEvidenceSha256(storedObject(row.snapshot_data)),archiveOk=snapshotHash===text(row.snapshot_sha256);
        return <article key={text(row.id)}><header><div><strong>Revision {text(row.revision_number)}</strong><small>Certified {dateTime(row.certified_at)}{row.superseded_at?` · Superseded ${dateTime(row.superseded_at)}`:""}</small></div><span className={`audit-action ${integrity.status==="verified"&&archiveOk?"created":"deleted"}`}>{integrityLabel(integrity)} · archive {archiveOk?"verified":"mismatch"}</span></header>{row.correction_reason?<p><b>Correction reason:</b> {text(row.correction_reason)}</p>:null}<p className="muted">Certification SHA-256 {text(row.certification_hash)||"—"} · archive SHA-256 {text(row.snapshot_sha256)||"—"}</p></article>;
      })}</div>:<p className="empty-state">No superseded certified revisions preceded the voided current revision.</p>}
    </section>

    <section className="panel">
      <p className="eyebrow">VERIFICATION EVIDENCE</p>
      <h2>Archived signatures and verification records</h2>
      {verificationRows.length?<div className="flight-audit-list">{verificationRows.map(row=>{
        const source=storedObject(row.source_data),crypto=verificationCryptographicStatus(source);
        return <article key={text(row.id)}><header><div><strong>R{text(row.record_revision)} · {verificationIdentity(source)} · {text(row.verification_role)}</strong><small>{row.signed_at?`Signed ${dateTime(row.signed_at)}`:"Not signed"}{row.revoked_at?` · Revoked ${dateTime(row.revoked_at)}`:""}</small></div><span className={`audit-action ${text(row.status)==="signed"&&crypto==="verified"?"created":"updated"}`}>{text(row.status)} · HMAC {crypto}</span></header><p className="muted">Identity source: {verificationSource(source)} · flight SHA-256 {text(row.flight_hash)||"—"}</p></article>;
      })}</div>:<p className="empty-state">No external verification evidence was stored for this record.</p>}
      {verificationIntegrityProblems?<p className="form-error">{verificationIntegrityProblems} archived signed verification record{verificationIntegrityProblems===1?"":"s"} require integrity review.</p>:null}
    </section>

    <section className="panel">
      <p className="eyebrow">DEPENDENT EVIDENCE</p>
      <h2>Archived workflow and operational evidence</h2>
      {Object.keys(itemCounts).length?<div className="audit-changes">{Object.entries(itemCounts).map(([kind,count])=><div key={kind}><b>{kind.replaceAll("_"," ")}</b><ins>{count}</ins></div>)}</div>:<p className="empty-state">No dependent evidence was attached to this certified flight.</p>}
    </section>

    <footer className="muted">FlyTally void audit · permanent historical evidence only. This record is not an active flight and is not used for logbook totals or regulatory/recency calculations.</footer>
  </div>;
}
