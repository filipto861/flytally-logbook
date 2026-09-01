"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { serializeBilling } from "@/lib/billing";
import { validIsoDate } from "@/lib/rate-history";
import { airportCodeMigrations,canonicalAirportIdent } from "@/lib/airport-catalog";
const s=(f:FormData,k:string)=>String(f.get(k)??"").trim(); const n=(f:FormData,k:string)=>{const v=Number(s(f,k));return Number.isFinite(v)?v:null};
function refreshPricing(){revalidatePath("/database");revalidatePath("/flights/new");revalidatePath("/flights");revalidatePath("/dashboard");revalidatePath("/print");}
export type AircraftSaveResult={ok:boolean;message:string};
async function persistAircraft(form:FormData):Promise<AircraftSaveResult>{
  const {userId}=await requireUser(),id=n(form,"id"),reg=s(form,"registration").toUpperCase(),billing=serializeBilling(s(form,"billing_basis"),s(form,"billing_share"));if(!reg)return{ok:false,message:"Aircraft registration is required."};
  const make=s(form,"aircraft_make"),model=s(form,"aircraft_model"),variant=s(form,"aircraft_variant"),displayType=s(form,"aircraft_type")||[model,variant].filter(Boolean).join(" "),evidence=s(form,"evidence").toUpperCase(),requestedClass=s(form,"aircraft_class").toUpperCase();
  if(!["ULL","EASA"].includes(evidence))return{ok:false,message:"Select a valid normal logbook."};
  const easaClasses=["SEP","TMG","MEP","SET","OTHER","GLIDER"],aircraftClass=evidence==="ULL"?"ULL":requestedClass;
  if(evidence==="EASA"&&(!make||!model))return{ok:false,message:"An EASA aircraft profile requires both manufacturer (Make) and aircraft type/model."};
  if(evidence==="EASA"&&!easaClasses.includes(aircraftClass))return{ok:false,message:"Select a valid EASA aircraft class."};
  const creditRaw=s(form,"part_fcl_credit_class").toUpperCase(),creditClass=["SEP","TMG"].includes(creditRaw)?creditRaw:"",creditBasis=s(form,"part_fcl_credit_basis").slice(0,300),creditFrom=s(form,"part_fcl_credit_from");
  if(creditClass&&(!creditBasis||!validIsoDate(creditFrom)))return{ok:false,message:"Part-FCL credit needs a basis/reference and a valid-from date."};
  if(id){
    await sql`UPDATE aircraft SET aircraft_type=${displayType},aircraft_make=${make},aircraft_model=${model},aircraft_variant=${variant},icao_type=${s(form,"icao_type")},aircraft_class=${aircraftClass},evidence=${evidence},default_role=${s(form,"default_role")||"PIC"},billing_basis=${billing},part_fcl_credit_class=${creditClass},part_fcl_credit_basis=${creditBasis},part_fcl_credit_from=${creditFrom},note=${s(form,"note")},updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND UPPER(TRIM(registration))=${reg}`;
  }else{
    const initialPrice=n(form,"initial_price_per_hour"),validFrom=s(form,"initial_valid_from"),queries=[sql`INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,part_fcl_credit_class,part_fcl_credit_basis,part_fcl_credit_from,note,created_at,updated_at) VALUES(${userId},${reg},${displayType},${make},${model},${variant},${s(form,"icao_type")},${aircraftClass},${evidence},${initialPrice},${s(form,"default_role")||"PIC"},${billing},1,${creditClass},${creditBasis},${creditFrom},${s(form,"note")},NOW(),NOW()) ON CONFLICT(user_id,registration) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,aircraft_make=EXCLUDED.aircraft_make,aircraft_model=EXCLUDED.aircraft_model,aircraft_variant=EXCLUDED.aircraft_variant,icao_type=EXCLUDED.icao_type,aircraft_class=EXCLUDED.aircraft_class,evidence=EXCLUDED.evidence,default_role=EXCLUDED.default_role,billing_basis=EXCLUDED.billing_basis,part_fcl_credit_class=EXCLUDED.part_fcl_credit_class,part_fcl_credit_basis=EXCLUDED.part_fcl_credit_basis,part_fcl_credit_from=EXCLUDED.part_fcl_credit_from,note=EXCLUDED.note,active=1,updated_at=NOW()`];
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
