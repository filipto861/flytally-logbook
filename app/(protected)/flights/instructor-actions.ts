"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { signVerificationPayload } from "@/lib/verification-signature";
import { notifyUser } from "@/lib/notifications";
import { addApprovedFlightToLogbook } from "./shared-actions";

const id=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const text=(value:unknown)=>String(value??"").trim();
const refresh=(flightId:number,approvalId?:number)=>{
  revalidatePath(`/flights/${flightId}`);revalidatePath(`/flights/${flightId}/audit`);revalidatePath("/connections");revalidatePath("/print");revalidatePath("/notifications");
  if(approvalId)revalidatePath(`/connections/flight/${approvalId}`);
};

export async function requestInstructorApproval(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  const enabled=await sql`SELECT enabled FROM feature_switches WHERE key='verified_approvals' LIMIT 1` as Array<{enabled:boolean}>;if(enabled[0]&&!enabled[0].enabled)return;
  const instructorId=id(form.get("instructor_id"));
  if(!Number.isSafeInteger(flightId)||flightId<=0||!instructorId||instructorId===userId)return;
  const rows=await sql`INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,record_revision,flight_hash,status)
    SELECT f.id,f.user_id,${instructorId},COALESCE(f.record_revision,1),f.certification_hash,'pending'
    FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL
      AND COALESCE(f.certification_hash,'')<>'' AND UPPER(COALESCE(f.role,'')) IN ('DUAL','SPIC','PICUS')
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND
        ((c.requester_user_id=${userId} AND c.recipient_user_id=${instructorId} AND (c.requester_label='instructor' OR c.relationship='recipient_instructor')) OR
         (c.recipient_user_id=${userId} AND c.requester_user_id=${instructorId} AND (c.recipient_label='instructor' OR c.relationship='requester_instructor'))))
    ON CONFLICT(flight_id,record_revision) DO UPDATE SET instructor_user_id=EXCLUDED.instructor_user_id,status='pending',requested_at=NOW(),decided_at=NULL,decision_note='',flight_hash=EXCLUDED.flight_hash
      WHERE instructor_flight_approvals.status IN ('declined','cancelled','superseded') RETURNING id` as Array<{id:number|string}>;
  if(rows[0])await notifyUser(instructorId,{kind:"signature_request",title:"Flight approval requested",body:"Review and sign the exact certified revision, then add your own entry if required.",href:`/connections/flight/${rows[0].id}`,dedupeKey:`approval:${rows[0].id}`});
  refresh(flightId);
}

async function decide(approvalId:number,status:"approved"|"declined",form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  if(!approvalId)return;
  const note=text(form.get("note")).slice(0,500);
  const rows=await sql`UPDATE instructor_flight_approvals a SET status=${status},decided_at=NOW(),decision_note=${note}
    FROM flights f WHERE a.id=${approvalId} AND a.flight_id=f.id AND a.instructor_user_id=${userId} AND a.status='pending'
      AND f.user_id=a.student_user_id AND f.certified_at IS NOT NULL AND COALESCE(f.record_revision,1)=a.record_revision
      AND f.certification_hash=a.flight_hash
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND
        ((c.requester_user_id=${userId} AND c.recipient_user_id=a.student_user_id AND (c.requester_label='student' OR c.relationship='requester_instructor')) OR
         (c.recipient_user_id=${userId} AND c.requester_user_id=a.student_user_id AND (c.recipient_label='student' OR c.relationship='recipient_instructor'))))
    RETURNING a.flight_id,a.student_user_id` as Array<{flight_id:number|string;student_user_id:number|string}>;
  if(rows[0]){await notifyUser(Number(rows[0].student_user_id),{kind:`approval_${status}`,title:status==="approved"?"Flight approved":"Flight approval declined",body:note,href:`/flights/${rows[0].flight_id}`,dedupeKey:`approval-decision:${approvalId}:${status}`});refresh(Number(rows[0].flight_id),approvalId)}
}

export async function approveInstructorFlight(approvalId:number,form:FormData){
  if(text(form.get("confirm"))!=="approve")return;
  const enabled=await sql`SELECT enabled FROM feature_switches WHERE key='verified_approvals' LIMIT 1` as Array<{enabled:boolean}>;if(enabled[0]&&!enabled[0].enabled)return;
  await decide(approvalId,"approved",form);
  const session=await requireUser();
  const rows=await sql`SELECT a.flight_id,a.student_user_id,a.record_revision,a.flight_hash,f.role,u.display_name FROM instructor_flight_approvals a JOIN flights f ON f.id=a.flight_id JOIN users u ON u.id=a.instructor_user_id WHERE a.id=${approvalId} AND a.instructor_user_id=${session.userId} AND a.status='approved' LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row)return;
  const [licences,qualifications]=await Promise.all([
    sql`SELECT licence_type,licence_number,authority,country,validity_mode,valid_until::text,recency_until::text FROM pilot_licences WHERE user_id=${session.userId} AND active=TRUE ORDER BY id`,
    sql`SELECT qualification_type,certificate_reference,validity_mode,valid_until::text,recency_until::text FROM pilot_qualifications WHERE user_id=${session.userId} AND active=TRUE ORDER BY id`,
  ]);
  const credentialSnapshot={identity:String(row.display_name),source:"Provided by pilot",licences,qualifications},verificationRole=String(row.role).toUpperCase()==="DUAL"?"INSTRUCTOR":"SUPERVISING PIC";
  const payload={flightId:Number(row.flight_id),flightUserId:Number(row.student_user_id),signerUserId:session.userId,recordRevision:Number(row.record_revision),flightHash:String(row.flight_hash),verificationRole,credentialSnapshot};
  const signature=signVerificationPayload(payload);
  await sql`INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash,credential_snapshot,payload_hash,server_signature,status,signed_at) VALUES(${payload.flightId},${payload.flightUserId},${session.userId},${verificationRole},${payload.recordRevision},${payload.flightHash},${JSON.stringify(credentialSnapshot)}::jsonb,${payload.flightHash},${signature},'signed',NOW()) ON CONFLICT(flight_id,record_revision,signer_user_id,verification_role) DO UPDATE SET credential_snapshot=EXCLUDED.credential_snapshot,payload_hash=EXCLUDED.payload_hash,server_signature=EXCLUDED.server_signature,status='signed',signed_at=NOW(),revoked_at=NULL,revocation_reason=''`;
  await notifyUser(payload.flightUserId,{kind:"signature_completed",title:"Flight approved and signed",body:`${String(row.display_name)} signed revision ${payload.recordRevision}.`,href:`/flights/${payload.flightId}`,dedupeKey:`approval-signed:${approvalId}`});
}

export async function approveAndAddInstructorFlight(approvalId:number,form:FormData){
  form.set("confirm","approve");
  await approveInstructorFlight(approvalId,form);
  return addApprovedFlightToLogbook(approvalId);
}

export async function revokeFlightVerification(form:FormData){const session=await requireUser(),verificationId=id(form.get("verification_id")),reason=text(form.get("reason")).slice(0,500);if(!verificationId||reason.length<5)return;const rows=await sql`UPDATE flight_verifications SET status='revoked',revoked_at=NOW(),revocation_reason=${reason} WHERE id=${verificationId} AND signer_user_id=${session.userId} AND status='signed' RETURNING flight_id,flight_user_id` as Array<{flight_id:number|string;flight_user_id:number|string}>;if(rows[0]){await notifyUser(Number(rows[0].flight_user_id),{kind:"signature_revoked",title:"Flight approval revoked",body:reason,href:`/flights/${rows[0].flight_id}/audit`,dedupeKey:`verification-revoked:${verificationId}`});refresh(Number(rows[0].flight_id))}}
export async function declineInstructorFlight(approvalId:number,form:FormData){await decide(approvalId,"declined",form);}
export async function cancelInstructorApproval(flightId:number,form:FormData){const{userId}=await requireUser(),approvalId=id(form.get("approval_id"));if(!approvalId)return;await sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Cancelled by pilot.' WHERE id=${approvalId} AND flight_id=${flightId} AND student_user_id=${userId} AND status='pending'`;refresh(flightId,approvalId)}
