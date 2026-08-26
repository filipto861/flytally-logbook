"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { flightMinutes } from "@/lib/dashboard-math";
import { flightFingerprint } from "@/lib/flight-dedup";

const id=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const text=(value:unknown)=>String(value??"").trim();
const refresh=(sourceFlightId:number)=>{revalidatePath(`/flights/${sourceFlightId}`);revalidatePath("/connections");revalidatePath("/flights");revalidatePath("/dashboard")};

type ParticipationSource=Record<string,unknown>&{participation_id:number|string;source_flight_id:number|string;participant_flight_id:number|string|null};

async function materializeParticipation(participationId:number,userId:number){
  const rows=await sql`SELECT p.id participation_id,p.source_flight_id,p.source_user_id,p.participant_user_id,p.participant_role,p.source_revision,p.source_hash,p.status,p.participant_flight_id,
    f.date::text date,f.evidence,f.registration,f.aircraft_type,f.aircraft_class,f.aircraft_make,f.aircraft_model,f.aircraft_variant,f.departure,f.arrival,f.off_block,f.takeoff,f.landing,f.on_block,
    f.task,f.operation_type,f.engine_type,f.starts,f.landings_day,f.landings_night,f.night_minutes,f.ifr_minutes,f.price_per_hour,f.billing_basis,f.certified_at,f.certification_hash,f.record_revision,
    source.display_name source_name,participant.display_name participant_name,
    (SELECT NULLIF(TRIM(ac.icao_type),'') FROM aircraft ac WHERE ac.user_id=f.user_id AND UPPER(TRIM(ac.registration))=UPPER(TRIM(f.registration)) ORDER BY ac.id DESC LIMIT 1) icao_type
    FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id
    JOIN users source ON source.id=p.source_user_id JOIN users participant ON participant.id=p.participant_user_id
    WHERE p.id=${participationId} AND p.participant_user_id=${userId} LIMIT 1` as ParticipationSource[];
  const row=rows[0];if(!row)return 0;
  if(row.participant_flight_id)return Number(row.participant_flight_id);
  const role=text(row.participant_role);if(!["INSTRUCTOR","SAFETY PILOT"].includes(role)||row.status!=="pending"||!row.certified_at||Number(row.record_revision)!==Number(row.source_revision)||text(row.certification_hash)!==text(row.source_hash))return 0;
  const block=flightMinutes(text(row.off_block),text(row.on_block)),instructor=role==="INSTRUCTOR",commander=instructor?text(row.participant_name):text(row.source_name),instructorName=instructor?text(row.participant_name):"";
  const fingerprint=flightFingerprint(userId,{date:text(row.date),registration:text(row.registration),offBlock:text(row.off_block),departure:text(row.departure),arrival:text(row.arrival)});
  const result=await sql`WITH locked AS MATERIALIZED(SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint},0))),
    current_source AS MATERIALIZED(SELECT 1 ok FROM flights sf,locked WHERE sf.id=${Number(row.source_flight_id)} AND sf.user_id=${Number(row.source_user_id)} AND sf.certified_at IS NOT NULL AND COALESCE(sf.record_revision,1)=${Number(row.source_revision)} AND sf.certification_hash=${text(row.source_hash)}),
    aircraft_profile AS(INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,note,created_at,updated_at)
      SELECT ${userId},${text(row.registration)},${text(row.aircraft_type)},${text(row.aircraft_make)},${text(row.aircraft_model)},${text(row.aircraft_variant)},${text(row.icao_type)},${text(row.aircraft_class)},${text(row.evidence)},${row.price_per_hour===null?null:Number(row.price_per_hour)||0},${role},${text(row.billing_basis)||'BLOCK'},1,'Added from a shared certified flight',NOW(),NOW()
      FROM current_source WHERE NOT EXISTS(SELECT 1 FROM aircraft WHERE user_id=${userId} AND UPPER(TRIM(registration))=${text(row.registration).toUpperCase()}) ON CONFLICT(user_id,registration) DO NOTHING RETURNING id),
    existing AS MATERIALIZED(SELECT id,UPPER(TRIM(COALESCE(role,''))) role FROM flights WHERE user_id=${userId} AND date::text=${text(row.date)} AND UPPER(TRIM(registration))=${text(row.registration).toUpperCase()} AND COALESCE(off_block,'')=${text(row.off_block)} AND UPPER(TRIM(COALESCE(departure,'')))=${text(row.departure).toUpperCase()} AND UPPER(TRIM(COALESCE(arrival,'')))=${text(row.arrival).toUpperCase()} ORDER BY id LIMIT 1),
    inserted AS(INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,aircraft_make,aircraft_model,aircraft_variant,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note,operation_type,engine_type,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,verification_name,verification_reference)
      SELECT ${userId},${text(row.date)},${text(row.evidence)},${text(row.registration)},${text(row.aircraft_type)},${text(row.aircraft_class)},${text(row.aircraft_make)},${text(row.aircraft_model)},${text(row.aircraft_variant)},${text(row.departure)},${text(row.arrival)},${text(row.off_block)},${text(row.takeoff)},${text(row.landing)},${text(row.on_block)},${Number(row.starts)||0},${commander},${instructorName},${role},${text(row.task)},${row.price_per_hour===null?null:Number(row.price_per_hour)||0},${text(row.billing_basis)||'BLOCK'},${`Shared flight with ${text(row.source_name)}`},${text(row.operation_type)||"SP"},${text(row.engine_type)||"SE"},${Number(row.landings_day)||0},${Number(row.landings_night)||0},${Number(row.night_minutes)||0},${Number(row.ifr_minutes)||0},${instructor?block:0},0,0,${instructor?block:0},'',''
      FROM current_source WHERE NOT EXISTS(SELECT 1 FROM existing) RETURNING id),
    copied_tracks AS(INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version)
      SELECT ${userId},inserted.id,source_track.file_name,NOW(),source_track.point_count,source_track.distance_km,source_track.start_utc,source_track.end_utc,source_track.min_alt_m,source_track.max_alt_m,source_track.coordinates_json,source_track.overview_coordinates_json,source_track.overview_version
      FROM inserted JOIN flight_tracks source_track ON source_track.flight_id=${Number(row.source_flight_id)} AND source_track.user_id=${Number(row.source_user_id)} RETURNING id),
    chosen AS(SELECT id FROM existing WHERE role=${role} UNION ALL SELECT id FROM inserted LIMIT 1),
    linked AS(UPDATE flight_participations p SET status='accepted',responded_at=NOW(),participant_flight_id=chosen.id FROM chosen,current_source WHERE p.id=${participationId} AND p.participant_user_id=${userId} AND p.status='pending' RETURNING p.participant_flight_id)
    SELECT participant_flight_id FROM linked` as Array<{participant_flight_id:number|string}>;
  return Number(result[0]?.participant_flight_id)||0;
}

export async function inviteSafetyPilot(sourceFlightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const participantId=id(form.get("participant_id"));
  if(!Number.isSafeInteger(sourceFlightId)||sourceFlightId<=0||!participantId||participantId===userId)return;
  await sql`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)
    SELECT f.id,f.user_id,${participantId},'SAFETY PILOT',COALESCE(f.record_revision,1),f.certification_hash,'pending' FROM flights f
    WHERE f.id=${sourceFlightId} AND f.user_id=${userId} AND f.certified_at IS NOT NULL AND COALESCE(f.certification_hash,'')<>'' AND UPPER(TRIM(COALESCE(f.role,'')))='PIC'
      AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=${userId} AND c.recipient_user_id=${participantId}) OR (c.recipient_user_id=${userId} AND c.requester_user_id=${participantId})))
    ON CONFLICT(source_flight_id,source_revision,participant_role) DO UPDATE SET participant_user_id=EXCLUDED.participant_user_id,source_hash=EXCLUDED.source_hash,status='pending',created_at=NOW(),responded_at=NULL,participant_flight_id=NULL
      WHERE flight_participations.status='declined'`;
  refresh(sourceFlightId);
}

export async function cancelSafetyInvitation(sourceFlightId:number,form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const participationId=id(form.get("participation_id"));if(!participationId)return;
  await sql`DELETE FROM flight_participations WHERE id=${participationId} AND source_flight_id=${sourceFlightId} AND source_user_id=${userId} AND participant_role='SAFETY PILOT' AND status='pending'`;
  refresh(sourceFlightId);
}

export async function declineSharedFlight(participationId:number){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(participationId)||participationId<=0)return;
  const rows=await sql`UPDATE flight_participations SET status='declined',responded_at=NOW() WHERE id=${participationId} AND participant_user_id=${userId} AND status='pending' RETURNING source_flight_id` as Array<{source_flight_id:number|string}>;
  if(rows[0])refresh(Number(rows[0].source_flight_id));
}

export async function acceptSharedFlight(participationId:number){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const flightId=await materializeParticipation(participationId,userId);
  if(flightId){revalidatePath(`/flights/${flightId}`);redirect(`/flights/${flightId}`)}
  redirect(`/connections/shared/${participationId}?error=unavailable`);
}

export async function addApprovedFlightToLogbook(approvalId:number){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(approvalId)||approvalId<=0)return;
  const rows=await sql`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)
    SELECT a.flight_id,a.student_user_id,a.instructor_user_id,'INSTRUCTOR',a.record_revision,a.flight_hash,'pending' FROM instructor_flight_approvals a JOIN flights f ON f.id=a.flight_id
    WHERE a.id=${approvalId} AND a.instructor_user_id=${userId} AND a.status='approved' AND f.user_id=a.student_user_id AND f.certified_at IS NOT NULL AND COALESCE(f.record_revision,1)=a.record_revision AND f.certification_hash=a.flight_hash
    ON CONFLICT(source_flight_id,source_revision,participant_role) DO UPDATE SET source_hash=EXCLUDED.source_hash
      WHERE flight_participations.participant_user_id=EXCLUDED.participant_user_id RETURNING id` as Array<{id:number|string}>;
  const participationId=Number(rows[0]?.id);if(!participationId)redirect(`/connections/flight/${approvalId}?error=unavailable`);
  const flightId=await materializeParticipation(participationId,userId);if(flightId){revalidatePath(`/flights/${flightId}`);redirect(`/flights/${flightId}`)}
  redirect(`/connections/flight/${approvalId}?error=duplicate`);
}
