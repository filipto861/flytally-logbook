export type RecencyStatus="current"|"attention"|"not-current";
export type RecencyUnit="hours"|"count";
export type RecencyFlight={date:string;evidence:string;aircraftClass:string;role:string;minutes:number;landingsDay:number;landingsNight:number;movementEvidenceRecorded?:boolean;takeoffsDay?:number;takeoffsNight?:number;approachesDay?:number;approachesNight?:number;purposeCode?:string;task?:string;note?:string;instructorSigned?:boolean};
export type RecencyRequirement={id:string;label:string;current:number;target:number;unit:RecencyUnit;met:boolean};
export type RecencyEvaluation={id:string;code:string;title:string;status:RecencyStatus;summary:string;windowLabel:string;requirements:RecencyRequirement[];note?:string;forecastDate?:string;deadline?:string;badge?:string;meta?:Record<string,number|string|boolean>};
export type CustomRecencyMetric="flight_hours"|"pic_hours"|"flights"|"landings"|"night_landings";
export type CustomRecencyRule={id:string;label:string;windowDays:number;metric:CustomRecencyMetric;target:number;evidence:"ANY"|"EASA"|"ULL";aircraftClass:string;role:string};
export type RecencyEvidenceKind="LAPL_PROFICIENCY_CHECK"|"CLASS_PROFICIENCY_CHECK"|"CLASS_REFRESHER";
export type RecencyEvidence={id:string;kind:RecencyEvidenceKind;aircraftClass:"SEP"|"TMG";date:string;minutes:number;signer:string;reference:string;note:string};

const upper=(v:unknown)=>String(v??"").trim().toUpperCase();
const iso=(v:unknown)=>String(v??"").slice(0,10);
const utc=(value:string)=>new Date(`${value}T00:00:00Z`);
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const rounded=(value:number)=>Math.round(value*100)/100;
const validIso=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(utc(value).getTime());
const addDays=(value:string,days:number)=>{const d=utc(value);d.setUTCDate(d.getUTCDate()+days);return isoDate(d)};
const addMonths=(value:string,months:number)=>{const d=utc(value),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return isoDate(d)};
const addYears=(value:string,years:number)=>{const d=utc(value),month=d.getUTCMonth(),day=d.getUTCDate();d.setUTCDate(1);d.setUTCFullYear(d.getUTCFullYear()+years);d.setUTCMonth(month);const last=new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return isoDate(d)};

export function flightMinutes(offBlock:unknown,onBlock:unknown){
  const parse=(value:unknown)=>{const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value??""));return match?Number(match[1])*60+Number(match[2]):null};
  const from=parse(offBlock),to=parse(onBlock);if(from===null||to===null)return 0;return (to-from+1440)%1440;
}
export function rollingDaysStart(today:string,days:number){const d=utc(iso(today));d.setUTCDate(d.getUTCDate()-(Math.max(1,Math.round(days))-1));return isoDate(d)}
export function rollingYearsStart(today:string,years:number){const d=utc(iso(today));d.setUTCFullYear(d.getUTCFullYear()-Math.max(1,Math.round(years)));return isoDate(d)}
export function daysBetween(from:string,to:string){return Math.ceil((utc(to).getTime()-utc(from).getTime())/86400000)}
const within=(flight:RecencyFlight,start:string,today:string)=>flight.date>=start&&flight.date<=today;
const classKey=(value:unknown)=>{const v=upper(value);if(v.startsWith("SEP"))return"SEP";if(v.startsWith("TMG"))return"TMG";if(v.startsWith("ULL"))return"ULL";return v};
const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(upper(role));
const picRole=(role:unknown)=>["PIC","SOLO","INSTRUCTOR","EXAMINER"].includes(upper(role));
const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));
const legacyRefresher=(flight:RecencyFlight)=>/(FCL[.]140[.]A|LAPL\s+recency|recency\s+training|refresher\s+training)/i.test(`${flight.task??""} ${flight.note??""}`);
const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&classKey(flight.aircraftClass)!=="ULL"&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));
const requirement=(id:string,label:string,current:number,target:number,unit:RecencyUnit):RecencyRequirement=>({id,label,current:rounded(current),target,unit,met:current>=target});
const durationText=(hours:number)=>{const minutes=Math.max(0,Math.ceil(hours*60));return`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`};
const missingSummary=(requirements:RecencyRequirement[])=>requirements.filter(item=>!item.met).map(item=>`${item.label}: ${item.unit==="hours"?durationText(item.target-item.current):Math.max(0,Math.ceil(item.target-item.current))} remaining`).join(" · ");
type Contribution={date:string;value:number};
function contributionForecast(items:Contribution[],target:number,expiryForDate:(date:string)=>string){let total=0;for(const item of [...items].sort((a,b)=>b.date.localeCompare(a.date))){total+=Math.max(0,item.value);if(total>=target)return expiryForDate(item.date)}return undefined}
const landingContributions=(flights:RecencyFlight[],nightOnly=false)=>flights.flatMap(f=>{const count=Math.max(0,nightOnly?f.landingsNight:f.landingsDay+f.landingsNight);return count?[{date:f.date,value:count}]:[]});
const minuteContributions=(flights:RecencyFlight[])=>flights.filter(f=>f.minutes>0).map(f=>({date:f.date,value:f.minutes}));
const movementCount=(flight:RecencyFlight,metric:"takeoff"|"approach"|"landing",nightOnly=false)=>metric==="takeoff"?Math.max(0,nightOnly?Number(flight.takeoffsNight)||0:(Number(flight.takeoffsDay)||0)+(Number(flight.takeoffsNight)||0)):metric==="approach"?Math.max(0,nightOnly?Number(flight.approachesNight)||0:(Number(flight.approachesDay)||0)+(Number(flight.approachesNight)||0)):Math.max(0,nightOnly?flight.landingsNight:flight.landingsDay+flight.landingsNight);
const movementContributions=(flights:RecencyFlight[],metric:"takeoff"|"approach"|"landing",nightOnly=false)=>flights.flatMap(f=>{const value=movementCount(f,metric,nightOnly);return value?[{date:f.date,value}]:[]});

export function parseRecencyEvidence(value:unknown):RecencyEvidence[]{
  let raw:unknown=value;if(typeof raw==="string"){try{raw=JSON.parse(raw)}catch{return[]}}if(!Array.isArray(raw))return[];
  const kinds=new Set<RecencyEvidenceKind>(["LAPL_PROFICIENCY_CHECK","CLASS_PROFICIENCY_CHECK","CLASS_REFRESHER"]),seen=new Set<string>(),out:RecencyEvidence[]=[];
  for(const item of raw){if(!item||typeof item!=="object")continue;const v=item as Record<string,unknown>,id=String(v.id??"").trim().slice(0,80),kind=upper(v.kind) as RecencyEvidenceKind,aircraftClass=classKey(v.aircraftClass),date=iso(v.date),signer=String(v.signer??"").trim().slice(0,120),reference=String(v.reference??"").trim().slice(0,120),note=String(v.note??"").trim().slice(0,300),minutes=clamp(Math.round(Number(v.minutes)||0),0,1440);if(!id||seen.has(id)||!kinds.has(kind)||!["SEP","TMG"].includes(aircraftClass)||!validIso(date)||!signer||!reference)continue;seen.add(id);out.push({id,kind,aircraftClass:aircraftClass as "SEP"|"TMG",date,minutes,signer,reference,note});if(out.length>=50)break}return out.sort((a,b)=>b.date.localeCompare(a.date));
}

export function evaluateLaplMetrics(input:{flightMinutes:number;landings:number;refresherMinutes:number;ullMinutes?:number;ullLandings?:number}):RecencyEvaluation{
  const requirements=[requirement("flight-time","Flight time",input.flightMinutes/60,12,"hours"),requirement("landings","Take-offs / landings",input.landings,12,"count"),requirement("refresher","Instructor refresher",input.refresherMinutes/60,1,"hours")];
  const current=requirements.every(item=>item.met);
  return{id:"lapl-a-fcl140a",code:"FCL.140.A",title:"LAPL(A) flying privileges",status:current?"current":"not-current",summary:current?"Current on the rolling 2-year experience route":`Remaining — ${missingSummary(requirements)}`,windowLabel:"Rolling 2 years",requirements,note:"FlyTally uses certified logbook records. A passed LAPL(A) proficiency check with an examiner is an alternative route.",meta:{ullMinutes:input.ullMinutes??0,ullLandings:input.ullLandings??0}};
}
export function evaluateLaplA(flights:RecencyFlight[],today:string,evidence:RecencyEvidence[]=[]):RecencyEvaluation{
  const start=rollingYearsStart(today,2),window=flights.filter(f=>within(f,start,today));
  const eligible=window.filter(f=>laplRole(f.role)&&(classKey(f.aircraftClass)==="SEP"||classKey(f.aircraftClass)==="TMG"||(upper(f.evidence)==="ULL"&&classKey(f.aircraftClass)==="ULL")));
  const ull=eligible.filter(f=>upper(f.evidence)==="ULL"&&classKey(f.aircraftClass)==="ULL"),refresher=window.filter(isLaplRefresher);
  const base=evaluateLaplMetrics({flightMinutes:eligible.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),landings:eligible.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),refresherMinutes:refresher.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullMinutes:ull.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullLandings:ull.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0)});
  const experienceForecast=base.status==="current"?[contributionForecast(minuteContributions(eligible),720,date=>addDays(addYears(date,2),1)),contributionForecast(landingContributions(eligible),12,date=>addDays(addYears(date,2),1)),contributionForecast(minuteContributions(refresher),60,date=>addDays(addYears(date,2),1))].filter((value):value is string=>Boolean(value)).sort()[0]:undefined;
  const latestCheck=evidence.filter(item=>item.kind==="LAPL_PROFICIENCY_CHECK"&&item.date>=start&&item.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0],checkForecast=latestCheck?addDays(addYears(latestCheck.date,2),1):undefined;
  if(latestCheck){const forecasts=[experienceForecast,checkForecast].filter((value):value is string=>Boolean(value)).sort(),forecast=base.status==="current"?forecasts.at(-1):checkForecast;return{...base,status:"current",badge:"CURRENT",summary:`Current via LAPL(A) proficiency check passed ${latestCheck.date}`,forecastDate:forecast,note:`Examiner evidence: ${latestCheck.signer} · ${latestCheck.reference}. User-declared evidence; authority records remain controlling.`,meta:{...(base.meta??{}),proficiencyCheck:true}}}
  return{...base,forecastDate:experienceForecast};
}

export function evaluatePassengerCurrencyMode(flights:RecencyFlight[],aircraftClass:"SEP"|"TMG",hasIr:boolean,today:string,mode:"day"|"night"):RecencyEvaluation{
  const start=rollingDaysStart(today,90),window=flights.filter(f=>within(f,start,today)&&classKey(f.aircraftClass)===aircraftClass&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL"),recorded=window.filter(f=>Boolean(f.movementEvidenceRecorded)),incomplete=window.length-recorded.length;
  const takeoffs=recorded.reduce((sum,f)=>sum+movementCount(f,"takeoff"),0),approaches=recorded.reduce((sum,f)=>sum+movementCount(f,"approach"),0),landings=recorded.reduce((sum,f)=>sum+movementCount(f,"landing"),0),nightTakeoffs=recorded.reduce((sum,f)=>sum+movementCount(f,"takeoff",true),0),nightApproaches=recorded.reduce((sum,f)=>sum+movementCount(f,"approach",true),0),nightLandings=recorded.reduce((sum,f)=>sum+movementCount(f,"landing",true),0);
  const base=[requirement("takeoffs","Take-offs",takeoffs,3,"count"),requirement("approaches","Approaches",approaches,3,"count"),requirement("landings","Landings",landings,3,"count")],night=hasIr?[requirement("ir-exemption","IR exemption",1,1,"count")]:[requirement("night-takeoffs","Night take-offs",nightTakeoffs,1,"count"),requirement("night-approaches","Night approaches",nightApproaches,1,"count"),requirement("night-landings","Night landings",nightLandings,1,"count")],requirements=mode==="day"?base:[...base,...night],met=requirements.every(item=>item.met);
  const missingData=!met&&incomplete>0,status:RecencyStatus=met?"current":missingData?"attention":"not-current";
  const forecastDate=met?[contributionForecast(movementContributions(recorded,"takeoff"),3,date=>addDays(date,90)),contributionForecast(movementContributions(recorded,"approach"),3,date=>addDays(date,90)),contributionForecast(movementContributions(recorded,"landing"),3,date=>addDays(date,90)),...(mode==="night"&&!hasIr?[contributionForecast(movementContributions(recorded,"takeoff",true),1,date=>addDays(date,90)),contributionForecast(movementContributions(recorded,"approach",true),1,date=>addDays(date,90)),contributionForecast(movementContributions(recorded,"landing",true),1,date=>addDays(date,90))]:[])].filter((value):value is string=>Boolean(value)).sort()[0]:undefined;
  const title=mode==="day"?`${aircraftClass} passenger currency`:`${aircraftClass} night passenger currency`,summary=met?(mode==="night"&&hasIr?"Passenger currency recorded · current IR satisfies the additional night requirement":"Take-offs, approaches and landings recorded for the required 90-day window"):missingData?`Limited data · ${incomplete} certified flight${incomplete===1?"":"s"} in the window lack structured movement evidence`:`Remaining — ${missingSummary(requirements)}`;
  return{id:`fcl060-${aircraftClass.toLowerCase()}-${mode}`,code:"FCL.060",title,status,summary,windowLabel:"Preceding 90 days",requirements,forecastDate,badge:missingData?"LIMITED DATA":met?"CURRENT":undefined,note:"Record-based indicator uses certified flights with explicit take-off, approach and landing evidence. Older flights without structured movement evidence are not inferred. FFS events are not currently captured in FlyTally.",meta:{takeoffs,approaches,landings,nightTakeoffs,nightApproaches,nightLandings,incompleteMovementFlights:incomplete,irExemption:hasIr}};
}
export function evaluatePassengerCurrency(flights:RecencyFlight[],aircraftClass:"SEP"|"TMG",hasIr:boolean,today:string):RecencyEvaluation{
  const day=evaluatePassengerCurrencyMode(flights,aircraftClass,hasIr,today,"day"),night=evaluatePassengerCurrencyMode(flights,aircraftClass,hasIr,today,"night"),status:RecencyStatus=day.status==="current"?(night.status==="current"?"current":"attention"):day.status;
  return{id:`fcl060-${aircraftClass.toLowerCase()}`,code:"FCL.060",title:`${aircraftClass} passenger currency`,status,summary:day.status==="current"?(night.status==="current"?"Day and night passenger currency current":"Day current · night needs review"):day.summary,windowLabel:"Preceding 90 days",requirements:[...day.requirements,...night.requirements],forecastDate:day.forecastDate,note:day.note,meta:day.meta};
}

export function evaluateClassRevalidation(input:{aircraftClass:"SEP"|"TMG";validUntil:string;flights:RecencyFlight[];evidence?:RecencyEvidence[];today:string}):RecencyEvaluation{
  const{aircraftClass,validUntil,today}=input,evidence=input.evidence??[],title=`${aircraftClass} class rating revalidation`,id=`fcl740a-${aircraftClass.toLowerCase()}`;
  if(!validIso(validUntil))return{id,code:"FCL.740.A",title,status:"attention",badge:"DATE NEEDED",summary:"Add the class-rating expiry date to calculate revalidation",windowLabel:"Rating validity",requirements:[],note:"FlyTally cannot calculate FCL.740.A revalidation without the rating expiry date."};
  const experienceStart=addMonths(validUntil,-12),checkStart=addMonths(validUntil,-3);
  if(today>validUntil)return{id,code:"FCL.740.A",title,status:"not-current",badge:"EXPIRED",summary:`Saved rating validity ended ${validUntil}`,windowLabel:`Expiry ${validUntil}`,deadline:validUntil,requirements:[],note:"Update the qualification after revalidation or renewal. FlyTally does not extend a rating automatically from user-entered evidence."};
  if(today<experienceStart)return{id,code:"FCL.740.A",title,status:"current",badge:"UPCOMING",summary:`Experience route opens ${experienceStart}`,windowLabel:`Expiry ${validUntil}`,deadline:validUntil,requirements:[],note:"The experience route is assessed in the 12 months preceding expiry; the proficiency-check route is available in the final 3 months."};
  const window=input.flights.filter(f=>f.date>=experienceStart&&f.date<=today&&classKey(f.aircraftClass)===aircraftClass&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL"),pic=window.filter(f=>picRole(f.role));
  const refreshers=evidence.filter(item=>item.kind==="CLASS_REFRESHER"&&item.aircraftClass===aircraftClass&&item.date>=experienceStart&&item.date<=today),refresherMinutes=refreshers.reduce((sum,item)=>sum+item.minutes,0);
  const requirements=[requirement("flight-time","Flight time",window.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60,12,"hours"),requirement("pic-time","PIC time",pic.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60,6,"hours"),requirement("landings","Landings",window.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),12,"count"),requirement("refresher","FI / CRI refresher",refresherMinutes/60,1,"hours")];
  const check=evidence.find(item=>item.kind==="CLASS_PROFICIENCY_CHECK"&&item.aircraftClass===aircraftClass&&item.date>=checkStart&&item.date<=today&&item.date<=validUntil);
  if(check)return{id,code:"FCL.740.A",title,status:"current",badge:"READY",summary:`Proficiency check recorded ${check.date}`,windowLabel:`Expiry ${validUntil}`,deadline:validUntil,requirements:[requirement("proficiency-check","Proficiency check",1,1,"count")],note:`Examiner evidence: ${check.signer} · ${check.reference}. Update the rating validity after the authority/licence entry is completed.`};
  const met=requirements.every(item=>item.met);
  return{id,code:"FCL.740.A",title,status:met?"current":"attention",badge:met?"READY":"IN PROGRESS",summary:met?"Experience-route requirements recorded":`Remaining — ${missingSummary(requirements)}`,windowLabel:`Final 12 months · expiry ${validUntil}`,deadline:validUntil,requirements,note:"Planning indicator: FlyTally records landings but not take-offs separately for this older FCL.740.A workflow. Refresher training must be added as structured evidence; authority records remain controlling."};
}

const metricSet=new Set<CustomRecencyMetric>(["flight_hours","pic_hours","flights","landings","night_landings"]);
export function parseCustomRecencyRules(value:unknown):CustomRecencyRule[]{
  let raw:unknown=value;if(typeof raw==="string"){try{raw=JSON.parse(raw)}catch{return[]}}if(!Array.isArray(raw))return[];
  const seen=new Set<string>(),out:CustomRecencyRule[]=[];
  for(const item of raw){if(!item||typeof item!=="object")continue;const v=item as Record<string,unknown>,id=String(v.id??"").trim().slice(0,80),label=String(v.label??"").trim().slice(0,80),metric=String(v.metric??"") as CustomRecencyMetric,target=Number(v.target);if(!id||!label||seen.has(id)||!metricSet.has(metric)||!Number.isFinite(target)||target<=0)continue;seen.add(id);out.push({id,label,metric,target:clamp(target,.01,10000),windowDays:clamp(Math.round(Number(v.windowDays)||90),1,3650),evidence:["EASA","ULL"].includes(upper(v.evidence))?upper(v.evidence) as "EASA"|"ULL":"ANY",aircraftClass:(upper(v.aircraftClass)||"ANY").slice(0,30),role:(upper(v.role)||"ANY").slice(0,30)});if(out.length>=20)break}return out;
}
export function evaluateCustomRule(rule:CustomRecencyRule,flights:RecencyFlight[],today:string):RecencyEvaluation{
  const start=rollingDaysStart(today,rule.windowDays),filtered=flights.filter(f=>within(f,start,today)&&(rule.evidence==="ANY"||upper(f.evidence)===rule.evidence)&&(rule.aircraftClass==="ANY"||classKey(f.aircraftClass)===classKey(rule.aircraftClass))&&(rule.role==="ANY"||upper(f.role)===rule.role));
  let current=0,contributions:Contribution[]=[];if(rule.metric==="flight_hours"){current=filtered.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60;contributions=filtered.map(f=>({date:f.date,value:Math.max(0,f.minutes)/60}))}else if(rule.metric==="pic_hours"){const rows=filtered.filter(f=>picRole(f.role));current=rows.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60;contributions=rows.map(f=>({date:f.date,value:Math.max(0,f.minutes)/60}))}else if(rule.metric==="flights"){current=filtered.length;contributions=filtered.map(f=>({date:f.date,value:1}))}else if(rule.metric==="landings"){current=filtered.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0);contributions=landingContributions(filtered)}else{current=filtered.reduce((sum,f)=>sum+Math.max(0,f.landingsNight),0);contributions=landingContributions(filtered,true)}
  const unit:RecencyUnit=rule.metric.endsWith("hours")?"hours":"count",req=requirement("custom",rule.label,current,rule.target,unit),met=req.met,forecastDate=met?contributionForecast(contributions,rule.target,date=>addDays(date,rule.windowDays)):undefined;
  return{id:rule.id,code:"CUSTOM",title:rule.label,status:met?"current":"not-current",summary:met?"Requirement met":`Remaining — ${unit==="hours"?durationText(rule.target-current):Math.max(0,Math.ceil(rule.target-current))}`,windowLabel:`Rolling ${rule.windowDays} days`,requirements:[req],forecastDate,note:[rule.evidence!=="ANY"?rule.evidence:"",rule.aircraftClass!=="ANY"?rule.aircraftClass:"",rule.role!=="ANY"?rule.role:""].filter(Boolean).join(" · ")||"All certified flight records"};
}
