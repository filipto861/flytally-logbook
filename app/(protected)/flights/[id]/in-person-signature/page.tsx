import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { signVerificationPayload } from "@/lib/verification-signature";
import { ReadonlyLogbookEntry } from "@/components/readonly-logbook-entry";
import { InPersonSignaturePad } from "@/components/in-person-signature-pad";
import { parseStoredSignature,SignaturePreview } from "@/components/signature-preview";

const text=(value:unknown)=>String(value??"").trim();
const snapshot=(value:unknown)=>{if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{} }catch{return{}}};
const dateTime=(value:unknown)=>{const date=new Date(String(value??""));return Number.isNaN(date.getTime())?text(value):new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(date)+" UTC"};

async function signInPersonInstructorFlight(flightId:number,form:FormData){
  "use server";
  const {userId}=await requireUser();await ensureDatabaseOptimizations();await ensureV132Schema();
  const instructorName=text(form.get("instructor_name")).slice(0,120),licenceNumber=text(form.get("licence_number")).slice(0,80),qualification=text(form.get("qualification")).slice(0,80),qualificationReference=text(form.get("qualification_reference")).slice(0,80),rawSignature=text(form.get("signature_json"));
  if(text(form.get("confirm_in_person"))!=="yes"||!instructorName||!licenceNumber||!qualification||!rawSignature||rawSignature.length>80000)return;
  let stored:unknown;try{stored=JSON.parse(rawSignature)}catch{return}const signatureDrawing=parseStoredSignature(stored);if(!signatureDrawing)return;
  const points=signatureDrawing.strokes.reduce((sum,stroke)=>sum+stroke.length,0);if(points<4||points>8000)return;
  const rows=await sql`SELECT id,user_id,role,record_revision,certification_hash,certified_at FROM flights WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NOT NULL AND COALESCE(certification_hash,'')<>'' AND UPPER(COALESCE(role,'')) IN ('DUAL','SPIC','PICUS') LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)return;
  const verificationRole=text(row.role).toUpperCase()==="DUAL"?"INSTRUCTOR":"SUPERVISING PIC",recordRevision=Math.max(1,Number(row.record_revision)||1),flightHash=text(row.certification_hash);
  const existing=await sql`SELECT id FROM flight_verifications WHERE flight_id=${flightId} AND flight_user_id=${userId} AND record_revision=${recordRevision} AND verification_role=${verificationRole} AND status='signed' LIMIT 1` as Array<{id:number|string}>;if(existing[0])redirect(`/flights/${flightId}/in-person-signature`);
  const credentialSnapshot={identity:instructorName,source:"In-person handwritten signature",licenceNumber,qualification,qualificationReference,captureMethod:"same-device",signature:signatureDrawing};
  const payload={flightId,flightUserId:userId,signerUserId:null,recordRevision,flightHash,verificationRole,credentialSnapshot},serverSignature=signVerificationPayload(payload);
  await sql.transaction([
    sql`UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()) WHERE n.user_id IN (SELECT participant_user_id FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${recordRevision} AND participant_role='INSTRUCTOR' AND status='pending') AND n.href IN (SELECT '/connections/shared/'||p.id::text FROM flight_participations p WHERE p.source_flight_id=${flightId} AND p.source_user_id=${userId} AND p.source_revision=${recordRevision} AND p.participant_role='INSTRUCTOR' AND p.status='pending')`,
    sql`UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()) WHERE n.href IN(SELECT '/connections/flight/'||a.id::text FROM instructor_flight_approvals a WHERE a.flight_id=${flightId} AND a.student_user_id=${userId} AND a.record_revision=${recordRevision} AND a.status='pending')`,
    sql`UPDATE flight_participations SET status='cancelled',cancelled_at=NOW(),responded_at=NOW(),decision_note='Completed with an in-person signature on the pilot device.' WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${recordRevision} AND participant_role='INSTRUCTOR' AND status='pending'`,
    sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Completed with an in-person signature on the pilot device.' WHERE flight_id=${flightId} AND student_user_id=${userId} AND record_revision=${recordRevision} AND status='pending'`,
    sql`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,payload_hash,server_signature,status,signed_at) VALUES(${flightId},${userId},NULL,${verificationRole},${recordRevision},${flightHash},${JSON.stringify(credentialSnapshot)}::jsonb,${flightHash},${serverSignature},'signed',NOW())`,
  ]);
  revalidatePath(`/flights/${flightId}`);revalidatePath(`/flights/${flightId}/audit`);revalidatePath(`/flights/${flightId}/in-person-signature`);revalidatePath("/credentials");revalidatePath("/connections");revalidatePath("/notifications");revalidatePath("/print");redirect(`/flights/${flightId}/in-person-signature`);
}

export default async function InPersonInstructorSignaturePage({params}:{params:Promise<{id:string}>}){
  const {userId}=await requireUser(),flightId=Number((await params).id);if(!Number.isSafeInteger(flightId)||flightId<=0)notFound();await ensureDatabaseOptimizations();await ensureV132Schema();
  const rows=await sql`SELECT f.*,u.display_name pilot_name,CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL AND UPPER(COALESCE(f.role,'')) IN ('DUAL','SPIC','PICUS') LIMIT 1` as Array<Record<string,unknown>>;const row=rows[0];if(!row)notFound();
  const verificationRole=text(row.role).toUpperCase()==="DUAL"?"INSTRUCTOR":"SUPERVISING PIC",revision=Math.max(1,Number(row.record_revision)||1);
  const verifications=await sql`SELECT v.*,u.display_name signer_name FROM flight_verifications v LEFT JOIN users u ON u.id=v.signer_user_id WHERE v.flight_id=${flightId} AND v.flight_user_id=${userId} AND v.record_revision=${revision} AND v.verification_role=${verificationRole} AND v.status='signed' ORDER BY v.id DESC LIMIT 1` as Array<Record<string,unknown>>,verification=verifications[0],credentials=snapshot(verification?.credential_snapshot),manual=text(credentials.source)==="In-person handwritten signature";
  return <>
    <header className="page-header"><div><p className="eyebrow">IN-PERSON INSTRUCTOR SIGNATURE</p><h1>{text(row.registration)} · {text(row.date)}</h1><p className="muted">Certified R{revision} · {text(row.departure)} → {text(row.arrival)} · {text(row.role)}</p></div><Link className="secondary-link" href={`/flights/${flightId}?tab=logbook`}>← Flight detail</Link></header>
    <ReadonlyLogbookEntry row={row} pilotName={text(row.pilot_name)} certified easa={text(row.evidence).toUpperCase()==="EASA"} hideInPersonSignatureLink/>
    {verification?<section className="panel instructor-approval-panel approved"><div><p className="eyebrow">SIGNATURE EVIDENCE</p><h2>{manual?"Signed in person":`${text(verification.signer_name)||"Instructor"} signed in FlyTally`}</h2><p className="muted">This evidence is attached to certified revision R{revision} and its stored certification hash.</p></div>{manual?<><div className="credential-list"><div className="credential-card"><div className="credential-editor"><p><strong>{text(credentials.identity)}</strong></p><p className="muted">Licence {text(credentials.licenceNumber)||"—"} · {text(credentials.qualification)||"—"}{text(credentials.qualificationReference)?` · ${text(credentials.qualificationReference)}`:""}</p><SignaturePreview signature={credentials.signature}/><p className="muted">Signed {dateTime(verification.signed_at)} · captured in person on this device. FlyTally binds the evidence to the exact revision; the identity was not independently authenticated by a FlyTally account.</p></div></div></div></>:null}</section>:<section className="panel instructor-approval-panel"><div><p className="eyebrow">INSTRUCTOR WITHOUT FLYTALLY</p><h2>Sign on this device</h2><p className="muted">Use this when the instructor is physically present but does not have a FlyTally account. The flight stays certified; this adds signature evidence to the existing revision.</p></div><InPersonSignaturePad action={signInPersonInstructorFlight.bind(null,flightId)} defaultInstructor={text(row.instructor)}/></section>}
  </>;
}
