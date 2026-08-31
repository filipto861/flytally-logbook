import type { CustomRecencyRule,RecencyEvaluation,RecencyEvidence,RecencyFlight } from "./recency-engine.ts";
import { isAnnexCreditForClass,isClassRefresherFlight,rollingDaysStart,rollingYearsStart } from "./recency-engine.ts";

export type RecencyAuditStatus="confirmed"|"limited"|"review";
export type RecencyAuditFlight=RecencyFlight&{id:number;registration:string;departure:string;arrival:string;legacyMovementInferred?:boolean};
export type RecencyAuditRow={id:string;source:"flight"|"evidence"|"credential";date:string;title:string;detail:string;status:RecencyAuditStatus;dropOffDate?:string;href?:string;issue?:string};
export type RecencyAuditBundle={rows:RecencyAuditRow[];totalRows:number;confirmedCount:number;limitedCount:number;issueCount:number};

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();
const utc=(value:string)=>new Date(`${value}T00:00:00Z`);
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(value:string,days:number)=>{const date=utc(value);date.setUTCDate(date.getUTCDate()+days);return iso(date)};
const addMonths=(value:string,months:number)=>{const date=utc(value),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return iso(date)};
const addYears=(value:string,years:number)=>{const date=utc(value),month=date.getUTCMonth(),day=date.getUTCDate();date.setUTCDate(1);date.setUTCFullYear(date.getUTCFullYear()+years);date.setUTCMonth(month);const last=new Date(Date.UTC(date.getUTCFullYear(),month+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return iso(date)};
const classKey=(value:unknown)=>{const text=upper(value);if(text.startsWith("SEP"))return"SEP";if(text.startsWith("TMG"))return"TMG";if(text.startsWith("ULL"))return"ULL";return text};
const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(upper(role));
const picRole=(role:unknown)=>["PIC","SOLO","INSTRUCTOR","EXAMINER"].includes(upper(role));
const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));
const laplExperienceRole=(flight:RecencyFlight)=>upper(flight.role)==="PIC"||(["DUAL","SOLO"].includes(upper(flight.role))&&Boolean(flight.instructorSigned));
const laplAuditEligible=(flight:RecencyFlight)=>upper(flight.evidence)==="ULL"?upper(flight.role)==="PIC"&&(isAnnexCreditForClass(flight,"SEP")||isAnnexCreditForClass(flight,"TMG")):["SEP","TMG"].includes(classKey(flight.aircraftClass))&&laplExperienceRole(flight);
const legacyRefresher=(flight:RecencyFlight)=>/(FCL[.]140[.]A|LAPL\s+recency|recency\s+training|refresher\s+training)/i.test(`${flight.task??""} ${flight.note??""}`);
const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&classKey(flight.aircraftClass)!=="ULL"&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));
const hm=(minutes:number)=>`${Math.floor(Math.max(0,minutes)/60)}:${String(Math.max(0,minutes)%60).padStart(2,"0")}`;
const count=(value:unknown)=>Math.max(0,Number(value)||0);
const landings=(flight:RecencyFlight,nightOnly=false)=>nightOnly?count(flight.landingsNight):count(flight.landingsDay)+count(flight.landingsNight);
const movement=(flight:RecencyFlight,kind:"takeoff"|"approach"|"landing",nightOnly=false)=>kind==="takeoff"?(nightOnly?count(flight.takeoffsNight):count(flight.takeoffsDay)+count(flight.takeoffsNight)):kind==="approach"?(nightOnly?count(flight.approachesNight):count(flight.approachesDay)+count(flight.approachesNight)):landings(flight,nightOnly);
const flightTitle=(flight:RecencyAuditFlight)=>`${flight.registration||flight.aircraftClass||"Flight"} · ${flight.departure||"?"} → ${flight.arrival||"?"}`;
const flightHref=(flight:RecencyAuditFlight)=>flight.id>0?`/flights/${flight.id}`:undefined;
const plural=(value:number,label:string)=>`${value} ${label}${value===1?"":"s"}`;

export function movementEvidenceIssue(flight:RecencyFlight){
  if(!flight.movementEvidenceRecorded)return"";
  const takeoffs=movement(flight,"takeoff"),approaches=movement(flight,"approach"),landingCount=movement(flight,"landing"),issues:string[]=[];
  if(takeoffs===0&&approaches===0&&landingCount===0)issues.push("Movement evidence is marked as recorded but all counters are zero");
  if(takeoffs!==landingCount)issues.push(`Take-offs (${takeoffs}) and landings (${landingCount}) do not reconcile`);
  if(approaches<landingCount)issues.push(`Approaches (${approaches}) are lower than landings (${landingCount})`);
  return issues.join(" · ");
}

function bundle(rows:RecencyAuditRow[]):RecencyAuditBundle{
  const rank:Record<RecencyAuditStatus,number>={review:0,limited:1,confirmed:2},ordered=[...rows].sort((a,b)=>rank[a.status]-rank[b.status]||b.date.localeCompare(a.date)),totalRows=ordered.length;
  return{rows:ordered.slice(0,30),totalRows,confirmedCount:ordered.filter(row=>row.status==="confirmed").length,limitedCount:ordered.filter(row=>row.status==="limited").length,issueCount:ordered.filter(row=>row.status==="review").length};
}

function laplAudit(flights:RecencyAuditFlight[],evidence:RecencyEvidence[],today:string){
  const start=rollingYearsStart(today,2),eligible=flights.filter(f=>f.date>=start&&f.date<=today&&laplRole(f.role)&&laplAuditEligible(f));
  const rows:RecencyAuditRow[]=eligible.map(f=>{const landingCount=landings(f),refresher=isLaplRefresher(f),legacy=f.legacyMovementInferred?" · legacy PF movements reconstructed":"";return{id:`flight:${f.id}`,source:"flight",date:f.date,title:flightTitle(f),detail:`${hm(f.minutes)} flight time · ${plural(landingCount,"landing")} · ${upper(f.role)} · ${upper(f.evidence)}${legacy}${refresher?" · signed FI refresher":""}`,status:"confirmed",dropOffDate:addDays(addYears(f.date,2),1),href:flightHref(f)}});
  for(const item of evidence.filter(item=>item.kind==="LAPL_PROFICIENCY_CHECK"&&item.date>=start&&item.date<=today))rows.push({id:`evidence:${item.id}`,source:"evidence",date:item.date,title:"LAPL(A) proficiency check",detail:`${item.aircraftClass} · ${item.signer} · ${item.reference}`,status:"confirmed",dropOffDate:addDays(addYears(item.date,2),1)});
  return bundle(rows);
}

function fcl060Audit(evaluation:RecencyEvaluation,flights:RecencyAuditFlight[],today:string){
  const match=/^fcl060-(sep|tmg)-(day|night)$/.exec(evaluation.id),aircraftClass=match?.[1]?.toUpperCase(),mode=match?.[2];if(!aircraftClass||!mode)return bundle([]);
  const start=rollingDaysStart(today,90),window=flights.filter(f=>f.date>=start&&f.date<=today&&classKey(f.aircraftClass)===aircraftClass&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL"),rows:RecencyAuditRow[]=[],landingIndicator=Boolean(evaluation.meta?.landingIndicator);
  for(const f of window){
    const takeoffs=movement(f,"takeoff"),approaches=movement(f,"approach"),landingCount=landings(f),nightTakeoffs=movement(f,"takeoff",true),nightApproaches=movement(f,"approach",true),nightCount=landings(f,true);
    if(landingIndicator){if(!landingCount)continue;const nightDetail=mode==="night"?` · ${plural(nightCount,"night landing")}`:"";rows.push({id:`flight:${f.id}`,source:"flight",date:f.date,title:flightTitle(f),detail:`${plural(landingCount,"landing")}${nightDetail} · ${upper(f.role)}`,status:"confirmed",dropOffDate:addDays(f.date,90),href:flightHref(f)});continue}
    if(takeoffs+approaches+landingCount===0)continue;
    const structured=Boolean(f.movementEvidenceRecorded),consistencyIssue=structured?movementEvidenceIssue(f):"",status:RecencyAuditStatus=!structured?"limited":consistencyIssue?"review":"confirmed",legacy=f.legacyMovementInferred?" · legacy landing compatibility":"",nightDetail=mode==="night"?` · night ${nightTakeoffs} T/O · ${nightApproaches} approach${nightApproaches===1?"":"es"} · ${nightCount} landing${nightCount===1?"":"s"}`:"",issue=!structured?"Take-off and approach evidence is unavailable for this certified structured-era flight":consistencyIssue||undefined;
    rows.push({id:`flight:${f.id}`,source:"flight",date:f.date,title:flightTitle(f),detail:`${plural(takeoffs,"take-off")} · ${plural(approaches,"approach")} · ${plural(landingCount,"landing")}${nightDetail} · ${upper(f.role)}${legacy}`,status,dropOffDate:addDays(f.date,90),href:flightHref(f),issue});
  }
  if(mode==="night"&&Boolean(evaluation.meta?.irExemption))rows.push({id:"credential:ir",source:"credential",date:today,title:"Current IR",detail:"Current IR is included in the night planning indicator.",status:"confirmed"});
  return bundle(rows);
}

function classRevalidationAudit(evaluation:RecencyEvaluation,flights:RecencyAuditFlight[],evidence:RecencyEvidence[],today:string){
  const match=/^fcl740a-(sep|tmg)$/.exec(evaluation.id),aircraftClass=match?.[1]?.toUpperCase(),validUntil=evaluation.deadline;if(!aircraftClass||!validUntil)return bundle([]);
  const start=addMonths(validUntil,-12),checkStart=addMonths(validUntil,-3),combineSepTmg=Boolean(evaluation.meta?.combineSepTmg),eligibleClasses=combineSepTmg?["SEP","TMG"]:[aircraftClass],window=flights.filter(f=>f.date>=start&&f.date<=today&&eligibleClasses.some(value=>upper(f.evidence)==="ULL"?isAnnexCreditForClass(f,value):classKey(f.aircraftClass)===value)&&pilotFlyingRole(f.role)&&(upper(f.evidence)!=="ULL"||upper(f.role)==="PIC")),rows:RecencyAuditRow[]=window.map(f=>{const refresher=isClassRefresherFlight(f),legacy=f.legacyMovementInferred?" · legacy PF movements reconstructed":"";return{id:`flight:${f.id}`,source:"flight",date:f.date,title:flightTitle(f),detail:`${hm(f.minutes)} flight time · ${plural(landings(f),"landing")} · ${upper(f.role)} · ${upper(f.evidence)}${picRole(f.role)?" · PIC credit":""}${legacy}${refresher?" · signed FI / CRI refresher":""}`,status:"confirmed",dropOffDate:validUntil,href:flightHref(f)}});
  for(const item of evidence.filter(item=>eligibleClasses.includes(item.aircraftClass)&&item.date>=start&&item.date<=today)){if(item.kind==="CLASS_REFRESHER")rows.push({id:`evidence:${item.id}`,source:"evidence",date:item.date,title:"External / historical FI / CRI refresher",detail:`${hm(item.minutes)} · ${item.signer} · ${item.reference}`,status:"confirmed",dropOffDate:validUntil});if(item.kind==="CLASS_REFRESHER_EXEMPTION")rows.push({id:`evidence:${item.id}`,source:"evidence",date:item.date,title:"FCL.740.A refresher exemption",detail:`${item.signer} · ${item.reference}${item.note?` · ${item.note}`:""}`,status:"confirmed",dropOffDate:validUntil});if(item.kind==="CLASS_PROFICIENCY_CHECK"&&item.aircraftClass===aircraftClass&&item.date>=checkStart)rows.push({id:`evidence:${item.id}`,source:"evidence",date:item.date,title:"Class proficiency check",detail:`${item.signer} · ${item.reference}`,status:"confirmed",dropOffDate:validUntil})}
  return bundle(rows);
}

export function buildRecencyAudit(evaluation:RecencyEvaluation,flights:RecencyAuditFlight[],evidence:RecencyEvidence[],today:string):RecencyAuditBundle{
  if(evaluation.id==="lapl-a-fcl140a")return laplAudit(flights,evidence,today);
  if(evaluation.id.startsWith("fcl060-"))return fcl060Audit(evaluation,flights,today);
  if(evaluation.id.startsWith("fcl740a-"))return classRevalidationAudit(evaluation,flights,evidence,today);
  return bundle([]);
}

export function buildCustomRecencyAudit(rule:CustomRecencyRule,flights:RecencyAuditFlight[],today:string):RecencyAuditBundle{
  const start=rollingDaysStart(today,rule.windowDays),filtered=flights.filter(f=>f.date>=start&&f.date<=today&&(rule.evidence==="ANY"||upper(f.evidence)===rule.evidence)&&(rule.aircraftClass==="ANY"||classKey(f.aircraftClass)===classKey(rule.aircraftClass))&&(rule.role==="ANY"||upper(f.role)===rule.role)),rows:RecencyAuditRow[]=[];
  for(const f of filtered){let detail="";if(rule.metric==="flight_hours")detail=`${hm(f.minutes)} flight time`;else if(rule.metric==="pic_hours"){if(!picRole(f.role))continue;detail=`${hm(f.minutes)} PIC time`}else if(rule.metric==="flights")detail="1 qualifying flight";else if(rule.metric==="landings"){const value=landings(f);if(!value)continue;detail=plural(value,"landing")}else{const value=landings(f,true);if(!value)continue;detail=plural(value,"night landing")};rows.push({id:`flight:${f.id}`,source:"flight",date:f.date,title:flightTitle(f),detail:`${detail} · ${upper(f.role)} · ${upper(f.evidence)}`,status:"confirmed",dropOffDate:addDays(f.date,rule.windowDays),href:flightHref(f)})}
  return bundle(rows);
}
