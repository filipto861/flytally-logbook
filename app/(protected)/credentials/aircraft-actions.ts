"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { signVerificationPayload } from "@/lib/verification-signature";
import { aircraftTrainingVerificationPayload } from "@/lib/aircraft-training-verification";
import { parseStoredSignature } from "@/components/signature-preview";

const s=(f:FormData,key:string)=>String(f.get(key)??"").trim();
const TRAINING_KINDS=new Set(["differences","familiarisation","class_type","national","other"]);
const SIGNER_ROLES=new Set(["INSTRUCTOR","EXAMINER"]);
const isoDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return"";const date=new Date(`${value}T00:00:00Z`);return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?value:""};
const numericId=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const refresh=(id?:number)=>{revalidatePath("/credentials");revalidatePath("/profile");revalidatePath("/data");revalidatePath("/notifications");revalidatePath("/connections");if(id){revalidatePath(`/connections/aircraft-training/${id}`);revalidatePath(`/credentials/aircraft-training/${id}/in-person-signature`)}};
const aircraftName=(row:Record<string,unknown>)=>[String(row.aircraft_make??"").trim(),String(row.aircraft_model??"").trim(),String(row.aircraft_variant??"").trim()].filter(Boolean).join(" ")||String(row.qualification_type??"Aircraft training");

async function ownedLinkedLicence(userId:number,raw:string){
  const requested=Number(raw||0);if(!requested)return{requested:false,id:null as number|null};
  if(!Number.isSafeInteger(requested)||requested<=0)return{requested:true,id:null as number|null};
  const rows=await sql`SELECT id FROM pilot_licences WHERE id=${requested} AND user_id=${userId} AND active=TRUE LIMIT 1` as Array<{id:number|string}>;
  return{requested:true,id:rows[0]?Number(rows[0].id):null};
}

function payload(f:FormData){
  const completedOn=isoDate(s(f,"completed_on")),rawKind=s(f,"training_kind"),kind=TRAINING_KINDS.has(rawKind)?rawKind:"other";
  return{
    kind,
    classOrType:s(f,"class_or_type").slice(0,80),
    reference:s(f,"certificate_reference").slice(0,100),
    make:s(f,"aircraft_make").slice(0,100),
    model:s(f,"aircraft_model").slice(0,100),
    variant:s(f,"aircraft_variant").slice(0,100),
    differences:s(f,"differences").slice(0,500),
    completedOn,
    instructor:s(f,"instructor_name").slice(0,120),
    organisation:s(f,"training_organisation").slice(0,120),
    notes:s(f,"notes").slice(0,1000),
  };
}

export async function addAircraftQualification(f:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();const input=payload(f),linked=await ownedLinkedLicence(userId,s(f,"linked_licence_id"));
  if(linked.requested&&!linked.id)return;
  if(!input.completedOn||input.completedOn>new Date().toISOString().slice(0,10))return;
  if(!input.classOrType&&!input.model)return;
  await sql`INSERT INTO pilot_qualifications(
    licence_id,user_id,qualification_type,certificate_reference,validity_mode,valid_until,recency_until,active,
    record_kind,record_active,linked_licence_id,training_kind,aircraft_make,aircraft_model,aircraft_variant,differences,completed_on,instructor_name,training_organisation,notes,signature_status,verification_version
  ) VALUES(
    NULL,${userId},${input.classOrType||input.model},${input.reference},'unlimited',NULL,NULL,FALSE,
    'aircraft_training',TRUE,${linked.id},${input.kind},${input.make},${input.model},${input.variant},${input.differences},${input.completedOn},${input.instructor},${input.organisation},${input.notes},'unsigned',1
  )`;
  refresh();
}

export async function saveAircraftQualification(f:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();const id=numericId(s(f,"id")),input=payload(f),linked=await ownedLinkedLicence(userId,s(f,"linked_licence_id"));
  if(!id||linked.requested&&!linked.id)return;
  if(!input.completedOn||input.completedOn>new Date().toISOString().slice(0,10))return;
  if(!input.classOrType&&!input.model)return;
  await sql`UPDATE pilot_qualifications SET
    qualification_type=${input.classOrType||input.model},certificate_reference=${input.reference},linked_licence_id=${linked.id},training_kind=${input.kind},
    aircraft_make=${input.make},aircraft_model=${input.model},aircraft_variant=${input.variant},differences=${input.differences},completed_on=${input.completedOn},
    instructor_name=${input.instructor},training_organisation=${input.organisation},notes=${input.notes},requested_signer_user_id=NULL,signature_status='unsigned',verification_role=NULL,
    verification_snapshot=NULL,verification_signature=NULL,verification_note='',verification_version=1,updated_at=NOW()
    WHERE id=${id} AND user_id=${userId} AND record_kind='aircraft_training' AND record_active IS TRUE AND verified_at IS NULL AND COALESCE(signature_status,'unsigned')<>'pending'`;
  refresh(id);
}

export async function archiveAircraftQualification(f:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();const id=numericId(s(f,"id"));if(!id)return;
  const rows=await sql`WITH target AS(
      SELECT id,requested_signer_user_id FROM pilot_qualifications WHERE id=${id} AND user_id=${userId} AND record_kind='aircraft_training' AND record_active IS TRUE FOR UPDATE
    ),archived AS(
      UPDATE pilot_qualifications q SET record_active=FALSE,updated_at=NOW() FROM target WHERE q.id=target.id RETURNING target.requested_signer_user_id
    ) SELECT requested_signer_user_id FROM archived` as Array<{requested_signer_user_id:number|string|null}>;
  const signer=numericId(rows[0]?.requested_signer_user_id);if(signer)await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${signer} AND href=${`/connections/aircraft-training/${id}`}`;
  refresh(id);
}

export async function requestAircraftQualificationSignature(f:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();const recordId=numericId(s(f,"id")),signerId=numericId(s(f,"signer_user_id")),requestedRole=s(f,"verification_role").toUpperCase(),role=SIGNER_ROLES.has(requestedRole)?requestedRole:"INSTRUCTOR";
  if(!recordId||!signerId||signerId===userId)return;
  const rows=await sql`UPDATE pilot_qualifications q SET requested_signer_user_id=${signerId},signature_status='pending',verification_role=${role},verification_note='',updated_at=NOW()
    WHERE q.id=${recordId} AND q.user_id=${userId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE AND q.verified_at IS NULL AND COALESCE(q.signature_status,'unsigned') IN ('unsigned','declined')
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=${userId} AND c.recipient_user_id=${signerId}) OR (c.requester_user_id=${signerId} AND c.recipient_user_id=${userId})))
    RETURNING q.id,q.qualification_type,q.aircraft_make,q.aircraft_model,q.aircraft_variant,q.completed_on::text completed_on` as Array<Record<string,unknown>>;
  if(!rows[0])return;
  await notifyUser(signerId,{kind:"aircraft_training_signature",title:`${role==="EXAMINER"?"Examiner":"Instructor"} signature requested`,body:`Review ${aircraftName(rows[0])} training dated ${String(rows[0].completed_on??"").slice(0,10)}.`,href:`/connections/aircraft-training/${recordId}`,dedupeKey:`aircraft-training-signature:${recordId}`});
  refresh(recordId);
}

export async function cancelAircraftQualificationSignature(f:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();const recordId=numericId(s(f,"id"));if(!recordId)return;
  const rows=await sql`WITH target AS(
      SELECT id,requested_signer_user_id FROM pilot_qualifications WHERE id=${recordId} AND user_id=${userId} AND record_kind='aircraft_training' AND record_active IS TRUE AND verified_at IS NULL AND signature_status='pending' FOR UPDATE
    ),cancelled AS(
      UPDATE pilot_qualifications q SET requested_signer_user_id=NULL,signature_status='unsigned',verification_role=NULL,verification_note='',updated_at=NOW() FROM target WHERE q.id=target.id RETURNING target.requested_signer_user_id
    ) SELECT requested_signer_user_id FROM cancelled` as Array<{requested_signer_user_id:number|string|null}>;
  const signer=numericId(rows[0]?.requested_signer_user_id);if(signer)await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${signer} AND href=${`/connections/aircraft-training/${recordId}`}`;
  refresh(recordId);
}

export async function signAircraftQualification(recordId:number,form:FormData){
  const session=await requireUser();await ensureRuntimeSchema();if(!Number.isSafeInteger(recordId)||recordId<=0)return;
  const note=s(form,"note").slice(0,500);
  const rows=await sql`SELECT q.id,q.user_id,q.qualification_type,q.certificate_reference,q.linked_licence_id,q.training_kind,q.aircraft_make,q.aircraft_model,q.aircraft_variant,q.differences,q.completed_on::text completed_on,q.instructor_name,q.training_organisation,q.notes,q.signature_status,q.verification_role,q.verification_version,q.updated_at::text updated_at,owner.display_name owner_name,signer.display_name signer_name
    FROM pilot_qualifications q JOIN users owner ON owner.id=q.user_id JOIN users signer ON signer.id=${session.userId}
    WHERE q.id=${recordId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE AND q.requested_signer_user_id=${session.userId} AND q.signature_status='pending' AND q.verified_at IS NULL
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=q.user_id AND c.recipient_user_id=${session.userId}) OR (c.requester_user_id=${session.userId} AND c.recipient_user_id=q.user_id))) LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)return;
  const[licences,qualifications]=await Promise.all([
    sql`SELECT licence_type,licence_number,authority,country,validity_mode,valid_until::text,recency_until::text FROM pilot_licences WHERE user_id=${session.userId} AND active=TRUE ORDER BY id`,
    sql`SELECT qualification_type,certificate_reference,validity_mode,valid_until::text,recency_until::text FROM pilot_qualifications WHERE user_id=${session.userId} AND active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training' ORDER BY id`,
  ]);
  const signerName=String(row.signer_name??"").trim(),storedRole=String(row.verification_role??"").toUpperCase(),verificationRole=SIGNER_ROLES.has(storedRole)?storedRole:"INSTRUCTOR";
  const credentialSnapshot={identity:signerName,source:"FlyTally account",licences,qualifications};
  const signedRow={...row,instructor_name:signerName,verification_role:verificationRole,verification_version:1};
  const signature=signVerificationPayload(aircraftTrainingVerificationPayload(signedRow,credentialSnapshot,session.userId));
  const updated=await sql`UPDATE pilot_qualifications SET instructor_name=${signerName},signature_status='signed',verification_role=${verificationRole},verified_at=NOW(),verified_by_user_id=${session.userId},verification_snapshot=${JSON.stringify(credentialSnapshot)}::jsonb,verification_signature=${signature},verification_note=${note},verification_version=1,updated_at=NOW()
    WHERE id=${recordId} AND user_id=${Number(row.user_id)} AND requested_signer_user_id=${session.userId} AND signature_status='pending' AND verified_at IS NULL AND updated_at::text=${String(row.updated_at)} RETURNING user_id` as Array<{user_id:number|string}>;
  if(!updated[0])return;
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${session.userId} AND href=${`/connections/aircraft-training/${recordId}`}`;
  await notifyUser(Number(row.user_id),{kind:"aircraft_training_signed",title:"Aircraft training signed",body:`${signerName} signed ${aircraftName(signedRow)} training evidence.`,href:"/credentials",dedupeKey:`aircraft-training-signed:${recordId}`});
  refresh(recordId);
}

export async function declineAircraftQualification(recordId:number,form:FormData){
  const session=await requireUser();await ensureRuntimeSchema();if(!Number.isSafeInteger(recordId)||recordId<=0)return;const note=s(form,"note").slice(0,500);
  const rows=await sql`UPDATE pilot_qualifications q SET signature_status='declined',verification_note=${note},updated_at=NOW()
    WHERE q.id=${recordId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE AND q.requested_signer_user_id=${session.userId} AND q.signature_status='pending' AND q.verified_at IS NULL
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=q.user_id AND c.recipient_user_id=${session.userId}) OR (c.requester_user_id=${session.userId} AND c.recipient_user_id=q.user_id)))
    RETURNING q.user_id,q.qualification_type,q.aircraft_make,q.aircraft_model,q.aircraft_variant` as Array<Record<string,unknown>>;
  if(rows[0]){
    await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${session.userId} AND href=${`/connections/aircraft-training/${recordId}`}`;
    await notifyUser(Number(rows[0].user_id),{kind:"aircraft_training_declined",title:"Aircraft training signature declined",body:note||`${aircraftName(rows[0])} was not signed.`,href:"/credentials",dedupeKey:`aircraft-training-declined:${recordId}`});refresh(recordId);
  }
}

export async function revokeAircraftQualificationSignature(recordId:number,form:FormData){
  const session=await requireUser();await ensureRuntimeSchema();if(!Number.isSafeInteger(recordId)||recordId<=0)return;const reason=s(form,"reason").slice(0,500);if(reason.length<5)return;
  const rows=await sql`UPDATE pilot_qualifications SET signature_status='revoked',verification_note=${reason},updated_at=NOW()
    WHERE id=${recordId} AND record_kind='aircraft_training' AND record_active IS TRUE AND verified_by_user_id=${session.userId} AND verified_at IS NOT NULL AND signature_status='signed' RETURNING user_id,qualification_type,aircraft_make,aircraft_model,aircraft_variant` as Array<Record<string,unknown>>;
  if(rows[0]){await notifyUser(Number(rows[0].user_id),{kind:"aircraft_training_revoked",title:"Aircraft training signature revoked",body:reason,href:"/credentials",dedupeKey:`aircraft-training-revoked:${recordId}`});refresh(recordId)}
}

export async function signAircraftQualificationInPerson(recordId:number,form:FormData){
  const{userId}=await requireUser();await ensureRuntimeSchema();if(!Number.isSafeInteger(recordId)||recordId<=0)return;
  const instructorName=s(form,"instructor_name").slice(0,120),licenceNumber=s(form,"licence_number").slice(0,80),qualification=s(form,"qualification").slice(0,80),qualificationReference=s(form,"qualification_reference").slice(0,80),requestedRole=s(form,"verification_role").toUpperCase(),role=SIGNER_ROLES.has(requestedRole)?requestedRole:"INSTRUCTOR",rawSignature=s(form,"signature_json");
  if(s(form,"confirm_in_person")!=="yes"||!instructorName||!licenceNumber||!qualification||!rawSignature||rawSignature.length>80000)return;
  let stored:unknown;try{stored=JSON.parse(rawSignature)}catch{return}const signatureDrawing=parseStoredSignature(stored);if(!signatureDrawing)return;
  const points=signatureDrawing.strokes.reduce((sum,stroke)=>sum+stroke.length,0);if(points<4||points>8000)return;
  const rows=await sql`SELECT id,user_id,qualification_type,certificate_reference,linked_licence_id,training_kind,aircraft_make,aircraft_model,aircraft_variant,differences,completed_on::text completed_on,instructor_name,training_organisation,notes,requested_signer_user_id,verification_version,updated_at::text updated_at FROM pilot_qualifications
    WHERE id=${recordId} AND user_id=${userId} AND record_kind='aircraft_training' AND record_active IS TRUE AND verified_at IS NULL LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)return;
  const credentialSnapshot={identity:instructorName,source:"In-person handwritten signature",licenceNumber,qualification,qualificationReference,captureMethod:"same-device",signature:signatureDrawing};
  const signedRow={...row,instructor_name:instructorName,verification_role:role,verification_version:1};
  const serverSignature=signVerificationPayload(aircraftTrainingVerificationPayload(signedRow,credentialSnapshot,null));
  const updated=await sql`UPDATE pilot_qualifications SET instructor_name=${instructorName},requested_signer_user_id=NULL,signature_status='signed',verification_role=${role},verified_at=NOW(),verified_by_user_id=NULL,verification_snapshot=${JSON.stringify(credentialSnapshot)}::jsonb,verification_signature=${serverSignature},verification_note='',verification_version=1,updated_at=NOW()
    WHERE id=${recordId} AND user_id=${userId} AND record_kind='aircraft_training' AND record_active IS TRUE AND verified_at IS NULL AND updated_at::text=${String(row.updated_at)} RETURNING id` as Array<{id:number|string}>;
  if(!updated[0])return;
  const requested=numericId(row.requested_signer_user_id);if(requested)await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${requested} AND href=${`/connections/aircraft-training/${recordId}`}`;
  refresh(recordId);
}
