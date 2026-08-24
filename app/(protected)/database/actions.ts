"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { serializeBilling } from "@/lib/billing";
import { validIsoDate } from "@/lib/rate-history";
import { airportCodeMigrations,canonicalAirportIdent } from "@/lib/airport-catalog";
import { createStoredBackup } from "@/lib/backup-center";
import { blockingComplianceIssues,fcl050FlightCompliance } from "@/lib/fcl050-compliance";
import { flightCertificationHash,verifyFlightCertification } from "@/lib/certification-integrity";
const s=(f:FormData,k:string)=>String(f.get(k)??"").trim(); const n=(f:FormData,k:string)=>{const v=Number(s(f,k));return Number.isFinite(v)?v:null};
function refreshPricing(){revalidatePath("/database");revalidatePath("/flights/new");revalidatePath("/flights");revalidatePath("/dashboard");revalidatePath("/print");}
export type AircraftSaveResult={ok:boolean;message:string};
async function persistAircraft(form:FormData):Promise<AircraftSaveResult>{
  const {userId}=await requireUser(),id=n(form,"id"),reg=s(form,"registration").toUpperCase(),billing=serializeBilling(s(form,"billing_basis"),s(form,"billing_share"));if(!reg)return{ok:false,message:"Aircraft registration is required."};
  const make=s(form,"aircraft_make"),model=s(form,"aircraft_model"),variant=s(form,"aircraft_variant"),displayType=s(form,"aircraft_type")||[model,variant].filter(Boolean).join(" ");
  if(id){
    await sql`UPDATE aircraft SET aircraft_type=${displayType},aircraft_make=${make},aircraft_model=${model},aircraft_variant=${variant},icao_type=${s(form,"icao_type")},aircraft_class=${s(form,"aircraft_class")},evidence=${s(form,"evidence")},default_role=${s(form,"default_role")||"PIC"},billing_basis=${billing},note=${s(form,"note")},updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND UPPER(TRIM(registration))=${reg}`;
  }else{
    const initialPrice=n(form,"initial_price_per_hour"),validFrom=s(form,"initial_valid_from"),queries=[sql`INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,note,created_at,updated_at) VALUES(${userId},${reg},${displayType},${make},${model},${variant},${s(form,"icao_type")},${s(form,"aircraft_class")},${s(form,"evidence")},${initialPrice},${s(form,"default_role")||"PIC"},${billing},1,${s(form,"note")},NOW(),NOW()) ON CONFLICT(user_id,registration) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,aircraft_make=EXCLUDED.aircraft_make,aircraft_model=EXCLUDED.aircraft_model,aircraft_variant=EXCLUDED.aircraft_variant,icao_type=EXCLUDED.icao_type,aircraft_class=EXCLUDED.aircraft_class,evidence=EXCLUDED.evidence,default_role=EXCLUDED.default_role,billing_basis=EXCLUDED.billing_basis,note=EXCLUDED.note,active=1,updated_at=NOW()`];
    if(initialPrice!==null&&initialPrice>0&&validIsoDate(validFrom))queries.push(sql`INSERT INTO rates(user_id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source) VALUES(${userId},${reg},${displayType},${validFrom},${initialPrice},NULL,'Initial rate') ON CONFLICT(user_id,registration,valid_from) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,price_per_hour=EXCLUDED.price_per_hour,source=EXCLUDED.source`);
    await sql.transaction(queries);
  }
  refreshPricing();
  return{ok:true,message:id?"Aircraft profile saved.":"Aircraft added."};
}
export async function saveAircraft(form:FormData){await persistAircraft(form);}
export async function saveAircraftWithResult(form:FormData){return persistAircraft(form);}
export async function toggleAircraft(form:FormData){const {userId}=await requireUser();await sql`UPDATE aircraft SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${n(form,"id")} AND user_id=${userId}`;revalidatePath("/database");revalidatePath("/flights/new");revalidatePath("/flights");}
export async function saveRate(form:FormData){const {userId}=await requireUser();const reg=s(form,"registration").toUpperCase(),valid=s(form,"valid_from"),price=n(form,"price_per_hour");if(!reg||!validIsoDate(valid)||price===null||price<=0)return;await sql`INSERT INTO rates(user_id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source) VALUES(${userId},${reg},${s(form,"aircraft_type")},${valid},${price},${n(form,"dry_price_per_hour")},${s(form,"source")||"Aircraft rate change"}) ON CONFLICT(user_id,registration,valid_from) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,price_per_hour=EXCLUDED.price_per_hour,dry_price_per_hour=EXCLUDED.dry_price_per_hour,source=EXCLUDED.source`;refreshPricing();}
export async function deleteRate(form:FormData){const {userId}=await requireUser();await sql`DELETE FROM rates WHERE id=${n(form,"id")} AND user_id=${userId}`;refreshPricing();}
export async function saveAirport(form:FormData){const {userId}=await requireUser();const ident=canonicalAirportIdent(s(form,"ident"));if(!ident)return;await sql`INSERT INTO airports(user_id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,active,closed,source,updated_at) VALUES(${userId},${ident},${s(form,"name")},${s(form,"municipality")},${s(form,"iso_country").toUpperCase()},${n(form,"latitude_deg")},${n(form,"longitude_deg")},1,0,'Manual',NOW()) ON CONFLICT(user_id,ident) DO UPDATE SET name=EXCLUDED.name,municipality=EXCLUDED.municipality,iso_country=EXCLUDED.iso_country,latitude_deg=EXCLUDED.latitude_deg,longitude_deg=EXCLUDED.longitude_deg,active=1,updated_at=NOW()`;revalidatePath("/database");}
export async function toggleAirport(form:FormData){const {userId}=await requireUser();await sql`UPDATE airports SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${n(form,"id")} AND user_id=${userId}`;revalidatePath("/database");}

const AIRCRAFT_SYNC_REASON="Aircraft profile metadata synchronization";
const certifiedProfileMismatchSql=(userId:number)=>sql`
  SELECT f.*,u.display_name pilot_name,
    a.aircraft_type profile_type,a.aircraft_make profile_make,a.aircraft_model profile_model,a.aircraft_variant profile_variant,a.aircraft_class profile_class,a.evidence profile_evidence
  FROM flights f
  JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))
  JOIN users u ON u.id=f.user_id
  WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND (
    (NULLIF(TRIM(a.evidence),'') IS NOT NULL AND UPPER(COALESCE(TRIM(f.evidence),''))<>UPPER(TRIM(a.evidence))) OR
    (NULLIF(TRIM(a.aircraft_type),'') IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_type),''))<>LOWER(TRIM(a.aircraft_type))) OR
    (NULLIF(TRIM(a.aircraft_make),'') IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_make),''))<>LOWER(TRIM(a.aircraft_make))) OR
    (COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),'')) IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_model),''))<>LOWER(COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),'')))) OR
    LOWER(COALESCE(TRIM(f.aircraft_variant),''))<>LOWER(COALESCE(TRIM(a.aircraft_variant),'')) OR
    (NULLIF(TRIM(a.aircraft_class),'') IS NOT NULL AND UPPER(COALESCE(TRIM(f.aircraft_class),''))<>UPPER(TRIM(a.aircraft_class)))
  ) ORDER BY f.id`;

export async function applySafeProfileRepairs(form:FormData){
  const {userId}=await requireUser();if(s(form,"confirm")!=="sync-aircraft-profiles")return;
  await createStoredBackup(userId,"manual");

  const updated=await sql`UPDATE flights f SET
    evidence=COALESCE(NULLIF(TRIM(a.evidence),''),f.evidence),
    aircraft_type=COALESCE(NULLIF(TRIM(a.aircraft_type),''),f.aircraft_type),
    aircraft_make=COALESCE(NULLIF(TRIM(a.aircraft_make),''),f.aircraft_make),
    aircraft_model=COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),''),f.aircraft_model),
    aircraft_variant=COALESCE(a.aircraft_variant,''),
    aircraft_class=COALESCE(NULLIF(TRIM(a.aircraft_class),''),f.aircraft_class),
    role=COALESCE(NULLIF(TRIM(f.role),''),NULLIF(TRIM(a.default_role),''),'PIC'),
    price_per_hour=COALESCE(f.price_per_hour,(SELECT r.price_per_hour FROM rates r WHERE r.user_id=f.user_id AND UPPER(TRIM(r.registration))=UPPER(TRIM(f.registration)) AND (r.valid_from IS NULL OR r.valid_from='' OR r.valid_from<=f.date) ORDER BY r.valid_from DESC NULLS LAST,r.id DESC LIMIT 1),a.default_price_per_hour)
    FROM aircraft a
    WHERE f.user_id=${userId} AND f.locked_at IS NULL AND f.certified_at IS NULL AND a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration)) AND (
      (NULLIF(TRIM(a.evidence),'') IS NOT NULL AND UPPER(COALESCE(TRIM(f.evidence),''))<>UPPER(TRIM(a.evidence))) OR
      (NULLIF(TRIM(a.aircraft_type),'') IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_type),''))<>LOWER(TRIM(a.aircraft_type))) OR
      (NULLIF(TRIM(a.aircraft_make),'') IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_make),''))<>LOWER(TRIM(a.aircraft_make))) OR
      (COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),'')) IS NOT NULL AND LOWER(COALESCE(TRIM(f.aircraft_model),''))<>LOWER(COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),'')))) OR
      LOWER(COALESCE(TRIM(f.aircraft_variant),''))<>LOWER(COALESCE(TRIM(a.aircraft_variant),'')) OR
      (NULLIF(TRIM(a.aircraft_class),'') IS NOT NULL AND UPPER(COALESCE(TRIM(f.aircraft_class),''))<>UPPER(TRIM(a.aircraft_class))) OR
      NULLIF(TRIM(f.role),'') IS NULL OR f.price_per_hour IS NULL OR f.price_per_hour<=0
    ) RETURNING f.id` as Array<{id:number|string}>;

  const certified=await certifiedProfileMismatchSql(userId) as Array<Record<string,unknown>>;
  let revised=0,recertified=0,pendingReview=0,integritySkipped=0,failed=0;
  for(const row of certified){
    if(verifyFlightCertification(row,userId).status!=="verified"){integritySkipped++;continue;}
    const id=Number(row.id);if(!Number.isSafeInteger(id)||id<=0){failed++;continue;}
    try{
      await sql.transaction([
        sql`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_at,superseded_by_user_id,correction_reason)
          SELECT f.id,f.user_id,COALESCE(f.record_revision,1),to_jsonb(f),COALESCE(f.certification_hash,''),COALESCE(f.certification_version,1),f.certified_at,f.certified_by_user_id,NOW(),${userId},${AIRCRAFT_SYNC_REASON}
          FROM flights f WHERE f.id=${id} AND f.user_id=${userId} AND f.certified_at IS NOT NULL
          ON CONFLICT(user_id,flight_id,revision_number) DO NOTHING`,
        sql`UPDATE flights SET record_revision=COALESCE(record_revision,1)+1,correction_reason=${AIRCRAFT_SYNC_REASON},correction_opened_at=NOW(),correction_opened_by_user_id=${userId},certified_at=NULL,certified_by_user_id=NULL,certification_hash='',locked_at=NULL,locked_by_user_id=NULL
          WHERE id=${id} AND user_id=${userId} AND certified_at IS NOT NULL`,
        sql`UPDATE flights f SET
          evidence=COALESCE(NULLIF(TRIM(a.evidence),''),f.evidence),
          aircraft_type=COALESCE(NULLIF(TRIM(a.aircraft_type),''),f.aircraft_type),
          aircraft_make=COALESCE(NULLIF(TRIM(a.aircraft_make),''),f.aircraft_make),
          aircraft_model=COALESCE(NULLIF(TRIM(a.aircraft_model),''),NULLIF(TRIM(a.aircraft_type),''),f.aircraft_model),
          aircraft_variant=COALESCE(a.aircraft_variant,''),
          aircraft_class=COALESCE(NULLIF(TRIM(a.aircraft_class),''),f.aircraft_class)
          FROM aircraft a WHERE f.id=${id} AND f.user_id=${userId} AND f.certified_at IS NULL AND f.locked_at IS NULL AND a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))`,
      ]);
      revised++;
      const afterRows=await sql`SELECT f.*,u.display_name pilot_name FROM flights f JOIN users u ON u.id=f.user_id WHERE f.id=${id} AND f.user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
      const after=afterRows[0];if(!after){failed++;continue;}
      const blockers=blockingComplianceIssues(fcl050FlightCompliance(after,String(after.pilot_name??"")));
      if(blockers.length){pendingReview++;continue;}
      const hash=flightCertificationHash({...after,certification_version:2},userId,2);
      const locked=await sql`UPDATE flights SET certified_at=NOW(),certified_by_user_id=${userId},certification_hash=${hash},certification_version=2,locked_at=NOW(),locked_by_user_id=${userId}
        WHERE id=${id} AND user_id=${userId} AND certified_at IS NULL AND locked_at IS NULL RETURNING id` as Array<{id:number|string}>;
      if(locked[0])recertified++;else pendingReview++;
    }catch(error){failed++;console.error("certified-aircraft-profile-sync-failed",{userId,id,error});}
  }

  console.info("aircraft-profile-flight-sync",{userId,draftUpdated:updated.length,certifiedFound:certified.length,revised,recertified,pendingReview,integritySkipped,failed});
  revalidatePath("/database");revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/flights/new");revalidatePath("/print");revalidatePath("/data");
}

export async function canonicalizeFlightAirportCodes(form:FormData){
  const {userId}=await requireUser();if(s(form,"confirm")!=="canonicalize-airports")return;
  const rows=await sql`SELECT code FROM (
    SELECT DISTINCT UPPER(TRIM(departure)) code FROM flights WHERE user_id=${userId} AND UPPER(TRIM(COALESCE(departure,''))) ~ '^CZ-[0-9]{4}$'
    UNION SELECT DISTINCT UPPER(TRIM(arrival)) code FROM flights WHERE user_id=${userId} AND UPPER(TRIM(COALESCE(arrival,''))) ~ '^CZ-[0-9]{4}$'
  ) codes ORDER BY code` as Array<{code:string}>;
  const migrations=airportCodeMigrations(rows.map(row=>String(row.code)));if(!migrations.length)return;
  const queries=migrations.flatMap(item=>[
    sql`UPDATE flights SET departure=CASE WHEN UPPER(TRIM(COALESCE(departure,'')))=${item.from} THEN ${item.to} ELSE departure END,arrival=CASE WHEN UPPER(TRIM(COALESCE(arrival,'')))=${item.from} THEN ${item.to} ELSE arrival END WHERE user_id=${userId} AND locked_at IS NULL AND certified_at IS NULL AND (UPPER(TRIM(COALESCE(departure,'')))=${item.from} OR UPPER(TRIM(COALESCE(arrival,'')))=${item.from})`,
    sql`UPDATE user_settings SET home_airport=${item.to} WHERE user_id=${userId} AND UPPER(TRIM(COALESCE(home_airport,'')))=${item.from}`,
  ]);
  await sql.transaction(queries);console.info("canonical-airport-codes",{userId,migrations:migrations.length});
  revalidatePath("/database");revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/flights/new");revalidatePath("/map");revalidatePath("/print");revalidatePath("/data");revalidatePath("/export");
}
