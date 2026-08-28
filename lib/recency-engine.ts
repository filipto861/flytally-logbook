export type RecencyStatus="current"|"attention"|"not-current";
export type RecencyUnit="hours"|"count";
export type RecencyFlight={date:string;evidence:string;aircraftClass:string;role:string;minutes:number;landingsDay:number;landingsNight:number;purposeCode?:string;task?:string;note?:string;instructorSigned?:boolean};
export type RecencyRequirement={id:string;label:string;current:number;target:number;unit:RecencyUnit;met:boolean};
export type RecencyEvaluation={id:string;code:string;title:string;status:RecencyStatus;summary:string;windowLabel:string;requirements:RecencyRequirement[];note?:string;meta?:Record<string,number|string|boolean>};
export type CustomRecencyMetric="flight_hours"|"pic_hours"|"flights"|"landings"|"night_landings";
export type CustomRecencyRule={id:string;label:string;windowDays:number;metric:CustomRecencyMetric;target:number;evidence:"ANY"|"EASA"|"ULL";aircraftClass:string;role:string};

const upper=(v:unknown)=>String(v??"").trim().toUpperCase();
const iso=(v:unknown)=>String(v??"").slice(0,10);
const utc=(value:string)=>new Date(`${value}T00:00:00Z`);
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const rounded=(value:number)=>Math.round(value*100)/100;

export function flightMinutes(offBlock:unknown,onBlock:unknown){
  const parse=(value:unknown)=>{const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value??""));return match?Number(match[1])*60+Number(match[2]):null};
  const from=parse(offBlock),to=parse(onBlock);if(from===null||to===null)return 0;return (to-from+1440)%1440;
}
export function rollingDaysStart(today:string,days:number){const d=utc(iso(today));d.setUTCDate(d.getUTCDate()-(Math.max(1,Math.round(days))-1));return isoDate(d)}
export function rollingYearsStart(today:string,years:number){const d=utc(iso(today));d.setUTCFullYear(d.getUTCFullYear()-Math.max(1,Math.round(years)));return isoDate(d)}
const within=(flight:RecencyFlight,start:string,today:string)=>flight.date>=start&&flight.date<=today;
const classKey=(value:unknown)=>{const v=upper(value);if(v.startsWith("SEP"))return"SEP";if(v.startsWith("TMG"))return"TMG";if(v.startsWith("ULL"))return"ULL";return v};
const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS"].includes(upper(role));
const laplRole=(role:unknown)=>["PIC","DUAL","SOLO"].includes(upper(role));
const legacyRefresher=(flight:RecencyFlight)=>/(FCL[.]140[.]A|LAPL\s+recency|recency\s+training|refresher\s+training)/i.test(`${flight.task??""} ${flight.note??""}`);
const isLaplRefresher=(flight:RecencyFlight)=>Boolean(flight.instructorSigned)&&upper(flight.role)==="DUAL"&&classKey(flight.aircraftClass)!=="ULL"&&(upper(flight.purposeCode)==="LAPL_FCL140A_REFRESHER"||(!String(flight.purposeCode??"").trim()&&legacyRefresher(flight)));
const requirement=(id:string,label:string,current:number,target:number,unit:RecencyUnit):RecencyRequirement=>({id,label,current:rounded(current),target,unit,met:current>=target});
const missingSummary=(requirements:RecencyRequirement[])=>requirements.filter(item=>!item.met).map(item=>`${item.label}: ${item.unit==="hours"?rounded(item.target-item.current)+" h":Math.max(0,Math.ceil(item.target-item.current))}`).join(" · ");

export function evaluateLaplMetrics(input:{flightMinutes:number;landings:number;refresherMinutes:number;ullMinutes?:number;ullLandings?:number}):RecencyEvaluation{
  const requirements=[requirement("flight-time","Flight time",input.flightMinutes/60,12,"hours"),requirement("landings","Take-offs / landings",input.landings,12,"count"),requirement("refresher","Instructor refresher",input.refresherMinutes/60,1,"hours")];
  const current=requirements.every(item=>item.met);
  return{id:"lapl-a-fcl140a",code:"FCL.140.A",title:"LAPL(A) flying privileges",status:current?"current":"not-current",summary:current?"Current on the rolling 2-year route":`Remaining — ${missingSummary(requirements)}`,windowLabel:"Rolling 2 years",requirements,note:"FlyTally uses certified logbook records. A LAPL(A) proficiency check is an alternative route and is not inferred automatically.",meta:{ullMinutes:input.ullMinutes??0,ullLandings:input.ullLandings??0}};
}

export function evaluateLaplA(flights:RecencyFlight[],today:string):RecencyEvaluation{
  const start=rollingYearsStart(today,2),window=flights.filter(f=>within(f,start,today));
  const eligible=window.filter(f=>laplRole(f.role)&&(classKey(f.aircraftClass)==="SEP"||classKey(f.aircraftClass)==="TMG"||(upper(f.evidence)==="ULL"&&classKey(f.aircraftClass)==="ULL")));
  const ull=eligible.filter(f=>upper(f.evidence)==="ULL"&&classKey(f.aircraftClass)==="ULL");
  return evaluateLaplMetrics({flightMinutes:eligible.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),landings:eligible.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),refresherMinutes:window.filter(isLaplRefresher).reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullMinutes:ull.reduce((sum,f)=>sum+Math.max(0,f.minutes),0),ullLandings:ull.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0)});
}

export function evaluatePassengerCurrency(flights:RecencyFlight[],aircraftClass:"SEP"|"TMG",hasIr:boolean,today:string):RecencyEvaluation{
  const start=rollingDaysStart(today,90),window=flights.filter(f=>within(f,start,today)&&classKey(f.aircraftClass)===aircraftClass&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL");
  const landings=window.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),night=window.reduce((sum,f)=>sum+Math.max(0,f.landingsNight),0);
  const requirements=[requirement("day-passengers","Passenger currency",landings,3,"count"),requirement("night-passengers",hasIr?"Night PIC (IR exemption)":"Night PIC currency",hasIr?1:night,1,"count")];
  const dayMet=requirements[0].met,nightMet=requirements[1].met,status:RecencyStatus=dayMet?(nightMet?"current":"attention"):"not-current";
  return{id:`fcl060-${aircraftClass.toLowerCase()}`,code:"FCL.060",title:`${aircraftClass} passenger currency`,status,summary:dayMet?(nightMet?"Day and night passenger currency current":"Day current · night PIC not current"):`Passenger currency not current · ${Math.max(0,3-landings)} recorded landing${Math.max(0,3-landings)===1?"":"s"} remaining`,windowLabel:"Preceding 90 days",requirements,note:"Planning indicator based on certified flights and recorded landings. FlyTally does not currently record take-offs/approaches or FFS pilot-flying events separately.",meta:{landings,nightLandings:night,irExemption:hasIr}};
}

const metricSet=new Set<CustomRecencyMetric>(["flight_hours","pic_hours","flights","landings","night_landings"]);
export function parseCustomRecencyRules(value:unknown):CustomRecencyRule[]{
  let raw:unknown=value;if(typeof raw==="string"){try{raw=JSON.parse(raw)}catch{return[]}}if(!Array.isArray(raw))return[];
  const seen=new Set<string>(),out:CustomRecencyRule[]=[];
  for(const item of raw){if(!item||typeof item!=="object")continue;const v=item as Record<string,unknown>,id=String(v.id??"").trim().slice(0,80),label=String(v.label??"").trim().slice(0,80),metric=String(v.metric??"") as CustomRecencyMetric,target=Number(v.target);if(!id||!label||seen.has(id)||!metricSet.has(metric)||!Number.isFinite(target)||target<=0)continue;seen.add(id);out.push({id,label,metric,target:clamp(target,.01,10000),windowDays:clamp(Math.round(Number(v.windowDays)||90),1,3650),evidence:["EASA","ULL"].includes(upper(v.evidence))?upper(v.evidence) as "EASA"|"ULL":"ANY",aircraftClass:(upper(v.aircraftClass)||"ANY").slice(0,30),role:(upper(v.role)||"ANY").slice(0,30)});if(out.length>=20)break}return out;
}
export function evaluateCustomRule(rule:CustomRecencyRule,flights:RecencyFlight[],today:string):RecencyEvaluation{
  const start=rollingDaysStart(today,rule.windowDays),filtered=flights.filter(f=>within(f,start,today)&&(rule.evidence==="ANY"||upper(f.evidence)===rule.evidence)&&(rule.aircraftClass==="ANY"||classKey(f.aircraftClass)===classKey(rule.aircraftClass))&&(rule.role==="ANY"||upper(f.role)===rule.role));
  let current=0;if(rule.metric==="flight_hours")current=filtered.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60;else if(rule.metric==="pic_hours")current=filtered.filter(f=>["PIC","SOLO"].includes(upper(f.role))).reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60;else if(rule.metric==="flights")current=filtered.length;else if(rule.metric==="landings")current=filtered.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0);else current=filtered.reduce((sum,f)=>sum+Math.max(0,f.landingsNight),0);
  const unit:RecencyUnit=rule.metric.endsWith("hours")?"hours":"count",req=requirement("custom",rule.label,current,rule.target,unit),met=req.met;
  return{id:rule.id,code:"CUSTOM",title:rule.label,status:met?"current":"not-current",summary:met?"Requirement met":`Remaining — ${unit==="hours"?rounded(rule.target-current)+" h":Math.max(0,Math.ceil(rule.target-current))}`,windowLabel:`Rolling ${rule.windowDays} days`,requirements:[req],note:[rule.evidence!=="ANY"?rule.evidence:"",rule.aircraftClass!=="ANY"?rule.aircraftClass:"",rule.role!=="ANY"?rule.role:""].filter(Boolean).join(" · ")||"All certified flight records"};
}
