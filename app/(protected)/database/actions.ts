"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { serializeOptionalBilling } from "@/lib/billing";
import { initialRateDateError,validIsoDate } from "@/lib/rate-history";
import { airportCodeMigrations,canonicalAirportIdent } from "@/lib/airport-catalog";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";
import { parseAircraftDefaultEngineType,parseAircraftDefaultOperationType,validateAircraftProfile } from "@/lib/aircraft-profile-validation";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";
const s=(f:FormData,k:string)=>String(f.get(k)??"").trim(); const n=(f:FormData,k:string)=>{const v=Number(s(f,k));return Number.isFinite(v)?v:null};
function refreshPricing(){revalidatePath("/database");revalidatePath("/flights/new");revalidatePath("/flights");revalidatePath("/dashboard");revalidatePath("/print");}
export type AircraftSaveResult={ok:boolean;message:string};
export type AircraftDeleteResult={ok:boolean;message:string};
async function persistAircraft(form:FormData):Promise<AircraftSaveResult>{
  const {userId}=await requireUser();await Promise.all([ensureDatabaseOptimizations(),ensureV162Schema(),ensureV164Schema()]);const id=n(form,"id"),reg=s(form,"registration").toUpperCase(),billingResult=serializeOptionalBilling(s(form,"billing_basis"),s(form,"billing_share"));if(billingResult.error)return{ok:false,message:billingResult.error};const billing=billingResult.value,operationDefault=parseAircraftDefaultOperationType(s(form,"default_operation_type"));if(operationDefault.error)return{ok:false,message:operationDefault.error};const engineDefault=parseAircraftDefaultEngineType(s(form,"default_engine_type"));if(engineDefault.error)return{ok:false,message:engineDefault.error};const defaultOperationType=operationDefault.value||null,defaultEngineType=engineDefault.value||null;if(!reg)return{ok:false,message:"Aircraft registration is required."};
  const make=s(form,"aircraft_make"),model=s(form,"aircraft_model"),variant=s(form,"aircraft_variant"),displayType=s(form,"aircraft_type")||[model,variant].filter(Boolean).join(" "),validated=validateAircraftProfile({
    aircraftMake:make,aircraftModel:model,evidence:s(form,"evidence"),aircraftClass:s(form,"aircraft_class"),regulatoryCategory:s(form,"regulatory_category"),
    balloonClass:s(form,"balloon_class"),balloonGroup:s(form,"balloon_group"),partFclCreditClass:s(form,"part_fcl_credit_class"),partFclCreditBasis:s(form,"part_fcl_credit_basis"),partFclCreditFrom:s(form,"part_fcl_credit_from"),
  });
  if(!validated.profile)return{ok:false,message:validated.error};
  const{evidence,aircraftClass,regulatoryCategory,balloonClass,balloonGroup,partFclCreditClass:creditClass,partFclCreditBasis:creditBasis,partFclCreditFrom:creditFrom}=validated.profile;
  if(id){
    await sql`UPDATE aircraft SET aircraft_type=${displayType},aircraft_make=${make},aircraft_model=${model},aircraft_variant=${variant},icao_type=${s(form,"icao_type")},aircraft_class=${aircraftClass},regulatory_category=${regulatoryCategory},balloon_class=${balloonClass},balloon_group=${balloonGroup},evidence=${evidence},default_role=${s(form,"default_role")||"PIC"},default_operation_type=${defaultOperationType},default_engine_type=${defaultEngineType},billing_basis=${billing},part_fcl_credit_class=${creditClass},part_fcl_credit_basis=${creditBasis},part_fcl_credit_from=${creditFrom},note=${s(form,"note")},updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND UPPER(TRIM(registration))=${reg}`;
  }else{
    const initialPrice=n(form,"initial_price_per_hour"),validFrom=s(form,"initial_valid_from"),initialRateError=initialRateDateError(initialPrice,validFrom);
    if(initialRateError)return{ok:false,message:initialRateError};
    const queries=[sql`INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,regulatory_category,balloon_class,balloon_group,evidence,default_price_per_hour,default_role,default_operation_type,default_engine_type,billing_basis,active,part_fcl_credit_class,part_fcl_credit_basis,part_fcl_credit_from,note,created_at,updated_at) VALUES(${userId},${reg},${displayType},${make},${model},${variant},${s(form,"icao_type")},${aircraftClass},${regulatoryCategory},${balloonClass},${balloonGroup},${evidence},${initialPrice},${s(form,"default_role")||"PIC"},${defaultOperationType},${defaultEngineType},${billing},1,${creditClass},${creditBasis},${creditFrom},${s(form,"note")},NOW(),NOW()) ON CONFLICT(user_id,registration) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,aircraft_make=EXCLUDED.aircraft_make,aircraft_model=EXCLUDED.aircraft_model,aircraft_variant=EXCLUDED.aircraft_variant,icao_type=EXCLUDED.icao_type,aircraft_class=EXCLUDED.aircraft_class,regulatory_category=EXCLUDED.regulatory_category,balloon_class=EXCLUDED.balloon_class,balloon_group=EXCLUDED.balloon_group,evidence=EXCLUDED.evidence,default_role=EXCLUDED.default_role,default_operation_type=EXCLUDED.default_operation_type,default_engine_type=EXCLUDED.default_engine_type,billing_basis=EXCLUDED.billing_basis,part_fcl_credit_class=EXCLUDED.part_fcl_credit_class,part_fcl_credit_basis=EXCLUDED.part_fcl_credit_basis,part_fcl_credit_from=EXCLUDED.part_fcl_credit_from,note=EXCLUDED.note,active=1,updated_at=NOW()`];
    if(initialPrice!==null&&initialPrice>0)queries.push(sql`INSERT INTO rates(user_id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source) VALUES(${userId},${reg},${displayType},${validFrom},${initialPrice},NULL,'Initial rate') ON CONFLICT(user_id,registration,valid_from) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,price_per_hour=EXCLUDED.price_per_hour,source=EXCLUDED.source`);
    await sql.transaction(queries);
  }
  const persisted=await sql`SELECT COALESCE(evidence,'') evidence,COALESCE(aircraft_class,'') aircraft_class,COALESCE(regulatory_category,'') regulatory_category,COALESCE(balloon_class,'') balloon_class,COALESCE(balloon_group,'') balloon_group,COALESCE(default_operation_type,'') default_operation_type,COALESCE(default_engine_type,'') default_engine_type FROM aircraft WHERE user_id=${userId} AND UPPER(TRIM(registration))=${reg} LIMIT 1` as Array<{evidence:string;aircraft_class:string;regulatory_category:string;balloon_class:string;balloon_group:string;default_operation_type:string;default_engine_type:string}>;
  const saved=persisted[0];
  if(!saved||saved.evidence.toUpperCase()!==evidence||saved.aircraft_class.toUpperCase()!==aircraftClass||saved.regulatory_category.toUpperCase()!==regulatoryCategory||saved.balloon_class.toUpperCase()!==balloonClass||saved.balloon_group.toUpperCase()!==balloonGroup||saved.default_operation_type.toUpperCase()!==(defaultOperationType||"")||saved.default_engine_type.toUpperCase()!==(defaultEngineType||"")){console.error("aircraft-profile-persistence-mismatch",{userId,reg,expected:{evidence,aircraftClass,regulatoryCategory,balloonClass,balloonGroup,defaultOperationType:defaultOperationType||"",defaultEngineType:defaultEngineType||""},saved});return{ok:false,message:"Aircraft profile could not be verified after save. Please try again."};}
  refreshPricing();
  return{ok:true,message:id?"Aircraft profile saved.":"Aircraft added."};
}
export async function saveAircraft(form:FormData){await persistAircraft(form);}
export async function saveAircraftWithResult(form:FormData){return persistAircraft(form);}
export async function toggleAircraft(form:FormData){const {userId}=await requireUser();await sql`UPDATE aircraft SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${n(form,"id")} AND user_id=${userId}`;revalidatePath("/database");revalidatePath("/flights/new");revalidatePath("/flights");}
export async function deleteAircraftWithResult(form:FormData):Promise<AircraftDeleteResult>{
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();const aircraftId=n(form,"id");
  if(!aircraftId)return{ok:false,message:"Aircraft could not be identified."};
  const rows=await sql`SELECT id,UPPER(TRIM(registration)) registration FROM aircraft WHERE id=${aircraftId} AND user_id=${userId} LIMIT 1` as Array<{id:number;registration:string}>,aircraft=rows[0];
  if(!aircraft)return{ok:false,message:"Aircraft not found."};
  const usage=await sql`SELECT COUNT(*)::int count FROM flights WHERE user_id=${userId} AND UPPER(TRIM(registration))=${aircraft.registration}` as Array<{count:number}>,flightCount=Number(usage[0]?.count||0);
  if(flightCount>0)return{ok:false,message:`This aircraft is used by ${flightCount} saved flight${flightCount===1?"":"s"}. Deactivate it instead so your logbook history stays intact.`};
  await sql.transaction([
    sql`DELETE FROM rates WHERE user_id=${userId} AND UPPER(TRIM(registration))=${aircraft.registration}`,
    sql`DELETE FROM aircraft WHERE id=${aircraftId} AND user_id=${userId}`,
  ]);
  refreshPricing();revalidatePath("/connections");
  return{ok:true,message:"Aircraft permanently deleted."};
}
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