"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

const id=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const text=(value:unknown)=>String(value??"").trim();
const refresh=(flightId:number,approvalId?:number)=>{
  revalidatePath(`/flights/${flightId}`);revalidatePath(`/flights/${flightId}/audit`);revalidatePath("/connections");revalidatePath("/print");
  if(approvalId)revalidatePath(`/connections/flight/${approvalId}`);
};

export async function requestInstructorApproval(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  const instructorId=id(form.get("instructor_id"));
  if(!Number.isSafeInteger(flightId)||flightId<=0||!instructorId||instructorId===userId)return;
  await sql`INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,record_revision,flight_hash,status)
    SELECT f.id,f.user_id,${instructorId},COALESCE(f.record_revision,1),f.certification_hash,'pending'
    FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL
      AND COALESCE(f.certification_hash,'')<>'' AND UPPER(COALESCE(f.role,'')) IN ('DUAL','SPIC','PICUS')
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND
        ((c.relationship='requester_instructor' AND c.requester_user_id=${instructorId} AND c.recipient_user_id=${userId}) OR
         (c.relationship='recipient_instructor' AND c.recipient_user_id=${instructorId} AND c.requester_user_id=${userId})))
    ON CONFLICT(flight_id,record_revision) DO UPDATE SET instructor_user_id=EXCLUDED.instructor_user_id,status='pending',requested_at=NOW(),decided_at=NULL,decision_note='',flight_hash=EXCLUDED.flight_hash
      WHERE instructor_flight_approvals.status='declined'`;
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
        ((c.relationship='requester_instructor' AND c.requester_user_id=${userId} AND c.recipient_user_id=a.student_user_id) OR
         (c.relationship='recipient_instructor' AND c.recipient_user_id=${userId} AND c.requester_user_id=a.student_user_id)))
    RETURNING a.flight_id` as Array<{flight_id:number|string}>;
  if(rows[0])refresh(Number(rows[0].flight_id),approvalId);
}

export async function approveInstructorFlight(approvalId:number,form:FormData){
  if(text(form.get("confirm"))!=="approve")return;
  await decide(approvalId,"approved",form);
}

export async function declineInstructorFlight(approvalId:number,form:FormData){
  await decide(approvalId,"declined",form);
}
