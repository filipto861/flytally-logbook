import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV159Schema } from "@/lib/v159-schema";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";
import { ensureV166Schema } from "@/lib/v166-schema";
import { ensureFlightSharingSchema } from "@/lib/flight-sharing";
export type DeletedFlight={id:number;originalFlightId:number;date:string;registration:string;departure:string;arrival:string;deletedAt:string;purgeAfter:string;trackCount:number};
export async function listDeletedFlights(userId:number):Promise<DeletedFlight[]>{await ensureDatabaseOptimizations();await sql`DELETE FROM deleted_flights WHERE user_id=${userId} AND purge_after<=NOW()`;const rows=await sql`SELECT id,original_flight_id,flight_data->>'date' date,COALESCE(flight_data->>'registration','') registration,COALESCE(flight_data->>'departure','') departure,COALESCE(flight_data->>'arrival','') arrival,deleted_at,purge_after,jsonb_array_length(tracks_data)::int track_count FROM deleted_flights WHERE user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() ORDER BY deleted_at DESC,id DESC LIMIT 100` as Array<Record<string,unknown>>;return rows.map(row=>({id:Number(row.id),originalFlightId:Number(row.original_flight_id),date:String(row.date||""),registration:String(row.registration||""),departure:String(row.departure||""),arrival:String(row.arrival||""),deletedAt:String(row.deleted_at||""),purgeAfter:String(row.purge_after||""),trackCount:Number(row.track_count||0)}))}
// A+ frozen: an ordinary Trash operation is only for an unlinked, unprotected
// draft. Preserve independent participant/approval/provenance/verification evidence.
// Both the archive snapshot and the final DELETE must succeed atomically.
export async function moveFlightToTrash(userId:number,flightId:number):Promise<boolean>{
  if(!Number.isSafeInteger(userId)||userId<=0||!Number.isSafeInteger(flightId)||flightId<=0)return false;
  await ensureDatabaseOptimizations();
  await Promise.all([ensureV159Schema(),ensureV162Schema(),ensureV164Schema(),ensureV166Schema()]);
  await ensureFlightSharingSchema();

  const token=randomUUID();
  const results=await sql.transaction([
    // Always lock an existing owned row *before* testing eligibility; another
    // writer must not change a previously ineligible row into an eligible one
    // between a conditional lock miss and the archive snapshot.
    // FK child inserts referencing this parent also wait on the FOR UPDATE.
    sql`SELECT f.id FROM flights f
      WHERE f.id=${flightId} AND f.user_id=${userId}
      FOR UPDATE`,

    sql`INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data)
      SELECT f.user_id,f.id,${token},to_jsonb(f),
        COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM flight_tracks t WHERE t.user_id=f.user_id AND t.flight_id=f.id),'[]'::jsonb),
        COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM flight_expenses e WHERE e.user_id=f.user_id AND e.flight_id=f.id),'[]'::jsonb)
      FROM flights f
      WHERE f.id=${flightId} AND f.user_id=${userId}
        AND f.certified_at IS NULL AND f.locked_at IS NULL
        AND COALESCE(f.record_revision,1)=1
      AND NOT EXISTS (SELECT 1 FROM flight_participations p WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_connected_crew c WHERE c.source_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM instructor_flight_approvals a WHERE a.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_source_provenance p WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_public_shares s WHERE s.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_certified_revisions r WHERE r.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM voided_certified_flights v WHERE v.user_id=f.user_id AND v.original_flight_id=f.id)
      RETURNING id`,

    sql`DELETE FROM track_points
      WHERE user_id=${userId}
        AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId})
        AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})`,

    sql`DELETE FROM flight_tracks
      WHERE user_id=${userId} AND flight_id=${flightId}
        AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})`,

    // The count is a runtime subquery, not a constant expression. If the
    // archive was inserted but DELETE affected 0 rows, division by zero
    // aborts this SQL statement and rolls back the WHOLE transaction.
    sql`WITH deleted AS (
      DELETE FROM flights f
      WHERE f.id=${flightId} AND f.user_id=${userId}
        AND f.certified_at IS NULL AND f.locked_at IS NULL
        AND COALESCE(f.record_revision,1)=1
        AND EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})
      AND NOT EXISTS (SELECT 1 FROM flight_participations p WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_connected_crew c WHERE c.source_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM instructor_flight_approvals a WHERE a.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_source_provenance p WHERE p.source_flight_id=f.id OR p.participant_flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_public_shares s WHERE s.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM flight_certified_revisions r WHERE r.flight_id=f.id)
      AND NOT EXISTS (SELECT 1 FROM voided_certified_flights v WHERE v.user_id=f.user_id AND v.original_flight_id=f.id)
      RETURNING f.id
    )
    SELECT (SELECT COUNT(*)::integer FROM deleted) AS deleted_count,
      1 / CASE
        WHEN EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token=${token} AND user_id=${userId})
        THEN (SELECT COUNT(*)::integer FROM deleted)
        ELSE 1
      END AS archive_delete_consistency`,
  ]);
  const deleted=(results[4] as Array<{deleted_count:number|string}>)[0];
  return Number(deleted?.deleted_count)===1 && Boolean((results[1] as Array<{id:number|string}>)[0]);
}

export async function restoreDeletedFlightRecord(userId:number,trashId:number):Promise<{flightId?:number;error?:string}>{await ensureDatabaseOptimizations();await Promise.all([ensureV159Schema(),ensureV162Schema(),ensureV164Schema(),ensureV166Schema()]);  // Preflight is read-only; the later candidate is locked and digest-bound.
  // The canonical legacy statement remains unchanged for all pre-v21 records.
  const sourceRows=await sql`SELECT flight_data,expenses_data,
    md5(flight_data::text || expenses_data::text) AS archive_digest
    FROM deleted_flights WHERE id=${trashId} AND user_id=${userId}
    AND restored_at IS NULL AND purge_after>NOW() LIMIT 1` as Array<{
      flight_data:Record<string,unknown>; expenses_data:unknown; archive_digest:string
    }>;
  const saved=sourceRows[0],flight=saved?.flight_data,expenseRows=saved?.expenses_data,archiveDigest=saved?.archive_digest;
  const hasMoney=!!flight&&["price_currency_code","price_currency_minor_units","price_per_hour_decimal"]
    .some(key=>flight[key]!==null&&flight[key]!==undefined);
  const hasExpenseMoney=Array.isArray(expenseRows)&&expenseRows.some(row=>
    row&&typeof row==="object"&&["amount_encoding","amount_minor_units"]
      .some(key=>(row as Record<string,unknown>)[key]!==null&&(row as Record<string,unknown>)[key]!==undefined));
  const currencyRestore=hasMoney||hasExpenseMoney;
  if(currencyRestore){
    const columns=await sql`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema=current_schema()
      AND ((table_name='flights' AND column_name IN
        ('price_currency_code','price_currency_minor_units','price_per_hour_decimal'))
      OR (table_name='flight_expenses' AND column_name IN
        ('amount_encoding','amount_minor_units')))` as Array<Record<string,unknown>>;
    if(columns.length!==5)return{error:"Currency restore requires database schema v21."};
    const {supportedIsoCurrency}=await import("@/lib/iso4217-currency-registry");
    if(hasMoney){
      const iso=supportedIsoCurrency(flight?.price_currency_code),decimal=flight?.price_per_hour_decimal;
      if(!iso||iso.minorUnits!==flight?.price_currency_minor_units
        ||decimal===null||decimal===undefined
        ||!/^\d+(?:\.\d+)?$/.test(String(decimal))
        ||!Number.isFinite(Number(decimal))||Number(decimal)<=0
        ||flight?.price_per_hour===null||flight?.price_per_hour===undefined)
        return{error:"Archived flight currency metadata is incomplete or invalid."};
    }
    if(!Array.isArray(expenseRows))return{error:"Archived expenses must be an array."};
    for(const raw of expenseRows){
      if(!raw||typeof raw!=="object")return{error:"Archived expense data is invalid."};
      const row=raw as Record<string,unknown>,encoding=row.amount_encoding,minor=row.amount_minor_units;
      if(encoding===null||encoding===undefined){
        if(minor!==null&&minor!==undefined)return{error:"Archived expense precision is incomplete."};
      }else if(encoding==="legacy_two_decimal"){
        if(minor!==2)return{error:"Archived legacy expense precision is invalid."};
      }else if(encoding==="iso_minor_units"){
        const iso=supportedIsoCurrency(row.currency);
        if(!iso||iso.minorUnits!==minor)return{error:"Archived expense currency or precision is invalid."};
      }else return{error:"Archived expense amount encoding is invalid."};
    }
  }
  const restoreQuery=currencyRestore ? sql`WITH candidate AS MATERIALIZED (SELECT * FROM deleted_flights WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW()
 AND md5(flight_data::text || expenses_data::text)=${archiveDigest}
 AND jsonb_typeof(flight_data)='object'
 AND (flight_data ?& ARRAY['id','user_id','aircraft_make','aircraft_model','aircraft_variant'])
 AND NOT (
   COALESCE(NULLIF(TRIM(flight_data->>'aircraft_make'),''),NULLIF(TRIM(flight_data->>'aircraft_model'),''),NULLIF(TRIM(flight_data->>'aircraft_variant'),'')) IS NULL
   AND (
     NULLIF(TRIM(COALESCE(flight_data->>'aircraft_type','')),'') IS NOT NULL
     OR EXISTS (SELECT 1 FROM aircraft a WHERE a.user_id=deleted_flights.user_id
       AND UPPER(TRIM(a.registration))=UPPER(TRIM(flight_data->>'registration'))
       AND (NULLIF(TRIM(a.aircraft_make),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_model),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_variant),'') IS NOT NULL))
   )
 )
 AND flight_data->>'id'=original_flight_id::text
 AND flight_data->>'user_id'=user_id::text
 AND flight_data->>'certified_at' IS NULL
 AND flight_data->>'locked_at' IS NULL
 AND COALESCE(flight_data->>'record_revision','1')='1'
 AND COALESCE(flight_data->>'correction_reason','')=''
 AND NOT EXISTS(SELECT 1 FROM flight_certified_revisions r
   WHERE r.user_id=deleted_flights.user_id AND r.flight_id=deleted_flights.original_flight_id)
 AND CASE WHEN jsonb_typeof(tracks_data)='array'
   THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tracks_data) AS t(value)
     WHERE jsonb_typeof(t.value)<>'object'
       OR NOT (t.value ?& ARRAY['id','user_id','flight_id'])
       OR t.value->>'user_id' IS DISTINCT FROM user_id::text
       OR t.value->>'flight_id' IS DISTINCT FROM original_flight_id::text)
   ELSE FALSE END
 AND jsonb_typeof(tracks_data)='array'
 AND CASE WHEN jsonb_typeof(expenses_data)='array'
   THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expenses_data) AS e(value)
     WHERE jsonb_typeof(e.value)<>'object'
       OR NOT (e.value ?& ARRAY['id','user_id','flight_id','category','label','created_at'])
       OR e.value->>'user_id' IS DISTINCT FROM user_id::text
       OR e.value->>'flight_id' IS DISTINCT FROM original_flight_id::text
       OR e.value->>'category' IS NULL
       OR e.value->>'label' IS NULL
       OR e.value->>'created_at' IS NULL
       OR COALESCE(e.value->>'currency','') !~ '^[A-Z]{3}$'
       OR CASE WHEN COALESCE(e.value->>'amount_minor','') ~ '^[1-9][0-9]*$'
          THEN (e.value->>'amount_minor')::numeric > 1000000000
          ELSE TRUE END)
   ELSE FALSE END
 LIMIT 1 FOR UPDATE OF deleted_flights),restored_flight AS (INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,regulatory_category,balloon_class,balloon_group,balloon_operation,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,price_per_hour,price_currency_code,price_currency_minor_units,price_per_hour_decimal,billing_basis,note,locked_at,locked_by_user_id,operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,verification_name,verification_reference) SELECT ${userId},NULLIF(flight_data->>'date','')::date,COALESCE(flight_data->>'evidence',''),COALESCE(flight_data->>'registration',''),COALESCE(flight_data->>'aircraft_type',''),flight_data->>'aircraft_make',flight_data->>'aircraft_model',flight_data->>'aircraft_variant',COALESCE(flight_data->>'aircraft_class',''),COALESCE(flight_data->>'regulatory_category',''),COALESCE(flight_data->>'balloon_class',''),COALESCE(flight_data->>'balloon_group',''),COALESCE(flight_data->>'balloon_operation',''),COALESCE(flight_data->>'launch_method',''),COALESCE(NULLIF(flight_data->>'launches','')::int,0),COALESCE(flight_data->>'departure',''),COALESCE(flight_data->>'arrival',''),COALESCE(flight_data->>'off_block',''),COALESCE(flight_data->>'takeoff',''),COALESCE(flight_data->>'landing',''),COALESCE(flight_data->>'on_block',''),COALESCE(NULLIF(flight_data->>'starts','')::int,0),COALESCE(flight_data->>'commander',''),COALESCE(flight_data->>'instructor',''),COALESCE(flight_data->>'role',''),COALESCE(flight_data->>'task',''),COALESCE(flight_data->>'purpose_code',''),NULLIF(flight_data->>'price_per_hour','')::numeric,flight_data->>'price_currency_code',NULLIF(flight_data->>'price_currency_minor_units','')::smallint,NULLIF(flight_data->>'price_per_hour_decimal','')::numeric,COALESCE(flight_data->>'billing_basis','BLOCK'),COALESCE(flight_data->>'note',''),NULL,NULL,COALESCE(flight_data->>'operation_type','SP'),COALESCE(flight_data->>'engine_type','SE'),COALESCE(flight_data->>'operator_name',''),COALESCE(flight_data->>'flight_number',''),COALESCE(flight_data->>'operation_context',''),COALESCE(NULLIF(flight_data->>'landings_day','')::int,COALESCE(NULLIF(flight_data->>'starts','')::int,0)),COALESCE(NULLIF(flight_data->>'landings_night','')::int,0),COALESCE(NULLIF(flight_data->>'movement_evidence_recorded','')::boolean,FALSE),COALESCE(NULLIF(flight_data->>'takeoffs_day','')::int,0),COALESCE(NULLIF(flight_data->>'takeoffs_night','')::int,0),COALESCE(NULLIF(flight_data->>'approaches_day','')::int,0),COALESCE(NULLIF(flight_data->>'approaches_night','')::int,0),COALESCE(NULLIF(flight_data->>'night_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'ifr_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'pic_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'copilot_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'dual_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'instructor_minutes','')::int,0),COALESCE(flight_data->>'verification_name',''),COALESCE(flight_data->>'verification_reference','') FROM candidate c WHERE NOT EXISTS(SELECT 1 FROM flights f WHERE f.user_id=${userId} AND f.date::text=c.flight_data->>'date' AND UPPER(TRIM(f.registration))=UPPER(TRIM(c.flight_data->>'registration')) AND COALESCE(f.off_block,'')=COALESCE(c.flight_data->>'off_block','') AND UPPER(TRIM(COALESCE(f.departure,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'departure',''))) AND UPPER(TRIM(COALESCE(f.arrival,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'arrival','')))) RETURNING id),track_source AS MATERIALIZED (SELECT nextval(pg_get_serial_sequence('flight_tracks','id')) new_id,track FROM candidate c CROSS JOIN LATERAL jsonb_array_elements(c.tracks_data) track),restored_tracks AS (INSERT INTO flight_tracks(id,user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) SELECT s.new_id,${userId},f.id,s.track->>'file_name',(s.track->>'imported_at')::timestamptz,(s.track->>'point_count')::int,(s.track->>'distance_km')::numeric,NULLIF(s.track->>'start_utc','')::timestamptz,NULLIF(s.track->>'end_utc','')::timestamptz,NULLIF(s.track->>'min_alt_m','')::numeric,NULLIF(s.track->>'max_alt_m','')::numeric,s.track->>'coordinates_json',s.track->>'overview_coordinates_json',(s.track->>'overview_version')::int FROM track_source s CROSS JOIN restored_flight f RETURNING id),restored_expenses AS (INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,amount_encoding,amount_minor_units,created_at) SELECT ${userId},f.id,e->>'category',e->>'label',(e->>'amount_minor')::bigint,e->>'currency',e->>'amount_encoding',NULLIF(e->>'amount_minor_units','')::smallint,(e->>'created_at')::timestamptz FROM candidate c CROSS JOIN restored_flight f CROSS JOIN LATERAL jsonb_array_elements(c.expenses_data) e RETURNING id),marked AS (UPDATE deleted_flights SET restored_at=NOW(),restored_flight_id=(SELECT id FROM restored_flight) WHERE id=${trashId} AND user_id=${userId} AND EXISTS(SELECT 1 FROM restored_flight) RETURNING restored_flight_id) SELECT restored_flight_id FROM marked` : sql`WITH candidate AS MATERIALIZED (SELECT * FROM deleted_flights WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW()
 AND jsonb_typeof(flight_data)='object'
 AND (flight_data ?& ARRAY['id','user_id','aircraft_make','aircraft_model','aircraft_variant'])
 AND NOT (
   COALESCE(NULLIF(TRIM(flight_data->>'aircraft_make'),''),NULLIF(TRIM(flight_data->>'aircraft_model'),''),NULLIF(TRIM(flight_data->>'aircraft_variant'),'')) IS NULL
   AND (
     NULLIF(TRIM(COALESCE(flight_data->>'aircraft_type','')),'') IS NOT NULL
     OR EXISTS (SELECT 1 FROM aircraft a WHERE a.user_id=deleted_flights.user_id
       AND UPPER(TRIM(a.registration))=UPPER(TRIM(flight_data->>'registration'))
       AND (NULLIF(TRIM(a.aircraft_make),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_model),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_variant),'') IS NOT NULL))
   )
 )
 AND flight_data->>'id'=original_flight_id::text
 AND flight_data->>'user_id'=user_id::text
 AND flight_data->>'certified_at' IS NULL
 AND flight_data->>'locked_at' IS NULL
 AND COALESCE(flight_data->>'record_revision','1')='1'
 AND COALESCE(flight_data->>'correction_reason','')=''
 AND NOT EXISTS(SELECT 1 FROM flight_certified_revisions r
   WHERE r.user_id=deleted_flights.user_id AND r.flight_id=deleted_flights.original_flight_id)
 AND CASE WHEN jsonb_typeof(tracks_data)='array'
   THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tracks_data) AS t(value)
     WHERE jsonb_typeof(t.value)<>'object'
       OR NOT (t.value ?& ARRAY['id','user_id','flight_id'])
       OR t.value->>'user_id' IS DISTINCT FROM user_id::text
       OR t.value->>'flight_id' IS DISTINCT FROM original_flight_id::text)
   ELSE FALSE END
 AND jsonb_typeof(tracks_data)='array'
 AND CASE WHEN jsonb_typeof(expenses_data)='array'
   THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expenses_data) AS e(value)
     WHERE jsonb_typeof(e.value)<>'object'
       OR NOT (e.value ?& ARRAY['id','user_id','flight_id','category','label','created_at'])
       OR e.value->>'user_id' IS DISTINCT FROM user_id::text
       OR e.value->>'flight_id' IS DISTINCT FROM original_flight_id::text
       OR e.value->>'category' IS NULL
       OR e.value->>'label' IS NULL
       OR e.value->>'created_at' IS NULL
       OR e.value->>'amount_encoding' IS NOT NULL OR e.value->>'amount_minor_units' IS NOT NULL
       OR COALESCE(e.value->>'currency','') !~ '^[A-Z]{3}$'
       OR CASE WHEN COALESCE(e.value->>'amount_minor','') ~ '^[1-9][0-9]*$'
          THEN (e.value->>'amount_minor')::numeric > 1000000000
          ELSE TRUE END)
   ELSE FALSE END
 AND flight_data->>'price_currency_code' IS NULL
  AND flight_data->>'price_currency_minor_units' IS NULL
  AND flight_data->>'price_per_hour_decimal' IS NULL
 LIMIT 1 FOR UPDATE OF deleted_flights),restored_flight AS (INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,regulatory_category,balloon_class,balloon_group,balloon_operation,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,price_per_hour,billing_basis,note,locked_at,locked_by_user_id,operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,verification_name,verification_reference) SELECT ${userId},NULLIF(flight_data->>'date','')::date,COALESCE(flight_data->>'evidence',''),COALESCE(flight_data->>'registration',''),COALESCE(flight_data->>'aircraft_type',''),flight_data->>'aircraft_make',flight_data->>'aircraft_model',flight_data->>'aircraft_variant',COALESCE(flight_data->>'aircraft_class',''),COALESCE(flight_data->>'regulatory_category',''),COALESCE(flight_data->>'balloon_class',''),COALESCE(flight_data->>'balloon_group',''),COALESCE(flight_data->>'balloon_operation',''),COALESCE(flight_data->>'launch_method',''),COALESCE(NULLIF(flight_data->>'launches','')::int,0),COALESCE(flight_data->>'departure',''),COALESCE(flight_data->>'arrival',''),COALESCE(flight_data->>'off_block',''),COALESCE(flight_data->>'takeoff',''),COALESCE(flight_data->>'landing',''),COALESCE(flight_data->>'on_block',''),COALESCE(NULLIF(flight_data->>'starts','')::int,0),COALESCE(flight_data->>'commander',''),COALESCE(flight_data->>'instructor',''),COALESCE(flight_data->>'role',''),COALESCE(flight_data->>'task',''),COALESCE(flight_data->>'purpose_code',''),NULLIF(flight_data->>'price_per_hour','')::numeric,COALESCE(flight_data->>'billing_basis','BLOCK'),COALESCE(flight_data->>'note',''),NULL,NULL,COALESCE(flight_data->>'operation_type','SP'),COALESCE(flight_data->>'engine_type','SE'),COALESCE(flight_data->>'operator_name',''),COALESCE(flight_data->>'flight_number',''),COALESCE(flight_data->>'operation_context',''),COALESCE(NULLIF(flight_data->>'landings_day','')::int,COALESCE(NULLIF(flight_data->>'starts','')::int,0)),COALESCE(NULLIF(flight_data->>'landings_night','')::int,0),COALESCE(NULLIF(flight_data->>'movement_evidence_recorded','')::boolean,FALSE),COALESCE(NULLIF(flight_data->>'takeoffs_day','')::int,0),COALESCE(NULLIF(flight_data->>'takeoffs_night','')::int,0),COALESCE(NULLIF(flight_data->>'approaches_day','')::int,0),COALESCE(NULLIF(flight_data->>'approaches_night','')::int,0),COALESCE(NULLIF(flight_data->>'night_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'ifr_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'pic_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'copilot_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'dual_minutes','')::int,0),COALESCE(NULLIF(flight_data->>'instructor_minutes','')::int,0),COALESCE(flight_data->>'verification_name',''),COALESCE(flight_data->>'verification_reference','') FROM candidate c WHERE NOT EXISTS(SELECT 1 FROM flights f WHERE f.user_id=${userId} AND f.date::text=c.flight_data->>'date' AND UPPER(TRIM(f.registration))=UPPER(TRIM(c.flight_data->>'registration')) AND COALESCE(f.off_block,'')=COALESCE(c.flight_data->>'off_block','') AND UPPER(TRIM(COALESCE(f.departure,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'departure',''))) AND UPPER(TRIM(COALESCE(f.arrival,'')))=UPPER(TRIM(COALESCE(c.flight_data->>'arrival','')))) RETURNING id),track_source AS MATERIALIZED (SELECT nextval(pg_get_serial_sequence('flight_tracks','id')) new_id,track FROM candidate c CROSS JOIN LATERAL jsonb_array_elements(c.tracks_data) track),restored_tracks AS (INSERT INTO flight_tracks(id,user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) SELECT s.new_id,${userId},f.id,s.track->>'file_name',(s.track->>'imported_at')::timestamptz,(s.track->>'point_count')::int,(s.track->>'distance_km')::numeric,NULLIF(s.track->>'start_utc','')::timestamptz,NULLIF(s.track->>'end_utc','')::timestamptz,NULLIF(s.track->>'min_alt_m','')::numeric,NULLIF(s.track->>'max_alt_m','')::numeric,s.track->>'coordinates_json',s.track->>'overview_coordinates_json',(s.track->>'overview_version')::int FROM track_source s CROSS JOIN restored_flight f RETURNING id),restored_expenses AS (INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,created_at) SELECT ${userId},f.id,e->>'category',e->>'label',(e->>'amount_minor')::bigint,e->>'currency',(e->>'created_at')::timestamptz FROM candidate c CROSS JOIN restored_flight f CROSS JOIN LATERAL jsonb_array_elements(c.expenses_data) e RETURNING id),marked AS (UPDATE deleted_flights SET restored_at=NOW(),restored_flight_id=(SELECT id FROM restored_flight) WHERE id=${trashId} AND user_id=${userId} AND EXISTS(SELECT 1 FROM restored_flight) RETURNING restored_flight_id) SELECT restored_flight_id FROM marked`;
const tx=await sql.transaction([
  sql`SELECT pg_advisory_xact_lock(hashtextextended(concat_ws('|',
    user_id::text,
    UPPER(TRIM(COALESCE(flight_data->>'date',''))),
    UPPER(TRIM(COALESCE(flight_data->>'registration',''))),
    UPPER(TRIM(COALESCE(flight_data->>'off_block',''))),
    UPPER(TRIM(COALESCE(flight_data->>'departure',''))),
    UPPER(TRIM(COALESCE(flight_data->>'arrival','')))
  ),0))
  FROM deleted_flights
  WHERE id=${trashId} AND user_id=${userId}
    AND restored_at IS NULL AND purge_after>NOW()`,
  restoreQuery],{isolationLevel:'ReadCommitted'});const rows=tx[1] as Array<{restored_flight_id:number|string}>;if(rows[0])return{flightId:Number(rows[0].restored_flight_id)};
const needsNewRestore=await sql`SELECT 1 FROM deleted_flights
 WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW()
 AND ((flight_data->>'price_currency_code' IS NOT NULL
    OR flight_data->>'price_currency_minor_units' IS NOT NULL
    OR flight_data->>'price_per_hour_decimal' IS NOT NULL)
   OR CASE WHEN jsonb_typeof(expenses_data)='array'
     THEN EXISTS(SELECT 1 FROM jsonb_array_elements(expenses_data) AS e(value)
       WHERE e.value->>'amount_encoding' IS NOT NULL OR e.value->>'amount_minor_units' IS NOT NULL)
     ELSE FALSE END)
 LIMIT 1`;
if(needsNewRestore[0])return{error:"This archived flight requires the newer monetary restore process."};
const invalidArchive=await sql`SELECT 1 FROM deleted_flights
 WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW()
 AND (jsonb_typeof(flight_data)<>'object'
   OR NOT (flight_data ?& ARRAY['id','user_id','aircraft_make','aircraft_model','aircraft_variant'])
   OR (
   COALESCE(NULLIF(TRIM(flight_data->>'aircraft_make'),''),NULLIF(TRIM(flight_data->>'aircraft_model'),''),NULLIF(TRIM(flight_data->>'aircraft_variant'),'')) IS NULL
   AND (
     NULLIF(TRIM(COALESCE(flight_data->>'aircraft_type','')),'') IS NOT NULL
     OR EXISTS (SELECT 1 FROM aircraft a WHERE a.user_id=deleted_flights.user_id
       AND UPPER(TRIM(a.registration))=UPPER(TRIM(flight_data->>'registration'))
       AND (NULLIF(TRIM(a.aircraft_make),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_model),'') IS NOT NULL
         OR NULLIF(TRIM(a.aircraft_variant),'') IS NOT NULL))
   )
 )
   OR flight_data->>'id' IS DISTINCT FROM original_flight_id::text
   OR flight_data->>'user_id' IS DISTINCT FROM user_id::text
   OR flight_data->>'certified_at' IS NOT NULL
   OR flight_data->>'locked_at' IS NOT NULL
   OR COALESCE(flight_data->>'record_revision','1')<>'1'
   OR COALESCE(flight_data->>'correction_reason','')<>''
   OR EXISTS(SELECT 1 FROM flight_certified_revisions r WHERE r.user_id=deleted_flights.user_id AND r.flight_id=deleted_flights.original_flight_id)
   OR CASE WHEN jsonb_typeof(tracks_data)='array'
      THEN EXISTS(SELECT 1 FROM jsonb_array_elements(tracks_data) AS t(value)
        WHERE jsonb_typeof(t.value)<>'object'
          OR NOT (t.value ?& ARRAY['id','user_id','flight_id'])
          OR t.value->>'user_id' IS DISTINCT FROM user_id::text
          OR t.value->>'flight_id' IS DISTINCT FROM original_flight_id::text)
      ELSE FALSE END
   OR jsonb_typeof(tracks_data)<>'array'
   OR jsonb_typeof(expenses_data)<>'array'
   OR CASE WHEN jsonb_typeof(expenses_data)='array'
      THEN EXISTS(SELECT 1 FROM jsonb_array_elements(expenses_data) AS e(value)
        WHERE jsonb_typeof(e.value)<>'object'
         OR NOT (e.value ?& ARRAY['id','user_id','flight_id','category','label','created_at'])
         OR e.value->>'user_id' IS DISTINCT FROM user_id::text
         OR e.value->>'flight_id' IS DISTINCT FROM original_flight_id::text
         OR e.value->>'category' IS NULL
         OR e.value->>'label' IS NULL
         OR e.value->>'created_at' IS NULL
         OR COALESCE(e.value->>'currency','') !~ '^[A-Z]{3}$'
         OR CASE WHEN COALESCE(e.value->>'amount_minor','') ~ '^[1-9][0-9]*$'
            THEN (e.value->>'amount_minor')::numeric > 1000000000
            ELSE TRUE END)
      ELSE FALSE END)
 LIMIT 1`;
if(invalidArchive[0])return{error:"Archived flight data needs review before it can be restored."};
const candidate=await sql`SELECT id FROM deleted_flights WHERE id=${trashId} AND user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() LIMIT 1`;return candidate[0]?{error:"This flight already exists in the logbook."}:{error:"Deleted flight was not found or has expired."}}