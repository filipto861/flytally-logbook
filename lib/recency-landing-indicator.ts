import type { RecencyEvaluation,RecencyFlight,RecencyRequirement,RecencyStatus } from "./recency-engine.ts";
import { rollingDaysStart } from "./recency-engine.ts";

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();
const utc=(value:string)=>new Date(`${value}T00:00:00Z`);
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(value:string,days:number)=>{const date=utc(value);date.setUTCDate(date.getUTCDate()+days);return iso(date)};
const classKey=(value:unknown)=>{const text=upper(value);if(text.startsWith("SEP"))return"SEP";if(text.startsWith("TMG"))return"TMG";return text};
const pilotFlyingRole=(role:unknown)=>["PIC","DUAL","SOLO","CO-PILOT","COPILOT","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(upper(role));
const count=(value:unknown)=>Math.max(0,Number(value)||0);
const requirement=(id:string,label:string,current:number,target:number):RecencyRequirement=>({id,label,current,target,unit:"count",met:current>=target});
const landingCount=(flight:RecencyFlight,nightOnly=false)=>nightOnly?count(flight.landingsNight):count(flight.landingsDay)+count(flight.landingsNight);
function landingForecast(flights:RecencyFlight[],target:number,nightOnly=false){let total=0;for(const flight of [...flights].sort((a,b)=>b.date.localeCompare(a.date))){total+=landingCount(flight,nightOnly);if(total>=target)return addDays(flight.date,90)}return undefined}

export function evaluatePassengerLandingIndicator(flights:RecencyFlight[],aircraftClass:"SEP"|"TMG",hasIr:boolean,today:string,mode:"day"|"night"):RecencyEvaluation{
  const start=rollingDaysStart(today,90),window=flights.filter(f=>f.date>=start&&f.date<=today&&classKey(f.aircraftClass)===aircraftClass&&pilotFlyingRole(f.role)&&upper(f.evidence)!=="ULL");
  const landings=window.reduce((sum,f)=>sum+landingCount(f),0),nightLandings=window.reduce((sum,f)=>sum+landingCount(f,true),0),base=requirement("landings","Landings",landings,3),nightReq=requirement("night-landings","Night landings",nightLandings,1),irReq=requirement("ir-exemption","IR exemption",hasIr?1:0,1);
  const requirements=mode==="day"?[base]:hasIr?[base,irReq]:[base,nightReq],met=requirements.every(item=>item.met),status:RecencyStatus=met?"current":"attention";
  const forecasts=met?[landingForecast(window,3),...(mode==="night"&&!hasIr?[landingForecast(window,1,true)]:[])].filter((value):value is string=>Boolean(value)).sort():[];
  const missing=requirements.filter(item=>!item.met).map(item=>`${Math.max(0,Math.ceil(item.target-item.current))} ${item.label.toLowerCase()} remaining`).join(" · ");
  return{id:`fcl060-${aircraftClass.toLowerCase()}-${mode}`,code:"FCL.060",title:mode==="day"?`${aircraftClass} passenger currency`:`${aircraftClass} night passenger currency`,status,badge:met?"LANDINGS OK":"CHECK",summary:met?(mode==="day"?"Landing-based 90-day indicator satisfied":hasIr?"Landing-based indicator satisfied · current IR saved":"Landing-based day and night indicators satisfied"):`Planning check · ${missing}`,windowLabel:"Preceding 90 days",requirements,forecastDate:forecasts[0],note:"Planning indicator only. FCL.060 also requires the corresponding take-offs and approaches; FlyTally intentionally does not ask you to record those separately.",meta:{landings,nightLandings,irExemption:hasIr,landingIndicator:true}};
}
