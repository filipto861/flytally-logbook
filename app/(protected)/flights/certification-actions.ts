"use server";

import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { refreshRecencySnapshot } from "@/lib/recency-service";
import { ensureFlightSharingSchema } from "@/lib/flight-sharing";
import { certifyStoredFlight } from "@/lib/flight-certification";
import { revalidateFlightCertificationViews } from "@/lib/flight-revalidation";

const text=(value:unknown)=>String(value??"").trim();
export async function certifyFlight(flightId:number,form:FormData){
  const {userId}=await requireUser();
  if(!Number.isSafeInteger(flightId)||flightId<=0||text(form.get("confirm"))!=="certify")return;
  let result=await certifyStoredFlight(userId,flightId);
  if(result.status==="locked"){
    await sql`UPDATE flights SET locked_at=NULL,locked_by_user_id=NULL WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL AND locked_at IS NOT NULL`;
    result=await certifyStoredFlight(userId,flightId);
  }
  if(result.status==="certified"||result.status==="already-certified")revalidateFlightCertificationViews(flightId);
}
export async function startCertifiedCorrection(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();await Promise.all([ensureV132Schema(),ensureFlightSharingSchema()]);if(!Number.isSafeInteger(flightId)||flightId<=0)return;const reason=text(form.get("reason")).slice(0,1000);if(reason.length<8)return;const rows=await sql`SELECT certified_at,certification_hash,record_revision FROM flights WHERE id=${flightId} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;const current=rows[0];if(!current||!current.certified_at)return;
  await sql.transaction([
    sql`INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key) SELECT participant_user_id,'request_outdated','Flight request outdated','The source pilot opened this flight for correction. A new request is required for the new revision.','/connections','participation-outdated:'||id FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${Number(current.record_revision)||1} AND status='pending' ON CONFLICT(user_id,dedupe_key) DO UPDATE SET created_at=NOW(),read_at=NULL`,
    sql`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_at,superseded_by_user_id,correction_reason) SELECT f.id,f.user_id,COALESCE(f.record_revision,1),to_jsonb(f),COALESCE(f.certification_hash,''),COALESCE(f.certification_version,1),f.certified_at,f.certified_by_user_id,NOW(),${userId},${reason} FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL ON CONFLICT(user_id,flight_id,revision_number) DO NOTHING`,
    sql`UPDATE flights SET record_revision=COALESCE(record_revision,1)+1,correction_reason=${reason},correction_opened_at=NOW(),correction_opened_by_user_id=${userId},certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NOT NULL`,
    sql`UPDATE flight_participations SET status='superseded',superseded_at=NOW(),responded_at=NOW(),decision_note='Source flight opened for correction.' WHERE source_flight_id=${flightId} AND source_user_id=${userId} AND source_revision=${Number(current.record_revision)||1} AND status='pending'`,
    sql`UPDATE instructor_flight_approvals SET status='superseded',decided_at=NOW(),decision_note='Source flight opened for correction.' WHERE flight_id=${flightId} AND student_user_id=${userId} AND record_revision=${Number(current.record_revision)||1} AND status='pending'`,
    sql`UPDATE flight_verifications SET status='superseded' WHERE flight_id=${flightId} AND flight_user_id=${userId} AND record_revision=${Number(current.record_revision)||1} AND status='pending'`,
    sql`UPDATE flight_public_shares SET revoked_at=NOW() WHERE user_id=${userId} AND flight_id=${flightId} AND revoked_at IS NULL`,
  ]);await refreshRecencySnapshot(userId);revalidateFlightCertificationViews(flightId);
}