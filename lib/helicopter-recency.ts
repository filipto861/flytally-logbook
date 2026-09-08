import type { RecencyEvaluation,RecencyRequirement } from "./recency-engine.ts";
import { rollingDaysStart,rollingYearsStart } from "./recency-engine.ts";

export type HelicopterFlight={
  id?:number;
  registration?:string;
  departure?:string;
  arrival?:string;
  date:string;
  helicopterType:string;
  regulatoryCategory:string;
  role:string;
  minutes:number;
  movementEvidenceRecorded:boolean;
  takeoffsDay:number;
  takeoffsNight:number;
  approachesDay:number;
  approachesNight:number;
  landingsDay:number;
  landingsNight:number;
  purposeCode:string;
  instructorSigned:boolean;
};

export type HelicopterProficiencyEvidence={id:number;helicopterType:string;date:string;signer:string;reference:string;note:string};

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();
const typeKey=(value:unknown)=>upper(value).replace(/\s+/g," ");
const rounded=(value:number)=>Math.round(value*100)/100;
const requirement=(id:string,label:string,current:number,target:number,unit:"hours"|"count"):RecencyRequirement=>({id,label,current:rounded(current),target,unit,met:current>=target});
const within=(flight:HelicopterFlight,start:string,today:string)=>flight.date>=start&&flight.date<=today;
const matchingType=(flight:HelicopterFlight,helicopterType:string)=>typeKey(flight.helicopterType)===typeKey(helicopterType);
const supervisedExperience=(flight:HelicopterFlight)=>["DUAL","SOLO"].includes(upper(flight.role))&&flight.instructorSigned;
const laplExperience=(flight:HelicopterFlight)=>upper(flight.role)==="PIC"||supervisedExperience(flight);
const pfRole=(flight:HelicopterFlight)=>["PIC","CO-PILOT"].includes(upper(flight.role));
const movementTriples=(flights:HelicopterFlight[])=>{const explicit=flights.filter(flight=>flight.movementEvidenceRecorded),takeoffs=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.takeoffsDay)+Math.max(0,flight.takeoffsNight),0),approaches=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.approachesDay)+Math.max(0,flight.approachesNight),0),landings=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.landingsDay)+Math.max(0,flight.landingsNight),0);return Math.min(takeoffs,approaches,landings)};
const nightMovementTriples=(flights:HelicopterFlight[])=>{const explicit=flights.filter(flight=>flight.movementEvidenceRecorded),takeoffs=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.takeoffsNight),0),approaches=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.approachesNight),0),landings=explicit.reduce((sum,flight)=>sum+Math.max(0,flight.landingsNight),0);return Math.min(takeoffs,approaches,landings)};
const movementContributor=(flight:HelicopterFlight)=>flight.movementEvidenceRecorded&&Math.max(0,flight.takeoffsDay)+Math.max(0,flight.takeoffsNight)+Math.max(0,flight.approachesDay)+Math.max(0,flight.approachesNight)+Math.max(0,flight.landingsDay)+Math.max(0,flight.landingsNight)>0;
const duration=(hours:number)=>{const mins=Math.max(0,Math.ceil(hours*60));return`${Math.floor(mins/60)}:${String(mins%60).padStart(2,"0")}`};
const missing=(requirements:RecencyRequirement[])=>requirements.filter(item=>!item.met).map(item=>`${item.label}: ${item.unit==="hours"?duration(item.target-item.current):Math.max(0,Math.ceil(item.target-item.current))} remaining`).join(" · ");
const latestCheck=(evidence:HelicopterProficiencyEvidence[],helicopterType:string,start:string,today:string)=>evidence.filter(item=>typeKey(item.helicopterType)===typeKey(helicopterType)&&item.date>=start&&item.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0];
const sourceIds=(flights:HelicopterFlight[])=>[...new Set(flights.map(flight=>Number(flight.id)||0).filter(Boolean))].join(",");

/** FCL.140.H is type-specific. FlyTally intentionally does not pool different helicopter types. */
export function evaluateLaplH(flights:HelicopterFlight[],today:string,helicopterType:string,evidence:HelicopterProficiencyEvidence[]=[]):RecencyEvaluation{
  const start=rollingYearsStart(today,1),window=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="HELICOPTER"&&matchingType(f,helicopterType)),eligible=window.filter(laplExperience),movementCount=movementTriples(eligible),refresher=eligible.filter(f=>upper(f.role)==="DUAL"&&f.instructorSigned&&upper(f.purposeCode)==="LAPL_H_FCL140H_REFRESHER"&&f.minutes>=60),check=latestCheck(evidence,helicopterType,start,today);
  const requirements=[requirement("flight-time","Flight time on type",eligible.reduce((sum,f)=>sum+Math.max(0,f.minutes),0)/60,6,"hours"),requirement("movements","Take-offs / approaches / landings",movementCount,6,"count"),requirement("refresher","Signed refresher training ≥ 1 h",refresher.length,1,"count")],current=requirements.every(item=>item.met);
  if(check)return{id:`lapl-h-${typeKey(helicopterType).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,code:"FCL.140.H",title:`LAPL(H) · ${helicopterType}`,status:"current",badge:"CURRENT",summary:`Current via proficiency check passed ${check.date}`,windowLabel:"Specific type · last 12 months",requirements,note:`Examiner evidence: ${check.signer} · ${check.reference}. The proficiency-check route is an alternative to the experience and refresher-training route.`,meta:{helicopterType,proficiencyCheck:true,proficiencyEvidenceId:check.id,evidenceFlightIds:""}};
  return{id:`lapl-h-${typeKey(helicopterType).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,code:"FCL.140.H",title:`LAPL(H) · ${helicopterType}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Current on the 12-month experience route":`Remaining — ${missing(requirements)}`,windowLabel:"Specific type · last 12 months",requirements,note:"Only certified helicopter flights on this specific stored aircraft type are counted. Dual and supervised-solo experience counts only with instructor-signed evidence. Movement credit requires explicit take-off, approach and landing counters.",meta:{helicopterType,evidenceFlightIds:sourceIds(eligible),trainingFlightIds:sourceIds(refresher)}};
}

/** FCL.060 passenger recent experience, evaluated conservatively per stored helicopter type. */
export function evaluateHelicopterPassengerCurrency(flights:HelicopterFlight[],today:string,helicopterType:string,night=false,hasIrH=false):RecencyEvaluation{
  const start=rollingDaysStart(today,90),window=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="HELICOPTER"&&matchingType(f,helicopterType)&&pfRole(f)),movements=movementTriples(window),nightMovements=nightMovementTriples(window),requirements=[requirement("movements","PF take-offs / approaches / landings",movements,3,"count"),...(night&&!hasIrH?[requirement("night-movement","Night PF take-off / approach / landing",nightMovements,1,"count")]:[])],current=requirements.every(item=>item.met),contributors=window.filter(movementContributor);
  return{id:`helicopter-passenger-${night?"night-":""}${typeKey(helicopterType).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,code:"FCL.060",title:`Helicopter passenger currency · ${helicopterType}${night?" · night":""}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Passenger recent-experience requirement satisfied":`Remaining — ${missing(requirements)}`,windowLabel:"Preceding 90 days",requirements,note:night&&hasIrH?"A current IR(H) satisfies the separate night-PIC condition; the three PF take-off/approach/landing movements remain required.":night?"Night PIC passenger carriage requires at least one qualifying night take-off, approach and landing unless a current IR(H) is held.":"Counts only explicit PF take-off, approach and landing evidence on this stored helicopter type.",meta:{helicopterType,night,hasIrH,evidenceFlightIds:sourceIds(contributors)}};
}
