"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { blockingComplianceIssues,fcl050FlightCompliance } from "@/lib/fcl050-compliance";

const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text=(value:unknown)=>String(value??"").trim();
const revalidateFlight=(flightId:number)=>{revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/print");revalidatePath("/database");};

export async function certifyFlight(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  if(!Number.isSafeInteger(flightId)||flightId<=0||text(form.get("confirm"))!=="certify")return;
  const rows=await sql`SELECT f.id,f.date::text date,f.evidence,f.registration,f.aircraft_make,f.aircraft_model,f.aircraft_variant,f.aircraft_type,f.aircraft_class,f.departure,f.arrival,f.off_block,f.takeoff,f.landing,f.on_block,f.operation_type,f.engine_type,f.landings_day,f.landings_night,f.night_minutes,f.ifr_minutes,f.pic_minutes,f.copilot_minutes,f.dual_minutes,f.instructor_minutes,f.commander,f.instructor,f.role,f.task,f.note,f.verification_name,f.verification_reference,f.certified_at,f.record_revision,f.correction_reason,u.display_name pilot_name FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${flightId} AND f.user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||row.certified_at)return;
  const compliance=fcl050FlightCompliance(row,text(row.pilot_name));if(blockingComplianceIssues(compliance).length)return;
  const recordRevision=Math.max(1,Number(row.record_revision||1));
  const certificationHash=hash({
    version:2,userId,id:Number(row.id),recordRevision,correctionReason:text(row.correction_reason),date:text(row.date),evidence:text(row.evidence),registration:text(row.registration),
    aircraft:{make:text(row.aircraft_make),model:text(row.aircraft_model)||text(row.aircraft_type),variant:text(row.aircraft_variant),legacyType:text(row.aircraft_type),class:text(row.aircraft_class)},
    route:{departure:text(row.departure),arrival:text(row.arrival)},times:{offBlock:text(row.off_block),takeoff:text(row.takeoff),landing:text(row.landing),onBlock:text(row.on_block)},
    operation:{operationType:text(row.operation_type),engineType:text(row.engine_type),landingsDay:Number(row.landings_day||0),landingsNight:Number(row.landings_night||0),nightMinutes:Number(row.night_minutes||0),ifrMinutes:Number(row.ifr_minutes||0)},
    function:{picMinutes:Number(row.pic_minutes||0),copilotMinutes:Number(row.copilot_minutes||0),dualMinutes:Number(row.dual_minutes||0),instructorMinutes:Number(row.instructor_minutes||0),commander:text(row.commander),instructor:text(row.instructor),role:text(row.role)},
    remarks:{task:text(row.task),note:text(row.note),verificationName:text(row.verification_name),verificationReference:text(row.verification_reference)}
  });
  await sql.transaction([
    sql`UPDATE flights SET locked_at=NULL,locked_by_user_id=NULL WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL AND locked_at IS NOT NULL`,
    sql`UPDATE flights SET certified_at=NOW(),certified_by_user_id=${userId},certification_hash=${certificationHash},certification_version=2,locked_at=NOW(),locked_by_user_id=${userId} WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL`,
  ]);
  revalidateFlight(flightId);
}

export async function startCertifiedCorrection(flightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();
  if(!Number.isSafeInteger(flightId)||flightId<=0)return;
  const reason=text(form.get("reason")).slice(0,1000);if(reason.length<8)return;
  const rows=await sql`SELECT certified_at,certification_hash,record_revision FROM flights WHERE id=${flightId} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const current=rows[0];if(!current||!current.certified_at)return;
  await sql.transaction([
    sql`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_at,superseded_by_user_id,correction_reason)
      SELECT f.id,f.user_id,COALESCE(f.record_revision,1),to_jsonb(f),COALESCE(f.certification_hash,''),COALESCE(f.certification_version,1),f.certified_at,f.certified_by_user_id,NOW(),${userId},${reason}
      FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL
      ON CONFLICT(user_id,flight_id,revision_number) DO NOTHING`,
    sql`UPDATE flights SET record_revision=COALESCE(record_revision,1)+1,correction_reason=${reason},correction_opened_at=NOW(),correction_opened_by_user_id=${userId},certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL
      WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NOT NULL`,
  ]);
  revalidateFlight(flightId);
}
