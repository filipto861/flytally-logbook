"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { LAUNCH_METHODS,normalizeFlightDraft,parseFlightInput,type FlightInput } from "@/lib/flight-input";
import { gpsFlightCandidate } from "@/lib/flight-draft-candidate";
import { airportCandidateScore,flightEnvelope,hasAirborneMovement,landingCount,localParts,overview,parseTrackFile,splitPoints,trackEndpointCandidates,trackStats } from "@/lib/kml";
import { airportCatalogSize,canonicalAirportIdent,nearestCatalogAirports } from "@/lib/airport-catalog";
import { selectAutomaticAirport } from "@/lib/airport-selection";
import { splitTrackFileName } from "@/lib/track-file-name";
import { serializeOptionalBilling } from "@/lib/billing";
import { shouldResolveStoredPrice } from "@/lib/rate-history";
import { flightFingerprint } from "@/lib/flight-dedup";
import { flightDateKey,flightMinutes } from "@/lib/dashboard-math";
import { allocatedFunctionTimes } from "@/lib/easa-logbook";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { moveFlightToTrash } from "@/lib/flight-trash";
import { createStoredBackup } from "@/lib/backup-center";
import { parseFlightExpenses } from "@/lib/flight-expenses";
import { ensureV159Schema } from "@/lib/v159-schema";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";
import { ensureV166Schema } from "@/lib/v166-schema";
import { gpsImportSourceRequirements,resolveGpsImportCommonRoleCrew,resolveGpsImportOperationEngine,resolveGpsImportPartRoleCrew,validateGpsImportPartEnvelopeKeys } from "@/lib/gps-import-integrity";
import { authorizeProfileFlightContext,authorizeUnchangedSnapshotFlightContext,resolveFlightAircraftContextAuthority,type FlightAircraftAuthorityProfileInput,type FlightAircraftContextSnapshot,type FlightAircraftContextSnapshotInput } from "@/lib/flight-aircraft-context-authority";
import { resolveSafetyPilotPic,resolveSafetyPilotPicForSave } from "@/lib/flight-connected-crew";

export type FlightActionState = { error?: string; success?: string };

type AircraftAuthorityRow=FlightAircraftAuthorityProfileInput&{
  aircraft_type:string;
  aircraft_make:string;
  aircraft_model:string;
  evidence:string;
  aircraft_class:string;
  regulatory_category:string;
  balloon_class:string;
  balloon_group:string;
  part_fcl_credit_class:string;
  part_fcl_credit_basis:string;
  part_fcl_credit_from:string;
};

type StoredFlightAircraftContextRow={
  registration:string;
  evidence:string;
  aircraft_type:string;
  aircraft_class:string;
  regulatory_category:string;
  balloon_class:string;
  balloon_group:string;
};

const flightAircraftContextFromInput=(f:FlightInput):FlightAircraftContextSnapshot=>({
  evidence:f.evidence,
  aircraftClass:f.aircraftClass,
  regulatoryCategory:f.regulatoryCategory,
  balloonClass:f.balloonClass,
  balloonGroup:f.balloonGroup,
  aircraftType:f.aircraftType,
});

const flightAircraftContextFromForm=(form:FormData):FlightAircraftContextSnapshotInput=>({
  evidence:form.get("evidence"),
  aircraftClass:form.get("aircraftClass"),
  regulatoryCategory:form.get("regulatoryCategory"),
  balloonClass:form.get("balloonClass"),
  balloonGroup:form.get("balloonGroup"),
  aircraftType:form.get("aircraftType"),
});

const storedFlightAircraftContext=(row:StoredFlightAircraftContextRow):FlightAircraftContextSnapshotInput=>({
  evidence:row.evidence,
  aircraftClass:row.aircraft_class,
  regulatoryCategory:row.regulatory_category,
  balloonClass:row.balloon_class,
  balloonGroup:row.balloon_group,
  aircraftType:row.aircraft_type,
});

async function aircraftAuthorityProfile(userId:number,registration:string,activeOnly:boolean){
  const rows=activeOnly
    ?await sql`SELECT COALESCE(aircraft_type,'') aircraft_type,COALESCE(aircraft_make,'') aircraft_make,COALESCE(aircraft_model,'') aircraft_model,COALESCE(evidence,'') evidence,COALESCE(aircraft_class,'') aircraft_class,COALESCE(regulatory_category,'') regulatory_category,COALESCE(balloon_class,'') balloon_class,COALESCE(balloon_group,'') balloon_group,COALESCE(part_fcl_credit_class,'') part_fcl_credit_class,COALESCE(part_fcl_credit_basis,'') part_fcl_credit_basis,COALESCE(part_fcl_credit_from,'') part_fcl_credit_from FROM aircraft WHERE user_id=${userId} AND UPPER(TRIM(registration))=${registration} AND active=1 LIMIT 1` as AircraftAuthorityRow[]
    :await sql`SELECT COALESCE(aircraft_type,'') aircraft_type,COALESCE(aircraft_make,'') aircraft_make,COALESCE(aircraft_model,'') aircraft_model,COALESCE(evidence,'') evidence,COALESCE(aircraft_class,'') aircraft_class,COALESCE(regulatory_category,'') regulatory_category,COALESCE(balloon_class,'') balloon_class,COALESCE(balloon_group,'') balloon_group,COALESCE(part_fcl_credit_class,'') part_fcl_credit_class,COALESCE(part_fcl_credit_basis,'') part_fcl_credit_basis,COALESCE(part_fcl_credit_from,'') part_fcl_credit_from FROM aircraft WHERE user_id=${userId} AND UPPER(TRIM(registration))=${registration} LIMIT 1` as AircraftAuthorityRow[];
  return rows[0]??null;
}
async function resolvedPrice(userId:number,registration:string,date:string){const rows=await sql`SELECT COALESCE(r.price_per_hour,a.default_price_per_hour) AS price_per_hour FROM aircraft a LEFT JOIN LATERAL (SELECT price_per_hour FROM rates WHERE user_id=${userId} AND UPPER(TRIM(registration))=UPPER(TRIM(${registration})) AND (valid_from IS NULL OR valid_from='' OR valid_from<=${date}) ORDER BY valid_from DESC NULLS LAST,id DESC LIMIT 1) r ON TRUE WHERE a.user_id=${userId} AND UPPER(a.registration)=${registration} LIMIT 1` as Array<{price_per_hour:number|null}>;return rows[0]?.price_per_hour??null}
export type AirportCandidate={ident:string;name:string;distanceKm:number;confidence:"high"|"medium"|"low"|"manual";source:"custom"|"catalogue"};export type AirportDetection=AirportCandidate|null;export type AirportDetectionRequest={departureCandidates:Array<{lat:number;lon:number}>;arrivalCandidates:Array<{lat:number;lon:number}>};export type AirportDetectionResult={parts:Array<{departure:AirportDetection;arrival:AirportDetection;departureCandidates:AirportCandidate[];arrivalCandidates:AirportCandidate[]}>;airportCount:number};const AUTO_AIRPORT_RADIUS_KM=4,AIRPORT_CANDIDATE_RADIUS_KM=20;
const airportConfidence=(distanceKm:number):AirportCandidate["confidence"]=>distanceKm<=1.5?"high":distanceKm<=4?"medium":distanceKm<=8?"low":"manual";
async function airportSuggestions(userId:number,candidates:Array<{lat:number;lon:number}>):Promise<Array<AirportCandidate&{score:number}>>{const valid=candidates.filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180).slice(0,20);if(!valid.length)return[];const minLat=Math.min(...valid.map(point=>point.lat))-.65,maxLat=Math.max(...valid.map(point=>point.lat))+.65,minLon=Math.min(...valid.map(point=>point.lon))-1,maxLon=Math.max(...valid.map(point=>point.lon))+1;const rows=await sql`SELECT ident,COALESCE(name,'') name,latitude_deg,longitude_deg,user_id,COALESCE(source,'') source FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND latitude_deg BETWEEN ${minLat} AND ${maxLat} AND longitude_deg BETWEEN ${minLon} AND ${maxLon} AND (user_id=${userId} OR LOWER(COALESCE(source,'')) LIKE 'ourairports%') LIMIT 2500` as Array<{ident:string;name:string;latitude_deg:number;longitude_deg:number;user_id:number;source:string}>;const ranked=new Map<string,AirportCandidate&{score:number}>(),add=(item:AirportCandidate&{score:number})=>{const previous=ranked.get(item.ident);if(!previous||item.source==="custom"&&previous.source!=="custom"||item.source===previous.source&&item.score<previous.score)ranked.set(item.ident,item)};for(const row of rows){const lat=Number(row.latitude_deg),lon=Number(row.longitude_deg);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;const value=airportCandidateScore(valid,{lat,lon});if(value.distanceKm>AIRPORT_CANDIDATE_RADIUS_KM)continue;const distanceKm=Math.round(value.distanceKm*10)/10;add({ident:canonicalAirportIdent(String(row.ident||"")),name:String(row.name||""),distanceKm,score:value.score,confidence:airportConfidence(distanceKm),source:Number(row.user_id)===userId?"custom":"catalogue"})}for(const airport of nearestCatalogAirports(valid,AIRPORT_CANDIDATE_RADIUS_KM,12))add({ident:airport.ident,name:airport.name,distanceKm:airport.distanceKm,score:airport.score,confidence:airportConfidence(airport.distanceKm),source:"catalogue"});return[...ranked.values()].filter(item=>Boolean(item.ident)).sort((a,b)=>a.score-b.score||a.distanceKm-b.distanceKm||a.ident.localeCompare(b.ident)).slice(0,3)}
function automaticAirport(candidates:Array<AirportCandidate&{score:number}>):AirportDetection{const best=selectAutomaticAirport(candidates);if(!best)return null;const{score:_score,...selected}=best;return selected}async function nearestAirport(userId:number,candidates:Array<{lat:number;lon:number}>):Promise<AirportDetection>{return automaticAirport(await airportSuggestions(userId,candidates))}
export async function detectTrackAirports(requests:AirportDetectionRequest[]):Promise<AirportDetectionResult>{const{userId}=await requireUser();const safe=requests.slice(0,20),countQuery=async()=>await sql`SELECT COUNT(DISTINCT UPPER(ident))::integer count FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND (user_id=${userId} OR LOWER(COALESCE(source,'')) LIKE 'ourairports%')` as Array<{count:number}>;const[parts,count]=await Promise.all([Promise.all(safe.map(async request=>{const[departureCandidates,arrivalCandidates]=await Promise.all([airportSuggestions(userId,request.departureCandidates),airportSuggestions(userId,request.arrivalCandidates)]);return{departure:automaticAirport(departureCandidates),arrival:automaticAirport(arrivalCandidates),departureCandidates:departureCandidates.map(({score:_score,...item})=>item),arrivalCandidates:arrivalCandidates.map(({score:_score,...item})=>item)}})),countQuery()]);return{parts,airportCount:Math.max(Number(count[0]?.count||0),airportCatalogSize())}}
export async function redetectFlightAirports(flightId:number,_:FlightActionState,_form:FormData):Promise<FlightActionState>{const{userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(flightId)||flightId<=0)return{error:"Invalid flight."};const lock=await sql`SELECT locked_at FROM flights WHERE id=${flightId} AND user_id=${userId} LIMIT 1` as Array<{locked_at:string|null}>;if(!lock[0])return{error:"Flight not found."};if(lock[0].locked_at)return{error:"Unlock the flight before changing detected airports."};const rows=await sql`SELECT coordinates_json FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} ORDER BY start_utc NULLS LAST,id` as Array<{coordinates_json:unknown}>;const parts:Array<Array<{lat:number;lon:number}>>=[];for(const row of rows){try{const parsed=typeof row.coordinates_json==="string"?JSON.parse(row.coordinates_json):row.coordinates_json;if(!Array.isArray(parsed))continue;const valid=parsed.map(point=>({lat:Number(point?.lat),lon:Number(point?.lon)})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180);if(valid.length>=2)parts.push(valid)}catch{}}if(!parts.length)return{error:"Flight has no usable GPS track."};const departureCandidates=trackEndpointCandidates(parts[0],false),arrivalCandidates=trackEndpointCandidates(parts.at(-1)!,true),[departure,arrival]=await Promise.all([nearestAirport(userId,departureCandidates),nearestAirport(userId,arrivalCandidates)]);if(!departure&&!arrival)return{error:`No airport could be selected automatically within ${AUTO_AIRPORT_RADIUS_KM} km of the track endpoints.`};await sql`UPDATE flights SET departure=CASE WHEN ${departure?.ident||""}<>'' THEN ${departure?.ident||""} ELSE departure END,arrival=CASE WHEN ${arrival?.ident||""}<>'' THEN ${arrival?.ident||""} ELSE arrival END WHERE id=${flightId} AND user_id=${userId}`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/database");revalidatePath("/map");const found=[departure?`departure ${departure.ident} (${departure.distanceKm} km)`:"",arrival?`arrival ${arrival.ident} (${arrival.distanceKm} km)`:""].filter(Boolean).join(" · ");return{success:`Saved: ${found}.`}}

export async function createFlight(_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const{userId}=await requireUser();await ensureDatabaseOptimizations();await Promise.all([ensureV159Schema(),ensureV162Schema(),ensureV164Schema(),ensureV166Schema()]);
  const parsed=parseFlightInput(form),expenseResult=parseFlightExpenses(form);if(!parsed.data)return{error:parsed.error};if(!expenseResult.data)return{error:expenseResult.error};
  const f=parsed.data,profile=await aircraftAuthorityProfile(userId,f.registration,false);if(!profile)return{error:"Selected aircraft profile is unavailable. Choose an aircraft from your Aircraft workspace before saving this flight."};
  const authority=authorizeProfileFlightContext(profile,flightAircraftContextFromForm(form));if(!authority.context)return{error:authority.error||"Selected aircraft profile needs configuration before saving this flight."};
  const authorityContext=authority.context;
  const picResolution=await resolveSafetyPilotPicForSave({sourceUserId:userId,role:f.role,evidence:f.evidence,commander:f.commander,form});if(!picResolution.ok)return{error:picResolution.error};const connectedPicUserId=picResolution.connectedUserId,commander=picResolution.commander;
  const departure=canonicalAirportIdent(f.departure),arrival=canonicalAirportIdent(f.arrival),expenseJson=JSON.stringify(expenseResult.data.map(item=>({category:item.category,label:item.label,amount_minor:item.amountMinor,currency:item.currency}))),price=f.billingBasis?await resolvedPrice(userId,f.registration,f.date):null,fingerprint=flightFingerprint(userId,{date:f.date,registration:f.registration,offBlock:f.offBlock,departure,arrival});
  const results=await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint},0))`,
    sql`WITH inserted AS (
      INSERT INTO flights (user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,balloon_class,balloon_group,balloon_operation,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,price_per_hour,billing_basis,note,operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,verification_name,verification_reference)
      SELECT ${userId},${f.date},${authorityContext.evidence},${f.registration},${authorityContext.aircraftType},${authorityContext.aircraftClass},${authorityContext.regulatoryCategory},${authorityContext.balloonClass},${authorityContext.balloonGroup},${f.balloonOperation},${f.launchMethod},${f.launches},${departure},${arrival},${f.offBlock},${f.takeoff},${f.landing},${f.onBlock},${f.starts},${commander},${f.instructor},${f.role},${f.task},${f.purposeCode},${price},${f.billingBasis},${f.note},${f.operationType},${f.engineType},${f.operatorName},${f.flightNumber},${f.operationContext},${f.landingsDay},${f.landingsNight},${f.movementEvidenceRecorded},${f.takeoffsDay},${f.takeoffsNight},${f.approachesDay},${f.approachesNight},${f.nightMinutes},${f.ifrMinutes},${f.picMinutes},${f.copilotMinutes},${f.dualMinutes},${f.instructorMinutes},${f.verificationName},${f.verificationReference}
      WHERE (${connectedPicUserId}=0 OR EXISTS(
        SELECT 1 FROM users u
        WHERE u.id=${connectedPicUserId}
          AND u.id<>${userId}
          AND NULLIF(TRIM(u.display_name),'') IS NOT NULL
          AND EXISTS(
            SELECT 1 FROM pilot_connections pc
            WHERE pc.status='accepted'
              AND ((pc.requester_user_id=${userId} AND pc.recipient_user_id=u.id)
                OR (pc.recipient_user_id=${userId} AND pc.requester_user_id=u.id))
          )
      ))
        AND NOT EXISTS(SELECT 1 FROM flights WHERE user_id=${userId} AND date::text=${f.date} AND UPPER(TRIM(registration))=${f.registration} AND COALESCE(off_block,'')=${f.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${arrival})
      RETURNING id
    ),expense_rows AS (
      INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency)
      SELECT ${userId},inserted.id,e.category,e.label,e.amount_minor,e.currency
      FROM inserted CROSS JOIN LATERAL jsonb_to_recordset(${expenseJson}::jsonb) AS e(category text,label text,amount_minor bigint,currency text)
      RETURNING id
    ),connected_link AS (
      INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
      SELECT inserted.id,${userId},${connectedPicUserId},'PIC',NOW()
      FROM inserted
      WHERE ${connectedPicUserId}>0
      ON CONFLICT(source_flight_id,intended_role) DO UPDATE
        SET source_user_id=EXCLUDED.source_user_id,connected_user_id=EXCLUDED.connected_user_id,updated_at=NOW()
      RETURNING id
    )
    SELECT id FROM inserted`
  ]);
  const rows=results[1] as Array<{id:number|string}>;if(!rows[0]){
    if(connectedPicUserId>0){const recheck=await resolveSafetyPilotPicForSave({sourceUserId:userId,role:f.role,evidence:f.evidence,commander:f.commander,form});if(!recheck.ok)return{error:recheck.error}}
    return{error:"This flight already exists. Duplicate submission was blocked."};
  }
  const id=Number(rows[0].id);revalidatePath("/dashboard");revalidatePath("/flights");redirect(String(form.get("intent"))==="another"?"/flights/new?added=1":`/flights/${id}?tab=logbook&saved=1`);
}

export async function importKmlFlight(_:FlightActionState,form:FormData):Promise<FlightActionState>{
 const{userId}=await requireUser();await ensureDatabaseOptimizations();await Promise.all([ensureV162Schema(),ensureV164Schema()]);const file=form.get("kml");if(!(file instanceof File)||!file.size)return{error:"Select a KML, GPX or CSV file."};if(file.size>8*1024*1024)return{error:"File exceeds 8 MB."};let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return{error:"File could not be read."}}if(points.length<2)return{error:"No usable GPS track was found."};
 const registration=String(form.get("registration")??"").trim().toUpperCase();if(!registration)return{error:"Select an aircraft registration."};const task=String(form.get("task")??"GPS import"),billingResult=serializeOptionalBilling(form.get("billingBasis"),form.get("billingShare"));if(billingResult.error)return{error:billingResult.error};const billing=billingResult.value;
 const selectedAircraft=await aircraftAuthorityProfile(userId,registration,true);if(!selectedAircraft)return{error:"Selected aircraft profile is unavailable. Choose an active aircraft before importing this track."};
 const authority=authorizeProfileFlightContext(selectedAircraft,flightAircraftContextFromForm(form));if(!authority.profile||!authority.context)return{error:authority.error||"Selected aircraft profile needs configuration before GPS import."};
 const authorityProfile=authority.profile,authorityContext=authority.context,profileForFlight={...authorityProfile,regulatoryCategory:authorityContext.regulatoryCategory};
 const operationEngine=resolveGpsImportOperationEngine({operationType:form.get("operationType"),engineType:form.get("engineType")},profileForFlight);if(operationEngine.error)return{error:operationEngine.error};
 const operationType=operationEngine.operationType,engineType=operationEngine.engineType,evidence=authorityContext.evidence,aircraftClass=authorityContext.aircraftClass,regulatoryCategory=authorityContext.regulatoryCategory,aircraftType=authorityContext.aircraftType,sourceRequirements=gpsImportSourceRequirements(profileForFlight),balloonClass=regulatoryCategory==="BALLOON"?authorityContext.balloonClass:"",balloonGroup=balloonClass==="HOT_AIR_BALLOON"?authorityContext.balloonGroup:"",balloonOperationRaw=String(form.get("balloonOperation")||"").trim().toUpperCase(),balloonOperation=regulatoryCategory==="BALLOON"&&["FREE","TETHERED"].includes(balloonOperationRaw)?balloonOperationRaw:"";
 const commonRoleCrewResult=resolveGpsImportCommonRoleCrew({role:form.get("role"),commander:form.get("commander"),instructor:form.get("instructor"),verificationName:form.get("verificationName"),verificationReference:form.get("verificationReference"),actualPicMode:form.get("actualPicMode"),connectedPicUserId:form.get("connectedPicUserId")},evidence);if(!commonRoleCrewResult.context)return{error:commonRoleCrewResult.error};const commonRoleCrew=commonRoleCrewResult.context;
 if(regulatoryCategory==="BALLOON"&&!balloonClass)return{error:"The selected balloon aircraft profile is missing its Part-BFCL balloon class. Update the aircraft profile before importing this track."};if(balloonClass==="HOT_AIR_BALLOON"&&!balloonGroup)return{error:"The selected hot-air balloon profile is missing group A, B, C or D. Update the aircraft profile before importing this track."};if(regulatoryCategory==="BALLOON"&&!balloonOperation)return{error:"Select whether the reviewed balloon flight was free or tethered. GPS cannot infer this BFCL.050 condition."};
 const rawIndices=String(form.get("splitIndices")||"").split(",").filter(Boolean).map(Number),indices=[...new Set(rawIndices)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<points.length-1).sort((a,b)=>a-b);if(indices.length!==rawIndices.length)return{error:"Invalid split. Upload the file again."};const parts=splitPoints(points,indices),partCount=Number(form.get("partCount"));if(!Number.isSafeInteger(partCount)||partCount!==parts.length||partCount<1||partCount>20)return{error:"Reviewed flight count does not match the track split."};const envelopeKeys=validateGpsImportPartEnvelopeKeys(form.keys(),partCount);if(envelopeKeys.error)return{error:envelopeKeys.error};const partRoleCrew:typeof commonRoleCrew[]=[];for(let index=0;index<partCount;index++){const prefix=`part_${index}_roleCrew_`,resolved=resolveGpsImportPartRoleCrew({mode:form.get(`${prefix}mode`),role:form.get(`${prefix}role`),commander:form.get(`${prefix}commander`),instructor:form.get(`${prefix}instructor`),verificationName:form.get(`${prefix}verificationName`),verificationReference:form.get(`${prefix}verificationReference`),actualPicMode:form.get(`${prefix}actualPicMode`),connectedPicUserId:form.get(`${prefix}connectedPicUserId`),rolePresent:form.has(`${prefix}role`),commanderPresent:form.has(`${prefix}commander`),instructorPresent:form.has(`${prefix}instructor`),verificationNamePresent:form.has(`${prefix}verificationName`),verificationReferencePresent:form.has(`${prefix}verificationReference`),actualPicModePresent:form.has(`${prefix}actualPicMode`),connectedPicUserIdPresent:form.has(`${prefix}connectedPicUserId`)},evidence,commonRoleCrew);if(!resolved.context)return{error:`Flight ${index+1}: ${resolved.error}`};const picResolution=await resolveSafetyPilotPic({sourceUserId:userId,role:resolved.context.role,evidence,commander:resolved.context.commander,mode:resolved.context.actualPicMode,connectedPicUserId:resolved.context.connectedPicUserId});if(!picResolution.ok)return{error:`Flight ${index+1}: ${picResolution.error}`};partRoleCrew.push({...resolved.context,commander:picResolution.commander,connectedPicUserId:picResolution.connectedUserId})}const groundOnly=parts.findIndex(part=>!hasAirborneMovement(part));if(groundOnly>=0)return{error:`Section ${groundOnly+1} contains no credible flight movement. Adjust or remove the split.`};
 const reviewed:Array<{date:string;offBlock:string;takeoff:string;landing:string;onBlock:string;departure:string;arrival:string;starts:number;takeoffs:number;landingsDay:number;landingsNight:number;movementEvidenceRecorded:boolean;takeoffsDay:number;takeoffsNight:number;approachesDay:number;approachesNight:number;launchMethod:string;launches:number;nightMinutes:number;ifrMinutes:number;note:string}>=[];const validTime=(value:string)=>!value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value),explicitCount=(raw:unknown)=>{const value=String(raw??"").trim();return /^\d{1,2}$/.test(value)&&Number(value)>=0&&Number(value)<=99?Number(value):null},reviewDuration=(raw:unknown)=>{const value=String(raw??"").trim();if(!value)return{minutes:0};const match=value.match(/^(\d{1,2}):([0-5]\d)$/);if(!match)return{error:"Use H:MM for Night / IFR time."};const minutes=Number(match[1])*60+Number(match[2]);if(minutes>24*60)return{error:"Night / IFR time cannot exceed 24 hours."};return{minutes}};for(let index=0;index<parts.length;index++){if(String(form.get(`part_${index}_reviewed`)||"")!=="yes")return{error:`Flight ${index+1} was not reviewed.`};const date=String(form.get(`part_${index}_date`)||""),offBlock=String(form.get(`part_${index}_offBlock`)||""),takeoff=String(form.get(`part_${index}_takeoff`)||""),landing=String(form.get(`part_${index}_landing`)||""),onBlock=String(form.get(`part_${index}_onBlock`)||"");if(flightDateKey(date)!==date||[offBlock,takeoff,landing,onBlock].some(value=>!validTime(value)))return{error:`Flight ${index+1} has an invalid date or time.`};const reviewedStarts=Math.max(0,Math.min(99,Number(form.get(`part_${index}_starts`)||1))),landingsDay=explicitCount(form.get(`part_${index}_landingsDay`)),landingsNight=sourceRequirements.landingMode==="TOTAL"?0:explicitCount(form.get(`part_${index}_landingsNight`));if(landingsDay===null||landingsNight===null||landingsDay+landingsNight!==reviewedStarts)return{error:`Flight ${index+1} needs explicit landing evidence matching the reviewed total.`};let takeoffs=Math.max(0,Math.min(99,Number(form.get(`part_${index}_takeoffs`)||0))),movementEvidenceRecorded=false,takeoffsDay=0,takeoffsNight=0,approachesDay=0,approachesNight=0,launchMethod="",launches=0;if(sourceRequirements.movementMode==="SAILPLANE_LAUNCH"){launchMethod=String(form.get(`part_${index}_launchMethod`)||"").trim().toUpperCase();const launchCount=explicitCount(form.get(`part_${index}_launches`));if(!LAUNCH_METHODS.includes(launchMethod as (typeof LAUNCH_METHODS)[number])||launchCount===null||launchCount<1)return{error:`Flight ${index+1} requires explicit sailplane launch method and count.`};launches=launchCount}else if(sourceRequirements.movementMode==="EXPLICIT_TAKEOFFS"){const day=explicitCount(form.get(`part_${index}_takeoffsDay`)),night=explicitCount(form.get(`part_${index}_takeoffsNight`));if(day===null||night===null||day+night!==takeoffs)return{error:`Flight ${index+1} needs explicit take-off evidence matching the reviewed total.`};takeoffsDay=day;takeoffsNight=night}else if(sourceRequirements.movementMode==="FCL060_PF"){const pf=String(form.get(`part_${index}_movementEvidenceRecorded`)||"").trim().toLowerCase();if(!["yes","no"].includes(pf))return{error:`Flight ${index+1} needs an explicit pilot-flying movement decision.`};movementEvidenceRecorded=pf==="yes";if(movementEvidenceRecorded){const td=explicitCount(form.get(`part_${index}_takeoffsDay`)),tn=explicitCount(form.get(`part_${index}_takeoffsNight`)),ad=explicitCount(form.get(`part_${index}_approachesDay`)),an=explicitCount(form.get(`part_${index}_approachesNight`));if([td,tn,ad,an].some(value=>value===null))return{error:`Flight ${index+1} needs explicit PF take-off and approach counts.`};takeoffsDay=td!;takeoffsNight=tn!;approachesDay=ad!;approachesNight=an!}}const night=sourceRequirements.reviewNightIfr?reviewDuration(form.get(`part_${index}_nightTime`)):{minutes:0},ifr=sourceRequirements.reviewNightIfr?reviewDuration(form.get(`part_${index}_ifrTime`)):{minutes:0};if("error" in night||"error" in ifr)return{error:`Flight ${index+1}: ${"error" in night?night.error:ifr.error}`};const blockForEvidence=offBlock&&onBlock?flightMinutes(offBlock,onBlock):0;if(blockForEvidence>0&&(night.minutes>blockForEvidence||ifr.minutes>blockForEvidence))return{error:`Flight ${index+1} Night / IFR time cannot exceed BLOCK time.`};const starts=sourceRequirements.movementMode==="SAILPLANE_LAUNCH"?launches:landingsDay+landingsNight;if(regulatoryCategory==="BALLOON"&&(takeoffsDay+takeoffsNight<1||starts<1))return{error:`Flight ${index+1} requires explicit balloon take-off and landing counts.`};reviewed.push({date,offBlock,takeoff,landing,onBlock,departure:canonicalAirportIdent(String(form.get(`part_${index}_departure`)||"").slice(0,16)),arrival:canonicalAirportIdent(String(form.get(`part_${index}_arrival`)||"").slice(0,16)),starts,takeoffs,landingsDay,landingsNight,movementEvidenceRecorded,takeoffsDay,takeoffsNight,approachesDay,approachesNight,launchMethod,launches,nightMinutes:night.minutes,ifrMinutes:ifr.minutes,note:String(form.get(`part_${index}_note`)||"").trim().slice(0,2000)})}
 const priceCache=new Map<string,number|null>();const prepared=[];for(let index=0;index<parts.length;index++){const part=parts[index],stats=trackStats(part),envelope=flightEnvelope(part),values=reviewed[index],roleCrew=partRoleCrew[index];const[detectedDeparture,detectedArrival]=await Promise.all([values.departure?Promise.resolve(null):nearestAirport(userId,envelope.departureCandidates),values.arrival?Promise.resolve(null):nearestAirport(userId,envelope.arrivalCandidates)]),departure=values.departure||detectedDeparture?.ident||"",arrival=values.arrival||detectedArrival?.ident||"",partNote=parts.length>1?`${values.note}${values.note?' · ':''}Reviewed import ${index+1}/${parts.length}`:values.note,suffix=splitTrackFileName(file.name,index,parts.length),candidate=gpsFlightCandidate({registration,aircraftType,profile:profileForFlight,role:roleCrew.role,commander:roleCrew.commander,instructor:roleCrew.instructor,verificationName:roleCrew.verificationName,verificationReference:roleCrew.verificationReference,billingBasis:form.get("billingBasis"),billingShare:form.get("billingShare"),task,balloonOperation,operationType,engineType,reviewedPart:{date:values.date,departure,arrival,offBlock:values.offBlock,takeoff:values.takeoff,landing:values.landing,onBlock:values.onBlock,starts:values.starts,takeoffs:values.takeoffs,landingsDay:values.landingsDay,landingsNight:values.landingsNight,movementEvidenceRecorded:sourceRequirements.movementMode==="FCL060_PF"?(values.movementEvidenceRecorded?"yes":"no"):undefined,takeoffsDay:values.takeoffsDay,takeoffsNight:values.takeoffsNight,approachesDay:values.approachesDay,approachesNight:values.approachesNight,launchMethod:values.launchMethod,launches:values.launches,nightTime:values.nightMinutes,ifrTime:values.ifrMinutes,note:partNote}}),normalized=normalizeFlightDraft(candidate);if(!normalized.data)return{error:`Flight ${index+1}: ${normalized.error||"Reviewed flight data is incomplete."}`};const input=normalized.data;let price:number|null=null;if(input.billingBasis){price=priceCache.get(input.date)??null;if(!priceCache.has(input.date)){price=await resolvedPrice(userId,input.registration,input.date);priceCache.set(input.date,price??null)}}prepared.push({part,stats,input,price:price??null,suffix,connectedPicUserId:roleCrew.connectedPicUserId,fingerprint:flightFingerprint(userId,{date:input.date,registration:input.registration,offBlock:input.offBlock,departure:input.departure,arrival:input.arrival})})}
 if(new Set(prepared.map(item=>item.fingerprint)).size!==prepared.length)return{error:"Two imported sections have the same date, time and route. Adjust the split or times."};const existing=await Promise.all(prepared.map(item=>sql`SELECT id FROM flights WHERE user_id=${userId} AND date::text=${item.input.date} AND UPPER(TRIM(registration))=${item.input.registration} AND COALESCE(off_block,'')=${item.input.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${item.input.departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${item.input.arrival} LIMIT 1`));if(existing.some(rows=>rows.length))return{error:"At least one reviewed flight already exists. The duplicate import was blocked."};
 let lastId=0;try{const fingerprints=[...new Set(prepared.map(item=>item.fingerprint))].sort(),locks=fingerprints.map(value=>sql`SELECT pg_advisory_xact_lock(hashtextextended(${value},0))`),inserts=prepared.map(item=>sql`WITH inserted AS (
  INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,balloon_class,balloon_group,balloon_operation,launch_method,launches,departure,arrival,off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,purpose_code,verification_name,verification_reference,price_per_hour,billing_basis,note,operation_type,engine_type,operator_name,flight_number,operation_context,landings_day,landings_night,movement_evidence_recorded,takeoffs_day,takeoffs_night,approaches_day,approaches_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes)
  SELECT ${userId},${item.input.date},${item.input.evidence},${item.input.registration},${item.input.aircraftType},${item.input.aircraftClass},${item.input.regulatoryCategory},${item.input.balloonClass},${item.input.balloonGroup},${item.input.balloonOperation},${item.input.launchMethod},${item.input.launches},${item.input.departure},${item.input.arrival},${item.input.offBlock},${item.input.takeoff},${item.input.landing},${item.input.onBlock},${item.input.starts},${item.input.commander},${item.input.instructor},${item.input.role},${item.input.task},${item.input.purposeCode},${item.input.verificationName},${item.input.verificationReference},${item.price},${item.input.billingBasis},${item.input.note},${item.input.operationType},${item.input.engineType},${item.input.operatorName},${item.input.flightNumber},${item.input.operationContext},${item.input.landingsDay},${item.input.landingsNight},${item.input.movementEvidenceRecorded},${item.input.takeoffsDay},${item.input.takeoffsNight},${item.input.approachesDay},${item.input.approachesNight},${item.input.nightMinutes},${item.input.ifrMinutes},${item.input.picMinutes},${item.input.copilotMinutes},${item.input.dualMinutes},${item.input.instructorMinutes}
  WHERE (${item.connectedPicUserId}=0 OR EXISTS(
    SELECT 1 FROM users u
    WHERE u.id=${item.connectedPicUserId}
      AND u.id<>${userId}
      AND NULLIF(TRIM(u.display_name),'') IS NOT NULL
      AND EXISTS(
        SELECT 1 FROM pilot_connections pc
        WHERE pc.status='accepted'
          AND ((pc.requester_user_id=${userId} AND pc.recipient_user_id=u.id)
            OR (pc.recipient_user_id=${userId} AND pc.requester_user_id=u.id))
      )
  ))
    AND NOT EXISTS(SELECT 1 FROM flights WHERE user_id=${userId} AND date::text=${item.input.date} AND UPPER(TRIM(registration))=${item.input.registration} AND COALESCE(off_block,'')=${item.input.offBlock} AND UPPER(TRIM(COALESCE(departure,'')))=${item.input.departure} AND UPPER(TRIM(COALESCE(arrival,'')))=${item.input.arrival})
  RETURNING id
),connected_crew AS (
  INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
  SELECT inserted.id,${userId},${item.connectedPicUserId},'PIC',NOW()
  FROM inserted
  WHERE ${item.connectedPicUserId}>0
  RETURNING id
),track_insert AS (
  INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version)
  SELECT ${userId},inserted.id,${item.suffix},NOW(),${item.stats.pointCount},${item.stats.distanceKm},${item.stats.startUtc},${item.stats.endUtc},${item.stats.minAlt},${item.stats.maxAlt},${JSON.stringify(item.part)},${JSON.stringify(overview(item.part))},1
  FROM inserted
  RETURNING flight_id
),validated AS (
  SELECT
    (SELECT id FROM inserted) flight_id,
    1/(SELECT COUNT(*)::integer FROM inserted) inserted_ok,
    1/(SELECT COUNT(*)::integer FROM track_insert) track_ok,
    CASE WHEN ${item.connectedPicUserId}>0 THEN 1/(SELECT COUNT(*)::integer FROM connected_crew) ELSE 1 END crew_ok
)
SELECT flight_id FROM validated WHERE inserted_ok=1 AND track_ok=1 AND crew_ok=1`),results=await sql.transaction([...locks,...inserts]);const insertResults=results.slice(locks.length) as Array<Array<{flight_id:number|string}>>;if(insertResults.length!==prepared.length||insertResults.some(rows=>!Number(rows?.[0]?.flight_id)))throw new Error("Import did not return every flight id");lastId=Number(insertResults.at(-1)?.[0]?.flight_id);if(!lastId)throw new Error("Import did not return a flight id")}catch(error){console.error("reviewed-import-transaction-failed",error);return{error:"Import failed and the transaction was rolled back. No partial flights were created."}}revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/map");redirect(`/flights/${lastId}?tab=logbook&saved=1`)
}

export async function updateFlight(id:number,_:FlightActionState,form:FormData):Promise<FlightActionState>{
  const{userId}=await requireUser();await ensureDatabaseOptimizations();await Promise.all([ensureV159Schema(),ensureV162Schema(),ensureV164Schema(),ensureV166Schema()]);if(!Number.isSafeInteger(id)||id<=0)return{error:"Invalid record."};
  const parsed=parseFlightInput(form),expenseResult=parseFlightExpenses(form);if(!parsed.data)return{error:parsed.error};if(!expenseResult.data)return{error:expenseResult.error};
  const f=parsed.data,picResolution=await resolveSafetyPilotPicForSave({sourceUserId:userId,role:f.role,evidence:f.evidence,commander:f.commander,form});if(!picResolution.ok)return{error:picResolution.error};const connectedPicUserId=picResolution.connectedUserId,commander=picResolution.commander;
  const departure=canonicalAirportIdent(f.departure),arrival=canonicalAirportIdent(f.arrival),expenseJson=JSON.stringify(expenseResult.data.map(item=>({category:item.category,label:item.label,amount_minor:item.amountMinor,currency:item.currency})));
  const existingRows=await sql`SELECT registration,date::text date,price_per_hour,locked_at,certified_at,COALESCE(evidence,'') evidence,COALESCE(aircraft_type,'') aircraft_type,COALESCE(aircraft_class,'') aircraft_class,COALESCE(regulatory_category,'') regulatory_category,COALESCE(balloon_class,'') balloon_class,COALESCE(balloon_group,'') balloon_group FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<StoredFlightAircraftContextRow&{date:string;price_per_hour:number|null;locked_at:string|null;certified_at:string|null}>;
  const existing=existingRows[0];if(!existing)return{error:"Flight not found or access denied."};if(existing.locked_at)return{error:"This flight is locked. Unlock it before editing."};if(connectedPicUserId>0&&existing.certified_at)return{error:"Connected Actual PIC can only be changed on an editable draft or correction."};
  const authorityKind=resolveFlightAircraftContextAuthority({mode:"UPDATE",storedRegistration:existing.registration,submittedRegistration:f.registration});
  let persistedAircraftContext=flightAircraftContextFromInput(f);
  if(authorityKind.authority==="PROFILE"){
    const profile=await aircraftAuthorityProfile(userId,authorityKind.submittedRegistration,false);if(!profile)return{error:"Selected aircraft profile is unavailable. Choose an aircraft from your Aircraft workspace before saving this flight."};
    const authority=authorizeProfileFlightContext(profile,flightAircraftContextFromForm(form));if(!authority.context)return{error:authority.error||"Selected aircraft profile needs configuration before saving this flight."};
    persistedAircraftContext=authority.context;
  }else{
    const storedContext=storedFlightAircraftContext(existing),rawSubmitted=flightAircraftContextFromForm(form);
    const storedCategory=String(existing.regulatory_category??"").trim(),submittedCategory=String(rawSubmitted.regulatoryCategory??"").trim().toUpperCase();
    const legacyCategoryPresentationOnly=!storedCategory&&submittedCategory===f.regulatoryCategory
      &&String(rawSubmitted.evidence??"").trim().toUpperCase()===String(existing.evidence??"").trim().toUpperCase()
      &&String(rawSubmitted.aircraftClass??"").trim().toUpperCase()===String(existing.aircraft_class??"").trim().toUpperCase()
      &&String(rawSubmitted.balloonClass??"").trim().toUpperCase()===String(existing.balloon_class??"").trim().toUpperCase()
      &&String(rawSubmitted.balloonGroup??"").trim().toUpperCase()===String(existing.balloon_group??"").trim().toUpperCase()
      &&String(rawSubmitted.aircraftType??"").trim()===String(existing.aircraft_type??"").trim();
    const submittedForSnapshot=legacyCategoryPresentationOnly?{...rawSubmitted,regulatoryCategory:""}:rawSubmitted;
    const authority=authorizeUnchangedSnapshotFlightContext(storedContext,submittedForSnapshot);if(!authority.context)return{error:authority.error||"Stored aircraft context could not be preserved safely."};
    persistedAircraftContext=authority.context;
  }
  const price=!f.billingBasis?null:shouldResolveStoredPrice(existing,f.registration,f.date)?await resolvedPrice(userId,f.registration,f.date):existing.price_per_hour;
  const rows=await sql`WITH updated AS (
    UPDATE flights flight SET date=${f.date},evidence=${persistedAircraftContext.evidence},registration=${f.registration},aircraft_type=${persistedAircraftContext.aircraftType},aircraft_class=${persistedAircraftContext.aircraftClass},regulatory_category=${persistedAircraftContext.regulatoryCategory},balloon_class=${persistedAircraftContext.balloonClass},balloon_group=${persistedAircraftContext.balloonGroup},balloon_operation=${f.balloonOperation},launch_method=${f.launchMethod},launches=${f.launches},departure=${departure},arrival=${arrival},off_block=${f.offBlock},takeoff=${f.takeoff},landing=${f.landing},on_block=${f.onBlock},starts=${f.starts},commander=${commander},instructor=${f.instructor},role=${f.role},task=${f.task},purpose_code=${f.purposeCode},price_per_hour=${price},billing_basis=${f.billingBasis},note=${f.note},operation_type=${f.operationType},engine_type=${f.engineType},operator_name=${f.operatorName},flight_number=${f.flightNumber},operation_context=${f.operationContext},landings_day=${f.landingsDay},landings_night=${f.landingsNight},movement_evidence_recorded=${f.movementEvidenceRecorded},takeoffs_day=${f.takeoffsDay},takeoffs_night=${f.takeoffsNight},approaches_day=${f.approachesDay},approaches_night=${f.approachesNight},night_minutes=${f.nightMinutes},ifr_minutes=${f.ifrMinutes},pic_minutes=${f.picMinutes},copilot_minutes=${f.copilotMinutes},dual_minutes=${f.dualMinutes},instructor_minutes=${f.instructorMinutes},verification_name=${f.verificationName},verification_reference=${f.verificationReference}
    WHERE flight.id=${id} AND flight.user_id=${userId} AND flight.locked_at IS NULL
      AND (${connectedPicUserId}=0 OR flight.certified_at IS NULL)
      AND (${connectedPicUserId}=0 OR EXISTS(
        SELECT 1 FROM users u
        WHERE u.id=${connectedPicUserId}
          AND u.id<>${userId}
          AND NULLIF(TRIM(u.display_name),'') IS NOT NULL
          AND EXISTS(
            SELECT 1 FROM pilot_connections pc
            WHERE pc.status='accepted'
              AND ((pc.requester_user_id=${userId} AND pc.recipient_user_id=u.id)
                OR (pc.recipient_user_id=${userId} AND pc.requester_user_id=u.id))
          )
      ))
    RETURNING flight.id
  ),deleted_expenses AS (
    DELETE FROM flight_expenses WHERE flight_id=${id} AND user_id=${userId} AND EXISTS(SELECT 1 FROM updated) RETURNING id
  ),expense_rows AS (
    INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency)
    SELECT ${userId},${id},e.category,e.label,e.amount_minor,e.currency
    FROM jsonb_to_recordset(${expenseJson}::jsonb) AS e(category text,label text,amount_minor bigint,currency text)
    WHERE EXISTS(SELECT 1 FROM updated)
    RETURNING id
  ),deleted_link AS (
    DELETE FROM flight_connected_crew
    WHERE source_flight_id=${id} AND source_user_id=${userId} AND intended_role='PIC'
      AND ${connectedPicUserId}=0 AND EXISTS(SELECT 1 FROM updated)
    RETURNING id
  ),connected_link AS (
    INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
    SELECT updated.id,${userId},${connectedPicUserId},'PIC',NOW()
    FROM updated
    WHERE ${connectedPicUserId}>0
    ON CONFLICT(source_flight_id,intended_role) DO UPDATE
      SET source_user_id=EXCLUDED.source_user_id,connected_user_id=EXCLUDED.connected_user_id,updated_at=NOW()
    RETURNING id
  )
  SELECT id FROM updated` as Array<{id:number|string}>;
  if(!rows[0]){
    if(connectedPicUserId>0){const recheck=await resolveSafetyPilotPicForSave({sourceUserId:userId,role:f.role,evidence:f.evidence,commander:f.commander,form});if(!recheck.ok)return{error:recheck.error}}
    return{error:"Flight not found or access denied."};
  }
  revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath(`/flights/${id}`);return{success:"Flight changes saved."};
}
export async function saveFlightExpenses(id:number,_:FlightActionState,form:FormData):Promise<FlightActionState>{const{userId}=await requireUser();await ensureDatabaseOptimizations();await ensureV159Schema();if(!Number.isSafeInteger(id)||id<=0)return{error:"Invalid flight."};const owned=await sql`SELECT id FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1`;if(!owned[0])return{error:"Flight not found or access denied."};const parsed=parseFlightExpenses(form);if(!parsed.data)return{error:parsed.error};const expenseJson=JSON.stringify(parsed.data.map(item=>({category:item.category,label:item.label,amount_minor:item.amountMinor,currency:item.currency})));await sql.transaction([sql`DELETE FROM flight_expenses WHERE flight_id=${id} AND user_id=${userId}`,sql`INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency) SELECT ${userId},${id},e.category,e.label,e.amount_minor,e.currency FROM jsonb_to_recordset(${expenseJson}::jsonb) AS e(category text,label text,amount_minor bigint,currency text)`]);revalidatePath(`/flights/${id}`);revalidatePath("/flights");revalidatePath("/dashboard");return{success:"Expenses saved."}}
export async function deleteFlight(id:number){const{userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(id)||id<=0)return;let deleted=false;try{deleted=await moveFlightToTrash(userId,id)}catch(error){console.error("flight-trash-transaction-failed",error)}if(!deleted)return;revalidatePath("/dashboard");revalidatePath("/flights");revalidatePath("/map");revalidatePath("/data");revalidatePath("/export");redirect("/flights")}
export async function attachKmlTrack(flightId:number,_:FlightActionState,form:FormData):Promise<FlightActionState>{const{userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(flightId)||flightId<=0)return{error:"Invalid flight."};const owned=await sql`SELECT id,locked_at FROM flights WHERE id=${flightId} AND user_id=${userId}` as Array<{id:number;locked_at:string|null}>;if(!owned[0])return{error:"Flight not found."};if(owned[0].locked_at)return{error:"Unlock the flight before changing its GPS track."};const file=form.get("kml");if(!(file instanceof File)||!file.size)return{error:"Select a KML, GPX or CSV file."};if(file.size>8*1024*1024)return{error:"File exceeds 8 MB."};let points;try{points=parseTrackFile(await file.text(),file.name)}catch{return{error:"File could not be read."}}if(points.length<2)return{error:"File contains no usable track."};const stats=trackStats(points),envelope=flightEnvelope(points),[departure,arrival]=await Promise.all([nearestAirport(userId,envelope.departureCandidates),nearestAirport(userId,envelope.arrivalCandidates)]),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc),replace=Boolean(form.get("replace")),queries=[];if(replace){queries.push(sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId})`);queries.push(sql`DELETE FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId}`)}queries.push(sql`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version) VALUES(${userId},${flightId},${file.name.slice(0,240)},NOW(),${stats.pointCount},${stats.distanceKm},${stats.startUtc},${stats.endUtc},${stats.minAlt},${stats.maxAlt},${JSON.stringify(points)},${JSON.stringify(overview(points))},1)`);queries.push(sql`UPDATE flights SET departure=CASE WHEN NULLIF(TRIM(COALESCE(departure,'')),'') IS NULL THEN ${departure?.ident||""} ELSE departure END,arrival=CASE WHEN NULLIF(TRIM(COALESCE(arrival,'')),'') IS NULL THEN ${arrival?.ident||""} ELSE arrival END,off_block=CASE WHEN NULLIF(TRIM(COALESCE(off_block,'')),'') IS NULL THEN ${off?.time||""} ELSE off_block END,takeoff=CASE WHEN NULLIF(TRIM(COALESCE(takeoff,'')),'') IS NULL THEN ${takeoff?.time||""} ELSE takeoff END,landing=CASE WHEN NULLIF(TRIM(COALESCE(landing,'')),'') IS NULL THEN ${landing?.time||""} ELSE landing END,on_block=CASE WHEN NULLIF(TRIM(COALESCE(on_block,'')),'') IS NULL THEN ${on?.time||""} ELSE on_block END WHERE id=${flightId} AND user_id=${userId}`);try{await sql.transaction(queries)}catch(error){console.error("attach-track-transaction-failed",error);return{error:"GPS track could not be saved safely. Existing data is unchanged."}}revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");return{success:"GPS track saved."}}
export async function deleteTrack(flightId:number,form:FormData){const{userId}=await requireUser();await ensureDatabaseOptimizations();const trackId=Number(form.get("trackId"));if(!Number.isSafeInteger(flightId)||flightId<=0||!Number.isSafeInteger(trackId)||trackId<=0)return;const owned=await sql`SELECT t.id,f.locked_at FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id WHERE t.id=${trackId} AND t.flight_id=${flightId} AND t.user_id=${userId} LIMIT 1` as Array<{id:number;locked_at:string|null}>;if(!owned[0]||owned[0].locked_at)return;try{await createStoredBackup(userId,"pre_restore")}catch(error){console.error("pre-track-delete-backup-failed",error);return}await sql.transaction([sql`DELETE FROM track_points WHERE user_id=${userId} AND track_id IN(SELECT id FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId})`,sql`DELETE FROM flight_tracks WHERE id=${trackId} AND flight_id=${flightId} AND user_id=${userId}`]);revalidatePath(`/flights/${flightId}`);revalidatePath("/map");revalidatePath("/dashboard");revalidatePath("/data");revalidatePath("/export")}
export async function applyGpsTimes(flightId:number){const{userId}=await requireUser();await ensureDatabaseOptimizations();const rows=await sql`SELECT t.coordinates_json,f.locked_at FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id WHERE t.user_id=${userId} AND t.flight_id=${flightId} ORDER BY t.start_utc NULLS LAST,t.id LIMIT 1` as Array<{coordinates_json:string;locked_at:string|null}>;if(!rows[0]||rows[0].locked_at)return;let points;try{points=JSON.parse(rows[0].coordinates_json)}catch{return}if(!Array.isArray(points)||points.length<2)return;const envelope=flightEnvelope(points),off=localParts(envelope.offBlockUtc),takeoff=localParts(envelope.takeoffUtc),landing=localParts(envelope.landingUtc),on=localParts(envelope.onBlockUtc);if(!off||!takeoff||!landing||!on)return;await sql`UPDATE flights SET off_block=${off.time},takeoff=${takeoff.time},landing=${landing.time},on_block=${on.time} WHERE id=${flightId} AND user_id=${userId} AND locked_at IS NULL`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/dashboard")}
export async function setFlightLock(flightId:number,form:FormData){const{userId}=await requireUser();await ensureDatabaseOptimizations();if(!Number.isSafeInteger(flightId)||flightId<=0)return;const lock=String(form.get("lock")||"")==="yes";if(lock)await sql`UPDATE flights SET locked_at=NOW(),locked_by_user_id=${userId} WHERE id=${flightId} AND user_id=${userId} AND locked_at IS NULL`;else await sql`UPDATE flights SET locked_at=NULL,locked_by_user_id=NULL WHERE id=${flightId} AND user_id=${userId} AND locked_at IS NOT NULL`;revalidatePath(`/flights/${flightId}`);revalidatePath("/flights");revalidatePath("/database")}
