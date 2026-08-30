import "server-only";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";

export async function upsertInstructorRequest(studentUserId:number,flightId:number,instructorUserId:number){
  await ensureRuntimeSchema();
  if(!studentUserId||!flightId||!instructorUserId||studentUserId===instructorUserId)return null;
  const old=await sql`SELECT p.id,p.participant_user_id,p.approval_id FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id
    WHERE p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_revision=COALESCE(f.record_revision,1)
      AND p.participant_role='INSTRUCTOR' AND p.participant_user_id<>${instructorUserId} AND p.status='pending'` as Array<{id:number|string;participant_user_id:number|string;approval_id:number|string|null}>;
  if(old.length){
    await sql`UPDATE flight_participations p SET status='cancelled',cancelled_at=NOW(),responded_at=NOW(),decision_note='Replaced by another instructor request.'
      FROM flights f WHERE p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_flight_id=f.id AND p.source_revision=COALESCE(f.record_revision,1)
        AND p.participant_role='INSTRUCTOR' AND p.participant_user_id<>${instructorUserId} AND p.status='pending'`;
    await Promise.all(old.map(async row=>{
      await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${Number(row.participant_user_id)} AND href=${`/connections/shared/${row.id}`}`;
      if(row.approval_id)await sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Replaced by another instructor request.'
        WHERE id=${Number(row.approval_id)} AND flight_id=${flightId} AND student_user_id=${studentUserId} AND instructor_user_id=${Number(row.participant_user_id)} AND status='pending'`;
    }));
  }
  const participations=await sql`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,created_at,responded_at,cancelled_at,superseded_at,decision_note)
    SELECT f.id,f.user_id,${instructorUserId},'INSTRUCTOR',COALESCE(f.record_revision,1),f.certification_hash,'pending',NOW(),NULL,NULL,NULL,''
    FROM flights f WHERE f.id=${flightId} AND f.user_id=${studentUserId} AND f.certified_at IS NOT NULL AND COALESCE(f.certification_hash,'')<>'' AND UPPER(COALESCE(f.role,'')) IN ('DUAL','SPIC','PICUS')
      AND NOT EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.status='signed' AND v.verification_role=CASE WHEN UPPER(COALESCE(f.role,''))='DUAL' THEN 'INSTRUCTOR' ELSE 'SUPERVISING PIC' END)
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND
        ((c.requester_user_id=${studentUserId} AND c.recipient_user_id=${instructorUserId} AND (c.requester_label='instructor' OR c.relationship='recipient_instructor')) OR
         (c.recipient_user_id=${studentUserId} AND c.requester_user_id=${instructorUserId} AND (c.recipient_label='instructor' OR c.relationship='requester_instructor'))))
    ON CONFLICT(source_flight_id,source_revision,participant_user_id) DO UPDATE SET participant_role='INSTRUCTOR',source_hash=EXCLUDED.source_hash,status='pending',created_at=NOW(),responded_at=NULL,cancelled_at=NULL,superseded_at=NULL,decision_note='',approval_id=NULL
      WHERE flight_participations.status IN ('pending','accepted','declined','cancelled','superseded')
    RETURNING id` as Array<{id:number|string}>;
  const participation=participations[0];if(!participation)return null;
  const participationId=Number(participation.id);
  await notifyUser(instructorUserId,{kind:"signature_request",title:"Instructor verification requested",body:"Review and sign the exact certified revision. Adding an FI entry is optional.",href:`/connections/shared/${participationId}`,dedupeKey:`flight-request:${participationId}`});
  // Modern requests are participation-only. approvalId is retained in the
  // return shape solely for callers compiled against the legacy API.
  return{participationId,approvalId:0};
}

export async function cancelInstructorRequest(studentUserId:number,flightId:number,participationId:number){
  await ensureRuntimeSchema();
  const rows=await sql`UPDATE flight_participations p SET status='cancelled',cancelled_at=NOW(),responded_at=NOW(),decision_note='Cancelled by pilot.'
    FROM flights f WHERE p.id=${participationId} AND p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_flight_id=f.id
      AND p.source_revision=COALESCE(f.record_revision,1) AND p.participant_role='INSTRUCTOR' AND p.status='pending'
    RETURNING p.participant_user_id,p.approval_id` as Array<{participant_user_id:number|string;approval_id:number|string|null}>;
  const row=rows[0];if(!row)return false;
  if(row.approval_id)await sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Cancelled by pilot.' WHERE id=${Number(row.approval_id)} AND flight_id=${flightId} AND student_user_id=${studentUserId} AND instructor_user_id=${Number(row.participant_user_id)} AND status='pending'`;
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${Number(row.participant_user_id)} AND href=${`/connections/shared/${participationId}`}`;
  return true;
}
