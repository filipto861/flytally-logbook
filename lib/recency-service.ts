import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV1353Schema } from "@/lib/v1353-schema";
import { ensureV151Schema } from "@/lib/v151-schema";
import { ensureV165Schema } from "@/lib/v165-schema";
import { credentialValidity } from "@/lib/credential-validity";
import { resolveMovementCompatibility } from "@/lib/legacy-movement";
import { parsePilotPreferences,type PilotPreferences } from "@/lib/logbook-print";
import { daysBetween,evaluateClassRevalidation,evaluateCustomRule,evaluateLaplA,evaluatePassengerCurrencyMode,flightMinutes,parseCustomRecencyRules,parseRecencyEvidence,type RecencyEvaluation,type RecencyFlight } from "@/lib/recency-engine";
import { isAeroplaneIrQualification } from "@/lib/regulatory-qualification";
import { confirmedQualificationMatches,hasConfirmedQualificationStructure,qualificationLogicScope } from "@/lib/qualification-record";

const t=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>t(value).toUpperCase();
const todayIso=()=>new Date().toISOString().slice(0,10);
const classOf=(value:unknown)=>{const text=upper(value);return text.startsWith("SEP")?"SEP":text.startsWith("TMG")?"TMG":""};
const classForRecord=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?confirmedQualificationMatches(row,"CLASS_TYPE","AEROPLANE","PILOT")?classOf(qualificationLogicScope(row)):"":classOf(row.qualification_type);
const aeroplaneIr=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?confirmedQualificationMatches(row,"INSTRUMENT","AEROPLANE","PILOT")&&isAeroplaneIrQualification(qualificationLogicScope(row)):isAeroplaneIrQualification(row.qualification_type);
const aeroplaneNight=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?confirmedQualificationMatches(row,"OPERATIONAL","AEROPLANE","PILOT")&&upper(qualificationLogicScope(row)).includes("NIGHT"):upper(row.qualification_type).includes("NIGHT");
const currentCredential=(row:Record<string,unknown>,today:string)=>{const state=credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until},today);return state.status!=="expired"&&state.status!=="incomplete"};
const LEGACY_MOVEMENT_NOTE="Certified legacy EASA flights that pre-date structured PF counters use a conservative compatibility rule: each historically recorded landing supplies one take-off and one approach. Structured-era records without PF movement evidence are never inferred.";
const annotateLegacyMovement=(item:RecencyEvaluation,legacyCount:number):RecencyEvaluation=>{
  if(!["FCL.060","FCL.140.A","FCL.740.A"].includes(item.code))return item;
  let note=item.note??"";
  note=note.replace("Record-based indicator uses certified flights with explicit take-off, approach and landing evidence. Older flights without structured movement evidence are not inferred.",`Record-based indicator uses certified flight evidence. ${LEGACY_MOVEMENT_NOTE}`);
  note=note.replace("FCL.740.A requires both 12 take-offs and 12 landings; FlyTally no longer substitutes landings for missing take-off evidence.",`FCL.740.A requires both 12 take-offs and 12 landings. ${LEGACY_MOVEMENT_NOTE}`);
  if(legacyCount>0&&!note.includes(LEGACY_MOVEMENT_NOTE))note=`${note} ${LEGACY_MOVEMENT_NOTE}`.trim();
  return{...item,note,meta:{...(item.meta??{}),legacyMovementFlights:legacyCount}};
};
export const BUILTIN_RECENCY_MONITORS=["lapl-fcl140a","sep-passenger-day","sep-passenger-night","tmg-passenger-day","tmg-passenger-night","sep-revalidation","tmg-revalidation","credential-deadlines"] as const;
export type RecencyMonitor={id:string;label:string;detail:string};
export type RecencyDeadline={label:string;state:ReturnType<typeof credentialValidity>};
export type RecencySnapshot={generatedAt:string;status:"ok"|"warning"|"attention";reviewCount:number;dueSoonCount:number;nextDate?:string;label:string};
export type RecencyState={today:string;preferences:PilotPreferences;availableMonitors:RecencyMonitor[];enabled:Set<string>;evaluations:RecencyEvaluation[];deadlineItems:RecencyDeadline[];monitorDeadlines:boolean;reviewCount:number;dueSoonCount:number;notificationDays:number;evidence:ReturnType<typeof parseRecencyEvidence>;customIds:Set<string>};
type ServiceRecencyFlight=RecencyFlight&{legacyMovementInferred?:boolean;ullMovementInferred?:boolean};

export function parseRecencyNotificationDays(value:unknown){const days=Math.round(Number(value)||0);return[7,14,30].includes(days)?days:0}
export function parseRecencySnapshot(value:unknown):RecencySnapshot|null{let raw:unknown=value;if(typeof raw==="string"){try{raw=JSON.parse(raw)}catch{return null}}if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;const v=raw as Record<string,unknown>,status=t(v.status) as RecencySnapshot["status"],generatedAt=t(v.generatedAt);if(!["ok","warning","attention"].includes(status)||!/^\d{4}-\d{2}-\d{2}/.test(generatedAt))return null;return{generatedAt,status,reviewCount:Math.max(0,Math.round(Number(v.reviewCount)||0)),dueSoonCount:Math.max(0,Math.round(Number(v.dueSoonCount)||0)),nextDate:/^\d{4}-\d{2}-\d{2}$/.test(t(v.nextDate))?t(v.nextDate):undefined,label:t(v.label)||"Recency status"}}
function ratingForClass(rows:Array<Record<string,unknown>>,aircraftClass:"SEP"|"TMG"){return rows.filter(row=>classForRecord(row)===aircraftClass&&/^\d{4}-\d{2}-\d{2}$/.test(t(row.valid_until).slice(0,10))).sort((a,b)=>t(b.valid_until).localeCompare(t(a.valid_until)))[0]}
const daysUntil=(today:string,date?:string)=>date?daysBetween(today,date):Number.POSITIVE_INFINITY;

export async function getRecencyStateForUser(userId:number,preferencesOverride?:PilotPreferences):Promise<RecencyState>{
  await ensureDatabaseOptimizations();await Promise.all([ensureV1353Schema(),ensureV151Schema(),ensureV165Schema()]);
  const today=todayIso();
  const settingsPromise:Promise<Array<Record<string,unknown>>>=preferencesOverride?Promise.resolve([]):sql`SELECT preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>;
  const[settings,licences,qualifications,expiries]=await Promise.all([
    settingsPromise,
    sql`SELECT licence_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_licences WHERE user_id=${userId} AND active=TRUE` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,qualification_type,qualification_family,regulatory_category,qualification_scope,privilege_role,classification_source,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_qualifications WHERE user_id=${userId} AND active=TRUE` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT label,expiry_date::text expiry_date,warning_days FROM user_expiries WHERE user_id=${userId} AND UPPER(TRIM(category))<>'LICENCE' AND active=1 AND expiry_date<'9999-01-01' ORDER BY expiry_date` as Promise<Array<Record<string,unknown>>>,
  ]);
  const preferences=preferencesOverride??parsePilotPreferences(settings[0]?.preferences_json),customRules=parseCustomRecencyRules(preferences.recency_rules),evidence=parseRecencyEvidence(preferences.recency_evidence),maxDays=Math.max(730,...customRules.map(rule=>rule.windowDays));
  const rows=await sql`SELECT f.date,f.starts,f.evidence,f.aircraft_class,f.role,f.off_block,f.on_block,f.landings_day,f.landings_night,f.movement_evidence_recorded,f.takeoffs_day,f.takeoffs_night,f.approaches_day,f.approaches_night,f.purpose_code,f.task,f.note,a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.verification_role='INSTRUCTOR' AND v.status='signed') instructor_signed,NOT EXISTS(SELECT 1 FROM flight_audit_log created_audit JOIN flytally_feature_migrations movement_migration ON movement_migration.migration_key='v1.35.3-fcl060-structured-movements' WHERE created_audit.flight_id=f.id AND created_audit.user_id=f.user_id AND created_audit.action='created' AND created_audit.changed_at>=movement_migration.applied_at) legacy_movement_candidate FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration)) WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND CASE WHEN f.date~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::date ELSE NULL END>=CURRENT_DATE-(${maxDays}::int*INTERVAL '1 day') ORDER BY f.date DESC,f.id DESC` as Array<Record<string,unknown>>;
  const flights:ServiceRecencyFlight[]=rows.map(row=>{const movement=resolveMovementCompatibility({evidence:row.evidence,movementEvidenceRecorded:row.movement_evidence_recorded,legacyMovementCandidate:row.legacy_movement_candidate,starts:row.starts,landingsDay:row.landings_day,landingsNight:row.landings_night,takeoffsDay:row.takeoffs_day,takeoffsNight:row.takeoffs_night,approachesDay:row.approaches_day,approachesNight:row.approaches_night});return{date:t(row.date).slice(0,10),starts:Number(row.starts)||0,evidence:t(row.evidence),aircraftClass:t(row.aircraft_class),role:t(row.role),minutes:flightMinutes(row.off_block,row.on_block),landingsDay:Number(row.landings_day)||0,landingsNight:Number(row.landings_night)||0,movementEvidenceRecorded:movement.movementEvidenceRecorded,takeoffsDay:movement.takeoffsDay,takeoffsNight:movement.takeoffsNight,approachesDay:movement.approachesDay,approachesNight:movement.approachesNight,legacyMovementInferred:movement.legacyMovementInferred,ullMovementInferred:movement.ullMovementInferred,purposeCode:t(row.purpose_code),task:t(row.task),note:t(row.note),instructorSigned:Boolean(row.instructor_signed),partFclCreditClass:t(row.part_fcl_credit_class),partFclCreditBasis:t(row.part_fcl_credit_basis),partFclCreditFrom:t(row.part_fcl_credit_from).slice(0,10)}});
  const legacyMovementCount=flights.filter(f=>f.legacyMovementInferred).length;
  const hasLapl=licences.some(row=>upper(row.licence_type)==="LAPL(A)"),hasSep=hasLapl||qualifications.some(row=>classForRecord(row)==="SEP"),hasTmg=qualifications.some(row=>classForRecord(row)==="TMG");
  const hasIr=qualifications.some(row=>aeroplaneIr(row)&&currentCredential(row,today)),hasNight=hasIr||qualifications.some(row=>aeroplaneNight(row)&&currentCredential(row,today)),sepRating=ratingForClass(qualifications,"SEP"),tmgRating=ratingForClass(qualifications,"TMG"),combineSepTmg=Boolean(sepRating&&tmgRating);
  const availableMonitors:RecencyMonitor[]=[];
  if(hasLapl)availableMonitors.push({id:"lapl-fcl140a",label:"LAPL(A) flying privileges",detail:"FCL.140.A · rolling 2-year recency / proficiency check"});
  if(hasSep)availableMonitors.push({id:"sep-passenger-day",label:"SEP passenger currency",detail:"FCL.060 · 3 take-offs, approaches and landings as PF"});
  if(hasSep&&hasNight)availableMonitors.push({id:"sep-passenger-night",label:"SEP night passenger currency",detail:hasIr?"FCL.060 · PF movements + current IR":"FCL.060 · PF movements including one at night"});
  if(hasTmg)availableMonitors.push({id:"tmg-passenger-day",label:"TMG passenger currency",detail:"FCL.060 · 3 take-offs, approaches and landings as PF"});
  if(hasTmg&&hasNight)availableMonitors.push({id:"tmg-passenger-night",label:"TMG night passenger currency",detail:hasIr?"FCL.060 · PF movements + current IR":"FCL.060 · PF movements including one at night"});
  if(sepRating)availableMonitors.push({id:"sep-revalidation",label:"SEP class rating revalidation",detail:`FCL.740.A · expiry ${t(sepRating.valid_until).slice(0,10)}`});
  if(tmgRating)availableMonitors.push({id:"tmg-revalidation",label:"TMG class rating revalidation",detail:`FCL.740.A · expiry ${t(tmgRating.valid_until).slice(0,10)}`});
  availableMonitors.push({id:"credential-deadlines",label:"Licence & document deadlines",detail:"Expiry and warning-window monitoring"});
  const savedRaw=preferences.recency_monitors,configured=Array.isArray(savedRaw),savedIds=new Set(configured?(savedRaw as unknown[]).map(value=>t(value)):availableMonitors.map(item=>item.id)),availableIds=new Set(availableMonitors.map(item=>item.id)),enabled=new Set([...savedIds].filter(id=>availableIds.has(id)));
  const evaluations:RecencyEvaluation[]=[];
  if(hasLapl&&enabled.has("lapl-fcl140a"))evaluations.push(evaluateLaplA(flights,today,evidence));
  if(hasSep&&enabled.has("sep-passenger-day"))evaluations.push(evaluatePassengerCurrencyMode(flights,"SEP",hasIr,today,"day"));
  if(hasSep&&hasNight&&enabled.has("sep-passenger-night"))evaluations.push(evaluatePassengerCurrencyMode(flights,"SEP",hasIr,today,"night"));
  if(hasTmg&&enabled.has("tmg-passenger-day"))evaluations.push(evaluatePassengerCurrencyMode(flights,"TMG",hasIr,today,"day"));
  if(hasTmg&&hasNight&&enabled.has("tmg-passenger-night"))evaluations.push(evaluatePassengerCurrencyMode(flights,"TMG",hasIr,today,"night"));
  if(sepRating&&enabled.has("sep-revalidation"))evaluations.push(evaluateClassRevalidation({aircraftClass:"SEP",validUntil:t(sepRating.valid_until).slice(0,10),flights,evidence,today,combineSepTmg,qualificationId:Number(sepRating.id)||0}));
  if(tmgRating&&enabled.has("tmg-revalidation"))evaluations.push(evaluateClassRevalidation({aircraftClass:"TMG",validUntil:t(tmgRating.valid_until).slice(0,10),flights,evidence,today,combineSepTmg,qualificationId:Number(tmgRating.id)||0}));
  evaluations.push(...customRules.map(rule=>evaluateCustomRule(rule,flights,today)));
  for(let index=0;index<evaluations.length;index+=1)evaluations[index]=annotateLegacyMovement(evaluations[index],legacyMovementCount);
  const deadlineItems:RecencyDeadline[]=[...licences.map(row=>({label:t(row.licence_type),state:credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until},today)})),...qualifications.map(row=>({label:t(row.qualification_type),state:credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until},today)})),...expiries.map(row=>({label:t(row.label),state:credentialValidity({mode:"date",validUntil:row.expiry_date,warningDays:row.warning_days},today)}))].filter(item=>item.state.status==="warning"||item.state.status==="expired").sort((a,b)=>(a.state.daysRemaining??99999)-(b.state.daysRemaining??99999));
  const monitorDeadlines=enabled.has("credential-deadlines"),notificationDays=parseRecencyNotificationDays(preferences.recency_notification_days),dueSoonCount=notificationDays?evaluations.filter(item=>item.status==="current"&&item.forecastDate&&daysUntil(today,item.forecastDate)>=0&&daysUntil(today,item.forecastDate)<=notificationDays).length:0,reviewCount=evaluations.filter(item=>item.status!=="current").length+(monitorDeadlines?deadlineItems.length:0),customIds=new Set(customRules.map(rule=>rule.id));
  return{today,preferences,availableMonitors,enabled,evaluations,deadlineItems,monitorDeadlines,reviewCount,dueSoonCount,notificationDays,evidence,customIds};
}

export function recencySnapshotFromState(state:RecencyState):RecencySnapshot{const dates=[...state.evaluations.map(item=>item.forecastDate||item.deadline),...state.deadlineItems.map(item=>item.state.until)].filter((value):value is string=>typeof value==="string"&&value>=state.today).sort(),status:RecencySnapshot["status"]=state.reviewCount?"attention":state.dueSoonCount?"warning":"ok",label=state.reviewCount?`${state.reviewCount} item${state.reviewCount===1?"":"s"} need review`:state.dueSoonCount?`${state.dueSoonCount} item${state.dueSoonCount===1?"":"s"} due soon`:"Recency OK";return{generatedAt:new Date().toISOString(),status,reviewCount:state.reviewCount,dueSoonCount:state.dueSoonCount,nextDate:dates[0],label}}
export async function refreshRecencySnapshot(userId:number){const state=await getRecencyStateForUser(userId),snapshot=recencySnapshotFromState(state),preferences={...state.preferences,recency_snapshot:snapshot};await sql`UPDATE user_settings SET preferences_json=${JSON.stringify(preferences)},updated_at=NOW() WHERE user_id=${userId}`;return snapshot}
function reminderStage(days:number,maxDays:number){
  if(days<0)return"expired";
  const thresholds=[...new Set([maxDays,7,1,0].filter(value=>value>=0&&value<=maxDays))].sort((a,b)=>a-b);
  return String(thresholds.find(value=>days<=value)??maxDays);
}
function reminderTitle(label:string,days:number){
  if(days<0)return`${label} expired`;
  if(days===0)return`${label} due today`;
  if(days===1)return`${label} due tomorrow`;
  return`${label} due in ${days} days`;
}
export function recencyAlertsFromState(state:RecencyState){
  if(!state.notificationDays)return[] as Array<{title:string;body:string;dedupeKey:string}>;
  const alerts:Array<{title:string;body:string;dedupeKey:string}>=[];
  for(const item of state.evaluations){
    const forecastDays=item.forecastDate?daysUntil(state.today,item.forecastDate):Number.POSITIVE_INFINITY,deadlineDays=item.deadline?daysUntil(state.today,item.deadline):Number.POSITIVE_INFINITY;
    if(item.status==="not-current"){
      alerts.push({title:item.title,body:item.summary,dedupeKey:`recency:${item.id}:not-current:${item.deadline||item.summary}`});
    }else if(item.status==="attention"&&deadlineDays<=state.notificationDays){
      const stage=reminderStage(deadlineDays,state.notificationDays);
      alerts.push({title:reminderTitle(item.title,deadlineDays),body:item.summary,dedupeKey:`recency:${item.id}:attention:${stage}:${item.deadline||"unknown"}`});
    }else if(item.status==="current"&&item.forecastDate&&forecastDays>=0&&forecastDays<=state.notificationDays){
      const stage=reminderStage(forecastDays,state.notificationDays);
      alerts.push({title:reminderTitle(item.title,forecastDays),body:`If no new qualifying activity is recorded, the current indication changes on ${item.forecastDate}.`,dedupeKey:`recency:${item.id}:forecast:${stage}:${item.forecastDate}`});
    }
  }
  if(state.monitorDeadlines){
    for(const item of state.deadlineItems){
      const days=item.state.daysRemaining??Number.POSITIVE_INFINITY;
      if(item.state.status==="expired"||days<=state.notificationDays){
        const stage=reminderStage(days,state.notificationDays);
        alerts.push({title:reminderTitle(item.label,days),body:item.state.label,dedupeKey:`recency:deadline:${item.label}:${stage}:${item.state.until||"unknown"}`});
      }
    }
  }
  return alerts;
}
