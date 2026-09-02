import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV163Schema } from "@/lib/v163-schema";
import { credentialValidity } from "@/lib/credential-validity";
import { flightMinutes } from "@/lib/recency-engine";
import { evaluateHelicopterPassengerCurrency,evaluateLaplH,type HelicopterFlight,type HelicopterProficiencyEvidence } from "@/lib/helicopter-recency";

const t=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>t(value).toUpperCase();
const todayIso=()=>new Date().toISOString().slice(0,10);
const helicopterLicence=(value:unknown)=>["LAPL(H)","PPL(H)","CPL(H)","ATPL(H)"].includes(upper(value));
const currentCredential=(row:Record<string,unknown>,today:string)=>{const state=credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until},today);return state.status!=="expired"&&state.status!=="incomplete"};
const typeLabel=(model:unknown,type:unknown,registration:unknown)=>t(model)||t(type)||t(registration)||"Helicopter";

export type HelicopterRecencyState={
  today:string;
  hasLaplH:boolean;
  hasHelicopterLicence:boolean;
  hasNightPrivilege:boolean;
  hasIrH:boolean;
  helicopterTypes:string[];
  evaluations:ReturnType<typeof evaluateLaplH>[];
  passengerEvaluations:ReturnType<typeof evaluateHelicopterPassengerCurrency>[];
  evidence:HelicopterProficiencyEvidence[];
};

export async function getHelicopterRecencyStateForUser(userId:number):Promise<HelicopterRecencyState|null>{
  await ensureDatabaseOptimizations();await Promise.all([ensureV162Schema(),ensureV163Schema()]);const today=todayIso();
  const[licences,qualifications,aircraftRows,flightRows,evidenceRows]=await Promise.all([
    sql`SELECT id,licence_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_licences WHERE user_id=${userId} AND active=TRUE` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,licence_id,qualification_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_qualifications WHERE user_id=${userId} AND active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training'` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT registration,aircraft_type,aircraft_model FROM aircraft WHERE user_id=${userId} AND active=1 AND UPPER(COALESCE(regulatory_category,''))='HELICOPTER' ORDER BY registration` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT f.date::text date,f.registration,f.aircraft_type,f.regulatory_category,f.role,f.off_block,f.on_block,f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,f.landings_day,f.landings_night,f.purpose_code,
      COALESCE(NULLIF(a.aircraft_model,''),NULLIF(f.aircraft_type,''),f.registration) helicopter_type,
      EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.verification_role='INSTRUCTOR' AND v.status='signed') instructor_signed
      FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration))
      WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND UPPER(COALESCE(f.regulatory_category,''))='HELICOPTER' AND CASE WHEN f.date~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::date ELSE NULL END>=CURRENT_DATE-INTERVAL '1 year' ORDER BY f.date DESC,f.id DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,helicopter_type,evidence_date::text evidence_date,signer,reference,note FROM helicopter_recency_evidence WHERE user_id=${userId} ORDER BY evidence_date DESC,id DESC` as Promise<Array<Record<string,unknown>>>,
  ]);
  const activeLicences=licences.filter(row=>helicopterLicence(row.licence_type));if(!activeLicences.length&&!aircraftRows.length&&!flightRows.length)return null;
  const hasHelicopterLicence=activeLicences.length>0,hasLaplH=activeLicences.some(row=>upper(row.licence_type)==="LAPL(H)"),hasIrH=qualifications.some(row=>/^IR\s*\(H\)$/i.test(t(row.qualification_type))&&currentCredential(row,today)),hasNightPrivilege=hasIrH||qualifications.some(row=>upper(row.qualification_type).includes("NIGHT")&&upper(row.qualification_type).includes("H")&&currentCredential(row,today));
  const flights:HelicopterFlight[]=flightRows.map(row=>({date:t(row.date).slice(0,10),helicopterType:t(row.helicopter_type),regulatoryCategory:t(row.regulatory_category),role:t(row.role),minutes:flightMinutes(row.off_block,row.on_block),movementEvidenceRecorded:Boolean(row.movement_evidence_recorded),takeoffsDay:Number(row.takeoffs_day)||0,takeoffsNight:Number(row.takeoffs_night)||0,approachesDay:Number(row.approaches_day)||0,approachesNight:Number(row.approaches_night)||0,landingsDay:Number(row.landings_day)||0,landingsNight:Number(row.landings_night)||0,purposeCode:t(row.purpose_code),instructorSigned:Boolean(row.instructor_signed)}));
  const evidence:HelicopterProficiencyEvidence[]=evidenceRows.map(row=>({id:Number(row.id),helicopterType:t(row.helicopter_type),date:t(row.evidence_date).slice(0,10),signer:t(row.signer),reference:t(row.reference),note:t(row.note)}));
  const types=new Map<string,string>();for(const row of aircraftRows){const label=typeLabel(row.aircraft_model,row.aircraft_type,row.registration),key=upper(label);if(key)types.set(key,label)}for(const flight of flights){const key=upper(flight.helicopterType);if(key&&!types.has(key))types.set(key,flight.helicopterType)}for(const item of evidence){const key=upper(item.helicopterType);if(key&&!types.has(key))types.set(key,item.helicopterType)}
  const helicopterTypes=[...types.values()].sort((a,b)=>a.localeCompare(b)),evaluations=hasLaplH?helicopterTypes.map(type=>evaluateLaplH(flights,today,type,evidence)):[],passengerEvaluations=hasHelicopterLicence?helicopterTypes.flatMap(type=>[evaluateHelicopterPassengerCurrency(flights,today,type),...(hasNightPrivilege?[evaluateHelicopterPassengerCurrency(flights,today,type,true,hasIrH)]:[])]):[];
  return{today,hasLaplH,hasHelicopterLicence,hasNightPrivilege,hasIrH,helicopterTypes,evaluations,passengerEvaluations,evidence};
}
