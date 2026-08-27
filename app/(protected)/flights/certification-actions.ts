"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { blockingComplianceIssues,fcl050FlightCompliance } from "@/lib/fcl050-compliance";
import { flightCertificationHash } from "@/lib/certification-integrity";
import { upsertInstructorRequest } from "@/lib/training-verification";

const text=(value:unknown)=>String(value??"").trim();
const revalidateFlight=(flightId:number)=>{revalidatePath(`/flights/${flightId}`);revalidatePath(`/flights/${flightId}/audit`);revalidatePath("/flights");revalidatePath("/certification");revalidatePath("/print");revalidatePath("/database");revalidatePath("/connections");revalidatePath("/notifications");};

async function autoRequestTrainingVerification(userId:number,flightId:number,row:Record<string,unknown>){
  const role=text(row.role).toUpperCase();if(!["DUAL","SPIC","PICUS"].includes(role))return;
  const verifierName=role==="DUAL"?text(row.instructor):text(row.verification_name);if(!verifierName)return;
  const candidates=await sql`SELECT DISTINCT u.id,u.display_name FROM pilot_connections c JOIN users u ON u.id=CASE WHEN c.requester_user_id=${userId} THEN c.recipient_user_id ELSE c.requester_user_id END
    WHERE c.status='accepted' AND LOWER(TRIM(u.display_name))=LOWER(TRIM(${verifierName}))
      AND ((c.requester_user_id=${userId} AND (c.requester_label='instructor' OR c.relationship='recipient_instructor')) OR (c.recipient_user_id=${userId} AND (c.recipient_label='instructor' OR c.relationship='requester_instructor'))) LIMIT 2` as Array<Record<string,unknown>>;
  if(candidates.length!==1)return;
  const instructorId=Number(candidates[0].id);if(!instructorId||instructorId===userId)return;
  await upsertInstructorRequest(userId,flightId,instructorId);
}

export async function certifyFlight(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();await ensureV132Schema();
  if(!Number.isSafeInteger(flightId)||flightId<=0||text(form.get("confirm"))!=="certify")return;
  const rows=await sql`SELECT f.id,f.date::text date,f.evidence,f.registration,f.aircraft_make,f.aircraft_model,f.aircraft_variant,f.aircraft_type,f.aircraft_class,f.departure,f.arrival,f.off_block,f.takeoff,f.landing,f.on_block,f.starts,f.operation_type,f.engine_type,f.landings_day,f.landings_night,f.night_minutes,f.ifr_minutes,f.pic_minutes,f.copilot_minutes,f.dual_minutes,f.instructor_minutes,f.commander,f.instructor,f.role,f.task,f.note,f.purpose_code,f.verification_name,f.verification_reference,f.certified_at,f.certification_version,f.record_revision,f.correction_reason,u.display_name pilot_name FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${flightId} AND f.user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||row.certified_at)return;
  const compliance=fcl050FlightCompliance(row,text(row.pilot_name));if(blockingComplianceIssues(compliance).length)return;
  const certificationHash=flightCertificationHash({...row,certification_version:3},userId,3);
  await sql.transaction([
    sql`UPDATE flights SET locked_at=NULL,locked_by_user_id=NULL WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL AND locked_at IS NOT NULL`,
    sql`UPDATE flights SET certified_at=NOW(),certified_by_user_id=${userId},certification_hash=${certificationHash},certification_version=3,locked_at=NOW(),locked_by_user_id=${userId} WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL`,
  ]);
  await autoRequestTrainingVerification(userId,flightId,row);
  revalidateFlight(flightId);
}

export async function startCertifiedCorrection(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();await ensureV132Schema();
  if(!Number.isSafeInteger(flightId)||flightId<=0)return;
  const reason=text(form.get("reason")).slice(0,1000);if(reason.length<8)return;
  const rows=await sql`SELECT certified_at,certification_hash,record_revision FROM flights WHERE id=${flightId} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const current=rows[0];if(!current||!current.certified_at)return;
  await sql.transaction([
    sql`INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key) SELECT participant_user_id,'request_outdated','Flight request outdated','The source pilot opened this flight for correction. A new request is required for the new revision.','/connections','participation-outdated:'||id FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${Number(current.record_revision)||1} AND status='pending' ON CONFLICT(user_id,dedupe_key) DO UPDATE SET created_at=NOW(),read_at=NULL`,
    sql`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_at,superseded_by_user_id,correction_reason)
      SELECT f.id,f.user_id,COALESCE(f.record_revision,1),to_jsonb(f),COALESCE(f.certification_hash,''),COALESCE(f.certification_version,1),f.certified_at,f.certified_by_user_id,NOW(),${userId},${reason}
      FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL
      ON CONFLICT(user_id,flight_id,revision_number) DO NOTHING`,
    sql`UPDATE flights SET record_revision=COALESCE(record_revision,1)+1,correction_reason=${reason},correction_opened_at=NOW(),correction_opened_by_user_id=${userId},certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL
      WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NOT NULL`,
    sql`UPDATE flight_participations SET status='superseded',superseded_at=NOW(),responded_at=NOW(),decision_note='Source flight opened for correction.' WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${Number(current.record_revision)||1} AND status='pending'`,
    sql`UPDATE instructor_flight_approvals SET status='superseded',decided_at=NOW(),decision_note='Source flight opened for correction.' WHERE flight_id=${flightId} AND student_user_id=${userId} AND record_revision=${Number(current.record_revision)||1} AND status='pending'`,
    sql`UPDATE flight_verifications SET status='superseded' WHERE flight_id=${flightId} AND flight_user_id=${userId} AND record_revision=${Number(current.record_revision)||1} AND status='pending'`,
  ]);
  revalidateFlight(flightId);
}
