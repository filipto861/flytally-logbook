import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV165Schema } from "@/lib/v165-schema";
import { credentialValidity } from "@/lib/credential-validity";
import { flightMinutes } from "@/lib/recency-engine";
import { confirmedQualificationMatches,hasConfirmedQualificationStructure,qualificationLogicScope } from "@/lib/qualification-record";
import { evaluateLaunchMethod,evaluateSplPassenger,evaluateSplSailplane,evaluateSplTmg,type LaunchMethod,type SplFlight,type SplProficiencyEvidence } from "@/lib/spl-recency";

const t=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>t(value).toUpperCase();
const todayIso=()=>new Date().toISOString().slice(0,10);
const launchMethodFromQualification=(value:unknown):LaunchMethod|""=>{const text=upper(value).replace(/[_-]+/g," ");if(text.includes("WINCH"))return"WINCH";if(text.includes("AEROTOW")||text.includes("AERO TOW"))return"AEROTOW";if(text.includes("SELF")&&text.includes("LAUNCH"))return"SELF_LAUNCH";if(text.includes("CAR")&&text.includes("LAUNCH"))return"CAR";if(text.includes("BUNGEE"))return"BUNGEE";return""};
const privilegeType=(value:unknown)=>{const text=upper(value);if(text==="SAILPLANE"||text==="SAILPLANES"||text==="GLIDER")return"SAILPLANE";if(text==="TMG"||text.startsWith("TMG ")||text.startsWith("TMG("))return"TMG";return""};
const structuredPrivilege=(row:Record<string,unknown>)=>{if(!hasConfirmedQualificationStructure(row))return privilegeType(row.qualification_type);if(!confirmedQualificationMatches(row,"CLASS_TYPE","SAILPLANE","PILOT"))return"";return privilegeType(qualificationLogicScope(row))};
const launchFromRecord=(row:Record<string,unknown>)=>{if(hasConfirmedQualificationStructure(row)&&!confirmedQualificationMatches(row,"OPERATIONAL","SAILPLANE","PILOT"))return"";return launchMethodFromQualification(qualificationLogicScope(row))};

export type SplRecencyState={
  today:string;
  evaluations:ReturnType<typeof evaluateSplSailplane>[];
  launchEvaluations:ReturnType<typeof evaluateLaunchMethod>[];
  evidence:SplProficiencyEvidence[];
  hasSailplanePrivilege:boolean;
  hasTmgPrivilege:boolean;
  partFclTmgPrivilege:boolean;
  configuredLaunchMethods:LaunchMethod[];
};

export async function getSplRecencyStateForUser(userId:number):Promise<SplRecencyState|null>{
  await ensureDatabaseOptimizations();await Promise.all([ensureV162Schema(),ensureV165Schema()]);const today=todayIso();
  const[licences,qualifications,rows,evidenceRows]=await Promise.all([
    sql`SELECT id,licence_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_licences WHERE user_id=${userId} AND active=TRUE` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,licence_id,qualification_type,qualification_family,regulatory_category,qualification_scope,privilege_role,classification_source,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_qualifications WHERE user_id=${userId} AND active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training'` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT f.date::text date,f.regulatory_category,f.aircraft_class,f.role,f.off_block,f.on_block,f.takeoff,f.landing,f.launch_method,f.launches,f.landings_day,f.landings_night,f.takeoffs_day,f.takeoffs_night,f.purpose_code,
      EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.verification_role='INSTRUCTOR' AND v.status='signed') instructor_signed
      FROM flights f WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND UPPER(COALESCE(f.regulatory_category,''))='SAILPLANE' AND CASE WHEN f.date~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::date ELSE NULL END>=CURRENT_DATE-INTERVAL '2 years' ORDER BY f.date DESC,f.id DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,aircraft_context,evidence_date::text evidence_date,signer,reference,note FROM spl_recency_evidence WHERE user_id=${userId} ORDER BY evidence_date DESC,id DESC` as Promise<Array<Record<string,unknown>>>,
  ]);
  const splLicences=licences.filter(row=>upper(row.licence_type)==="SPL");if(!splLicences.length)return null;
  const splIds=new Set(splLicences.map(row=>Number(row.id))),licenceById=new Map(licences.map(row=>[Number(row.id),row])),splQualifications=qualifications.filter(row=>splIds.has(Number(row.licence_id)));
  const flights:SplFlight[]=rows.map(row=>({date:t(row.date).slice(0,10),regulatoryCategory:t(row.regulatory_category),aircraftClass:t(row.aircraft_class),role:t(row.role),minutes:flightMinutes(row.off_block,row.on_block),airMinutes:flightMinutes(row.takeoff,row.landing),launchMethod:t(row.launch_method),launches:Number(row.launches)||0,landingsDay:Number(row.landings_day)||0,landingsNight:Number(row.landings_night)||0,takeoffsDay:Number(row.takeoffs_day)||0,takeoffsNight:Number(row.takeoffs_night)||0,purposeCode:t(row.purpose_code),instructorSigned:Boolean(row.instructor_signed)}));
  const evidence:SplProficiencyEvidence[]=evidenceRows.map(row=>({id:Number(row.id),aircraftContext:upper(row.aircraft_context)==="TMG"?"TMG":"SAILPLANE",date:t(row.evidence_date).slice(0,10),signer:t(row.signer),reference:t(row.reference),note:t(row.note)}));
  const hasSailplanePrivilege=splQualifications.some(row=>structuredPrivilege(row)==="SAILPLANE")||flights.some(row=>upper(row.aircraftClass)!=="TMG"),hasTmgPrivilege=splQualifications.some(row=>structuredPrivilege(row)==="TMG")||flights.some(row=>upper(row.aircraftClass)==="TMG");
  const partFclTmgPrivilege=qualifications.some(row=>{const type=hasConfirmedQualificationStructure(row)?confirmedQualificationMatches(row,"CLASS_TYPE","AEROPLANE","PILOT")?privilegeType(qualificationLogicScope(row)):"":privilegeType(row.qualification_type);if(type!=="TMG")return false;const parent=licenceById.get(Number(row.licence_id)),licence=upper(parent?.licence_type);if(!["LAPL(A)","PPL(A)","CPL(A)","ATPL(A)"].includes(licence))return false;const state=credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until},today);return state.status!=="expired"&&state.status!=="incomplete"});
  const methodSet=new Set<LaunchMethod>();for(const row of splQualifications){const method=launchFromRecord(row);if(method)methodSet.add(method)}for(const flight of flights){const method=upper(flight.launchMethod) as LaunchMethod;if(["WINCH","AEROTOW","SELF_LAUNCH","CAR","BUNGEE"].includes(method))methodSet.add(method)}
  const configuredLaunchMethods=[...methodSet].sort(),evaluations=[] as ReturnType<typeof evaluateSplSailplane>[];
  if(hasSailplanePrivilege){evaluations.push(evaluateSplSailplane(flights,today,evidence));evaluations.push(evaluateSplPassenger(flights,today,"SAILPLANE"))}
  if(hasTmgPrivilege){evaluations.push(evaluateSplTmg(flights,today,evidence,partFclTmgPrivilege));evaluations.push(evaluateSplPassenger(flights,today,"TMG"));evaluations.push(evaluateSplPassenger(flights,today,"TMG",true))}
  const launchEvaluations=configuredLaunchMethods.map(method=>evaluateLaunchMethod(flights,today,method));
  return{today,evaluations,launchEvaluations,evidence,hasSailplanePrivilege,hasTmgPrivilege,partFclTmgPrivilege,configuredLaunchMethods};
}
