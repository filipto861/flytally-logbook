import "server-only";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { ensureV132Schema } from "@/lib/v132-schema";

const text=(value:unknown)=>String(value??"").trim();

export async function upsertInstructorRequest(studentUserId:number,flightId:number,instructorUserId:number){
  await ensureV132Schema();
  if(!studentUserId||!flightId||!instructorUserId||studentUserId===instructorUserId)return null;
  const old=await sql`SELECT p.id,p.participant_user_id FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id
    WHERE p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_revision=COALESCE(f.record_revision,1)
      AND p.participant_role='INSTRUCTOR' AND p.participant_user_id<>${instructorUserId} AND p.status='pending'` as Array<{id:number|string;participant_user_id:number|string}>;
  if(old.length){
    await sql`UPDATE flight_participations p SET status='cancelled',cancelled_at=NOW(),responded_at=NOW(),decision_note='Replaced by another instructor request.'
      FROM flights f WHERE p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_flight_id=f.id AND p.source_revision=COALESCE(f.record_revision,1)
        AND p.participant_role='INSTRUCTOR' AND p.participant_user_id<>${instructorUserId} AND p.status='pending'`;
    await Promise.all(old.map(row=>sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${Number(row.participant_user_id)} AND href=${`/connections/shared/${row.id}`}`));
  }
  const participations=await sql`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status,created_at,responded_at,cancelled_at,superseded_at,decision_note)
    SELECT f.id,f.user_id,${instructorUserId},'INSTRUCTOR',COALESCE(f.record_revision,1),f.certification_hash,'pending',NOW(),NULL,NULL,NULL,''
    FROM flights f WHERE f.id=${flightId} AND f.user_id=${studentUserId} AND f.certified_at IS NOT NULL AND COALESCE(f.certification_hash,'')<>'' AND UPPER(COALESCE(f.role,'')) IN ('DUAL','SPIC','PICUS')
      AND NOT EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.status='signed' AND v.verification_role=CASE WHEN UPPER(COALESCE(f.role,''))='DUAL' THEN 'INSTRUCTOR' ELSE 'SUPERVISING PIC' END)
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND
        ((c.requester_user_id=${studentUserId} AND c.recipient_user_id=${instructorUserId} AND (c.requester_label='instructor' OR c.relationship='recipient_instructor')) OR
         (c.recipient_user_id=${studentUserId} AND c.requester_user_id=${instructorUserId} AND (c.recipient_label='instructor' OR c.relationship='requester_instructor'))))
    ON CONFLICT(source_flight_id,source_revision,participant_user_id) DO UPDATE SET participant_role='INSTRUCTOR',source_hash=EXCLUDED.source_hash,status='pending',created_at=NOW(),responded_at=NULL,cancelled_at=NULL,superseded_at=NULL,decision_note=''
      WHERE flight_participations.status IN ('pending','accepted','declined','cancelled','superseded')
    RETURNING id,source_revision,source_hash` as Array<{id:number|string;source_revision:number|string;source_hash:string}>;
  const participation=participations[0];if(!participation)return null;
  const approvals=await sql`INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id,record_revision,flight_hash,status,requested_at,decided_at,decision_note)
    VALUES(${flightId},${studentUserId},${instructorUserId},${Number(participation.source_revision)},${text(participation.source_hash)},'pending',NOW(),NULL,'')
    ON CONFLICT(flight_id,record_revision) DO UPDATE SET instructor_user_id=EXCLUDED.instructor_user_id,flight_hash=EXCLUDED.flight_hash,status='pending',requested_at=NOW(),decided_at=NULL,decision_note=''
    RETURNING id` as Array<{id:number|string}>;
  const approvalId=Number(approvals[0]?.id)||0,participationId=Number(participation.id);
  if(approvalId)await sql`UPDATE flight_participations SET approval_id=${approvalId} WHERE id=${participationId} AND participant_user_id=${instructorUserId}`;
  await notifyUser(instructorUserId,{kind:"signature_request",title:"Instructor verification requested",body:"Review and sign the exact certified revision. Adding an FI entry is optional.",href:`/connections/shared/${participationId}`,dedupeKey:`flight-request:${participationId}`});
  return{participationId,approvalId};
}

export async function cancelInstructorRequest(studentUserId:number,flightId:number,participationId:number){
  await ensureV132Schema();
  const rows=await sql`UPDATE flight_participations p SET status='cancelled',cancelled_at=NOW(),responded_at=NOW(),decision_note='Cancelled by pilot.'
    FROM flights f WHERE p.id=${participationId} AND p.source_flight_id=${flightId} AND p.source_user_id=${studentUserId} AND p.source_flight_id=f.id
      AND p.source_revision=COALESCE(f.record_revision,1) AND p.participant_role='INSTRUCTOR' AND p.status='pending'
    RETURNING p.participant_user_id,p.approval_id` as Array<{participant_user_id:number|string;approval_id:number|string|null}>;
  const row=rows[0];if(!row)return false;
  if(row.approval_id)await sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Cancelled by pilot.' WHERE id=${Number(row.approval_id)} AND student_user_id=${studentUserId}`;
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${Number(row.participant_user_id)} AND href=${`/connections/shared/${participationId}`}`;
  return true;
}
