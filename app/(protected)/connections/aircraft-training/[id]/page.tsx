import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { aircraftTrainingVerificationStatus } from "@/lib/aircraft-training-verification";
import { declineAircraftQualification,revokeAircraftQualificationSignature,signAircraftQualification } from "@/app/(protected)/credentials/aircraft-actions";

const t=(value:unknown)=>String(value??"").trim();
const label=(row:Record<string,unknown>)=>[t(row.aircraft_make),t(row.aircraft_model),t(row.aircraft_variant)].filter(Boolean).join(" ")||t(row.qualification_type)||"Aircraft training";
const kind=(value:unknown)=>value==="differences"?"Differences training":value==="familiarisation"?"Familiarisation":value==="class_type"?"Class / type training":value==="national"?"National / ULL authorisation":"Other aircraft training";

export default async function AircraftTrainingSignatureReview({params}:{params:Promise<{id:string}>}){
  const{userId}=await requireUser();await ensureRuntimeSchema();const recordId=Number((await params).id);if(!Number.isSafeInteger(recordId)||recordId<=0)notFound();
  const rows=await sql`SELECT q.id,q.user_id,q.qualification_type,q.certificate_reference,q.linked_licence_id,q.training_kind,q.aircraft_make,q.aircraft_model,q.aircraft_variant,q.differences,q.completed_on::text completed_on,q.instructor_name,q.training_organisation,q.notes,q.signature_status,q.verification_role,q.verified_at,q.verified_by_user_id,q.verification_snapshot,q.verification_signature,q.verification_note,q.verification_version,owner.display_name owner_name
    FROM pilot_qualifications q JOIN users owner ON owner.id=q.user_id
    WHERE q.id=${recordId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE AND q.requested_signer_user_id=${userId}
      AND (q.verified_by_user_id=${userId} OR EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=q.user_id AND c.recipient_user_id=${userId}) OR (c.requester_user_id=${userId} AND c.recipient_user_id=q.user_id)))) LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)notFound();
  const status=aircraftTrainingVerificationStatus(row),pending=status==="pending",verifiedByMe=status==="verified"&&Number(row.verified_by_user_id)===userId,role=t(row.verification_role)==="EXAMINER"?"examiner":"instructor";
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${userId} AND href=${`/connections/aircraft-training/${recordId}`}`;
  return <>
    <header className="page-header"><div><p className="eyebrow">AIRCRAFT TRAINING REVIEW</p><h1>{label(row)}</h1><p className="muted">{t(row.owner_name)} · {t(row.completed_on)||"date not recorded"} · requested {role} signature</p></div><Link className="secondary-link" href="/notifications">← Notifications</Link></header>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">TRAINING EVIDENCE</p><h2>{kind(row.training_kind)}</h2></div><span className={status==="verified"?"status-on":status==="pending"?"status-warning":status==="revoked"||status==="invalid"?"status-off":"record-status"}>{status.toUpperCase()}</span></div>
      <div className="detail-grid"><div><span>Class / type</span><strong>{t(row.qualification_type)||"—"}</strong></div><div><span>Aircraft</span><strong>{label(row)}</strong></div><div><span>Completed</span><strong>{t(row.completed_on)||"—"}</strong></div><div><span>Organisation</span><strong>{t(row.training_organisation)||"—"}</strong></div><div><span>Record reference</span><strong>{t(row.certificate_reference)||"—"}</strong></div><div><span>Requested role</span><strong>{t(row.verification_role)||"INSTRUCTOR"}</strong></div></div>
      {t(row.differences)?<p><strong>Differences / equipment:</strong> {t(row.differences)}</p>:null}{t(row.notes)?<p><strong>Notes:</strong> {t(row.notes)}</p>:null}
      <p className="muted">Sign only if this record accurately describes training or a check you are entitled to attest. FlyTally binds your account identity and current credential snapshot to this exact record; it does not decide whether your privileges are legally sufficient for the attestation.</p>
    </section>
    {pending?<section className="panel"><div className="section-heading"><div><p className="eyebrow">DECISION</p><h2>Sign or decline</h2></div></div><form action={signAircraftQualification.bind(null,recordId)} className="stack-form"><label>Optional signing note<textarea name="note" rows={2} maxLength={500}/></label><button className="primary-button">Sign this aircraft training record</button></form><form action={declineAircraftQualification.bind(null,recordId)} className="stack-form"><label>Reason if declining<textarea name="note" rows={2} maxLength={500}/></label><button className="secondary-button">Decline signature request</button></form></section>:verifiedByMe?<section className="panel"><div className="section-heading"><div><p className="eyebrow">SIGNED EVIDENCE</p><h2>Your signature is attached</h2><p className="muted">The stored server signature currently verifies against this exact training record and your credential snapshot at signing time.</p></div><span className="status-on">VERIFIED</span></div><details className="confirm-action"><summary>Revoke signature…</summary><form action={revokeAircraftQualificationSignature.bind(null,recordId)} className="stack-form"><label>Revocation reason<textarea name="reason" rows={2} minLength={5} maxLength={500} required/></label><button className="danger-button">Revoke signature</button></form></details></section>:<section className="panel"><p>{status==="verified"?"This exact training record has already been signed and its stored signature verifies correctly.":status==="declined"?"This signature request has been declined.":status==="revoked"?`This signature has been revoked.${t(row.verification_note)?` ${t(row.verification_note)}`:""}`:status==="invalid"?"Stored signature evidence does not verify against the current record.":"This request is no longer pending."}</p></section>}
  </>;
}
