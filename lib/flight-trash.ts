import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

export type DeletedFlight={id:number;originalFlightId:number;date:string;registration:string;departure:string;arrival:string;deletedAt:string;purgeAfter:string;trackCount:number};

export async function listDeletedFlights(userId:number):Promise<DeletedFlight[]>{
  await ensureDatabaseOptimizations();
  await sql`DELETE FROM deleted_flights WHERE user_id=${userId} AND purge_after<=NOW()`;
  const rows=await sql`SELECT id,original_flight_id,flight_data->>'date' date,COALESCE(flight_data->>'registration','') registration,COALESCE(flight_data->>'departure','') departure,COALESCE(flight_data->>'arrival','') arrival,deleted_at,purge_after,jsonb_array_length(tracks_data)::int track_count FROM deleted_flights WHERE user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() ORDER BY deleted_at DESC,id DESC LIMIT 100` as Array<Record<string,unknown>>;
  return rows.map(row=>({id:Number(row.id),originalFlightId:Number(row.original_flight_id),date:String(row.date||""),registration:String(row.registration||""),departure:String(row.departure||""),arrival:String(row.arrival||""),deletedAt:String(row.deleted_at||""),purgeAfter:String(row.purge_after||""),trackCount:Number(row.track_count||0)}));
}

export async function moveFlightToTrash(userId:number,flightId:number):Promise<boolean>{
  await ensureDatabaseOptimizations();const token=randomUUID();
  const results=await sql.transaction([
    sql`UPDATE flights f SET locked_at=NULL,locked_by_user_id=NULL WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NULL AND EXISTS(SELECT 1 FROM flight_participations p WHERE p.participant_user_id=${userId} AND p.participant_flight_id=f.id) RETURNING f.id`,
    sql`INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data)
      SELECT f.user_id,f.id,${token},to_jsonb(f),COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM flight_tracks t WHERE t.user_id=f.user_id AND t.flight_id=f.id),'[]'::jsonb)
      FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} AND f.certified_at IS NULL AND COALESCE(f.record_revision,1)=1
        AND (f.locked_at IS NULL OR EXISTS(SELECT 1 FROM flight_participations p WHERE p.participant_user_id=${userId} AND p.participant_flight_id=f.id))
        AND NOT EXISTS(SELECT 1 FROM flight_certified_revisions r WHERE r.user_id=f.user_id AND r.flight_id=f.id)
      RETURNING id`,
    sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId}) AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})`,
    sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})`,
    sql`DELETE FROM flights WHERE id=${flightId} AND user_id=${userId} AND certified_at IS NULL AND COALESCE(record_revision,1)=1 AND NOT EXISTS(SELECT 1 FROM flight_certified_revisions r WHERE r.user_id=${userId} AND r.flight_id=${flightId}) AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})`,
  ]);
  return Boolean((results[1] as Array<{id:number|string}>)[0]);
}

export async function restoreDeletedFlightRecord(userId:number,trashId:number):Promise<{flightId?:number;error?:string}>{
  await ensureDatabaseOptimizations();
  const rows=await sql`WITH candidate AS MATERIALIZED (
      SELECT * FROM deleted_flights WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() LIMIT 1
    ), restored_flight AS (
      INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,price_per_hour,billing_basis,note,locked_at,locked_by_user_id,operation_type,engine_type,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,verification_name,verification_reference)
      SELECT ${userId},NULLIF(flight_data->>'date','')::date,COALESCE(flight_data->>'evidence',''),COALESCE(flight_data->>'registration',''),COALESCE(flight_data->>'aircraft_type',''),COALESCE(flight_data->>'aircraft_class',''),COALESCE(flight_data->>'departure',''),COALESCE(flight_data->>'arrival',''),COALESCE(flight_data->>'off_block',''),COALESCE(flight_data->>'takeoff',''),COALESCE(flight_data->>'landing',''),COALESCE(flight_data->>'on_block',''),COALESCE(NULLIF(flight_data->>'starts','')::int,0),COALESCE(flight_data->>'commander',''),COALESCE(flight_data->>'instructor',''),COALESCE(flight_data->>'role',''),COALESCE(flight_data->>'task',''),NULLIF(flight_data->>'price_per_hour','')::numeric,COALESCE(flight_data->>'billing_basis','BLOCK'),COALESCE(flight_data->>'note',''),NULL,NULL,COALESCE(flight_data->>'operation_type','SP'),COALESCE(flight_data->>'engine_type','SE'),COALESCE(NULLIF(flight_data->>'landings_day','')::int,COALESCE(NULLIF(flight_data->>'starts','')::int,0)),COALESCE(NULLIF(flight_data->>'landings_night','')::int,0),COALESCE(NULLIF(flight_data->>'night_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'ifr_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'pic_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'copilot_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'dual_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'instructor_minutes','')::int,0),COALESCE(flight_data->>'verification_name',''),COALESCE(flight_data->>'verification_reference','')
      FROM candidate c WHERE NOT EXISTS(SELECT 1 FROM flights f WHERE f.user_id=${userId} AND f.date::text=c.flight_data->>'date' AND UPPER(TRIM(f.registration))=UPPER(TRIM(c.flight_data->>'registration')) AND COALESCE(f.off_block,'')=COALESCE(c.flight_data->>'off_block','') AND UPPER(TRIM(COALESCE(f.departure,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'departure',''))) AND UPPER(TRIM(COALESCE(f.arrival,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'arrival','')))) RETURNING id
    ), track_source AS MATERIALIZED (
      SELECT nextval(pg_get_serial_sequence('flight_tracks','id')) new_id,track FROM candidate c CROSS JOIN LATERAL jsonb_array_elements(c.tracks_data) track
    ), restored_tracks AS (
      INSERT INTO flight_tracks(id,user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version)
      SELECT s.new_id,${userId},f.id,COALESCE(s.track->>'file_name','restored-track'),COALESCE(NULLIF(s.track->>'imported_at','')::timestamptz,NOW()),COALESCE(NULLIF(s.track->>'point_count','')::int,0),COALESCE(NULLIF(s.track->>'distance_km','')::numeric,0),NULLIF(s.track->>'start_utc','')::timestamptz,NULLIF(s.track->>'end_utc','')::timestamptz,NULLIF(s.track->>'min_alt_m','')::numeric,NULLIF(s.track->>'max_alt_m','')::numeric,COALESCE(s.track->>'coordinates_json','[]'),COALESCE(s.track->>'overview_coordinates_json','[]'),COALESCE(NULLIF(s.track->>'overview_version','')::int,1) FROM track_source s CROSS JOIN restored_flight f RETURNING id
    ), marked AS (
      UPDATE deleted_flights SET restored_at=NOW(),restored_flight_id=(SELECT id FROM restored_flight) WHERE id=${trashId} AND user_id=${userId} AND EXISTS(SELECT 1 FROM restored_flight) RETURNING restored_flight_id
    ) SELECT restored_flight_id FROM marked` as Array<{restored_flight_id:number|string}>;
  if(rows[0])return{flightId:Number(rows[0].restored_flight_id)};
  const candidate=await sql`SELECT id FROM deleted_flights WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() LIMIT 1`;
  return candidate[0]?{error:"This flight already exists in the logbook."}:{error:"Deleted flight was not found or has expired."};
}
