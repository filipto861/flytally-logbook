import type { RecencyEvaluation,RecencyRequirement } from "./recency-engine.ts";
import { rollingYearsStart } from "./recency-engine.ts";

export type BalloonClass="HOT_AIR_BALLOON"|"GAS_BALLOON"|"HOT_AIR_AIRSHIP"|"MIXED_BALLOON";
export type BalloonGroup="A"|"B"|"C"|"D"|"";
export type BalloonOperation="FREE"|"TETHERED"|"";

export type BalloonFlight={
  id?:number;
  registration?:string;
  departure?:string;
  arrival?:string;
  date:string;
  regulatoryCategory:string;
  balloonClass:string;
  balloonGroup:string;
  balloonOperation:string;
  role:string;
  airMinutes:number;
  takeoffs:number;
  landings:number;
  purposeCode:string;
  instructorSigned:boolean;
};

export type BalloonProficiencyEvidence={id:number;balloonClass:string;balloonGroup:string;date:string;signer:string;reference:string;note:string};
const upper=(value:unknown)=>String(value??"").trim().toUpperCase();
const rounded=(value:number)=>Math.round(value*100)/100;
const slug=(value:string)=>upper(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const requirement=(id:string,label:string,current:number,target:number,unit:"hours"|"count"):RecencyRequirement=>({id,label,current:rounded(current),target,unit,met:current>=target});
const within=(date:string,start:string,today:string)=>date>=start&&date<=today;
const classMatch=(value:string,balloonClass:string)=>upper(value)===upper(balloonClass);
const signedSupervised=(flight:BalloonFlight)=>["DUAL","SOLO"].includes(upper(flight.role))&&flight.instructorSigned;
const eligibleExperience=(flight:BalloonFlight)=>upper(flight.role)==="PIC"||signedSupervised(flight);
const flightHours=(flights:BalloonFlight[])=>flights.reduce((sum,flight)=>sum+Math.max(0,flight.airMinutes),0)/60;
const movementPairs=(flights:BalloonFlight[])=>Math.min(flights.reduce((sum,flight)=>sum+Math.max(0,flight.takeoffs),0),flights.reduce((sum,flight)=>sum+Math.max(0,flight.landings),0));
const duration=(hours:number)=>{const mins=Math.max(0,Math.ceil(hours*60));return`${Math.floor(mins/60)}:${String(mins%60).padStart(2,"0")}`};
const missing=(requirements:RecencyRequirement[])=>requirements.filter(item=>!item.met).map(item=>`${item.label}: ${item.unit==="hours"?duration(item.target-item.current):Math.max(0,Math.ceil(item.target-item.current))} remaining`).join(" · ");
const latestTraining=(flights:BalloonFlight[],balloonClass:string,start:string,today:string)=>flights.filter(flight=>within(flight.date,start,today)&&classMatch(flight.balloonClass,balloonClass)&&upper(flight.regulatoryCategory)==="BALLOON"&&upper(flight.purposeCode)==="BPL_BFCL160_TRAINING"&&flight.instructorSigned).sort((a,b)=>b.date.localeCompare(a.date))[0];
const latestCheck=(evidence:BalloonProficiencyEvidence[],balloonClass:string,start:string,today:string)=>evidence.filter(item=>classMatch(item.balloonClass,balloonClass)&&within(item.date,start,today)).sort((a,b)=>b.date.localeCompare(a.date))[0];
const validGroup=(value:unknown):BalloonGroup=>["A","B","C","D"].includes(upper(value))?upper(value) as BalloonGroup:"";
const sourceIds=(flights:BalloonFlight[])=>[...new Set(flights.map(flight=>Number(flight.id)||0).filter(Boolean))].join(",");

export function evaluateBplBaseClass(flights:BalloonFlight[],today:string,balloonClass:BalloonClass,evidence:BalloonProficiencyEvidence[]=[]):RecencyEvaluation{
  const start24=rollingYearsStart(today,2),start48=rollingYearsStart(today,4),window=flights.filter(flight=>within(flight.date,start24,today)&&upper(flight.regulatoryCategory)==="BALLOON"&&classMatch(flight.balloonClass,balloonClass)&&eligibleExperience(flight)),training=latestTraining(flights,balloonClass,start48,today),check=latestCheck(evidence,balloonClass,start24,today),requirements=[requirement("flight-time","Flight time",flightHours(window),6,"hours"),requirement("movements","Take-offs and landings",movementPairs(window),10,"count"),requirement("training-flight","Signed FI(B) training flight",training?1:0,1,"count")],experienceCurrent=requirements.every(item=>item.met),current=Boolean(check)||experienceCurrent,group=balloonClass==="HOT_AIR_BALLOON"?validGroup(check?.balloonGroup||training?.balloonGroup):"",experienceFlights=training?[...window,training]:window;
  return{id:`bpl-${slug(balloonClass)}`,code:"BFCL.160",title:`BPL · ${balloonClass.replaceAll("_"," ")}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:check?`Current via proficiency check passed ${check.date}`:experienceCurrent?"Current on the BFCL.160 experience route":`Remaining — ${missing(requirements)}`,windowLabel:"Base balloon class · 24 months / training 48 months",requirements,note:check?`FE(B) evidence: ${check.signer} · ${check.reference}.`:"Flight time is counted from take-off to landing. Dual and supervised-solo experience and the BFCL.160 training flight count only with signed instructor evidence.",meta:{balloonClass,anchorClass:true,proficiencyCheck:Boolean(check),hotAirGroup:group,proficiencyEvidenceId:check?.id??0,evidenceFlightIds:check?"":sourceIds(experienceFlights),trainingFlightIds:check?"":sourceIds(training?[training]:[])}};
}

export function evaluateBplAdditionalClass(flights:BalloonFlight[],today:string,balloonClass:BalloonClass):RecencyEvaluation{
  const start24=rollingYearsStart(today,2),window=flights.filter(flight=>within(flight.date,start24,today)&&upper(flight.regulatoryCategory)==="BALLOON"&&classMatch(flight.balloonClass,balloonClass)&&eligibleExperience(flight)),requirements=[requirement("flight-time","Flight time in additional class",flightHours(window),3,"hours")],current=requirements.every(item=>item.met);
  return{id:`bpl-additional-${slug(balloonClass)}`,code:"BFCL.160(b)",title:`BPL additional class · ${balloonClass.replaceAll("_"," ")}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Additional-class experience requirement satisfied":`Remaining — ${missing(requirements)}`,windowLabel:"Additional balloon class · last 24 months",requirements,note:"This is the additional-class requirement only. Exercise of BPL privileges also requires a valid BFCL.160 base-class route in one held balloon class.",meta:{balloonClass,anchorClass:false,evidenceFlightIds:sourceIds(window)}};
}

export function evaluateBplTetheredRating(flights:BalloonFlight[],today:string):RecencyEvaluation{
  const start48=rollingYearsStart(today,4),eligible=flights.filter(flight=>within(flight.date,start48,today)&&upper(flight.regulatoryCategory)==="BALLOON"&&upper(flight.balloonClass)==="HOT_AIR_BALLOON"&&upper(flight.balloonOperation)==="TETHERED"&&flight.airMinutes>0&&Math.min(Math.max(0,flight.takeoffs),Math.max(0,flight.landings))>0&&(["PIC","FI","INSTRUCTOR","EXAMINER"].includes(upper(flight.role))||signedSupervised(flight))),requirements=[requirement("tethered-flight","Tethered hot-air balloon flight",eligible.length,1,"count")],current=requirements[0].met,latest=[...eligible].sort((a,b)=>b.date.localeCompare(a.date))[0];
  return{id:"bpl-tethered-bfcl200",code:"BFCL.200",title:"Tethered hot-air balloon",status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?`Tethered privilege current${latest?` · latest flight ${latest.date}`:""}`:"No qualifying tethered flight in the preceding 48 months",windowLabel:"Tethered rating · preceding 48 months",requirements,note:"If recency lapses, BFCL.200 requires a tethered flight dual or supervised solo under FI(B) supervision before exercising the privilege again. Ground-only tether activity is not counted as a flight.",meta:{balloonClass:"HOT_AIR_BALLOON",tetheredRating:true,evidenceFlightIds:sourceIds(eligible)}};
}

export function findBplAnchorClass(flights:BalloonFlight[],today:string,heldClasses:BalloonClass[],evidence:BalloonProficiencyEvidence[]=[]){
  const unique=[...new Set(heldClasses)];const candidates=unique.map(balloonClass=>({balloonClass,evaluation:evaluateBplBaseClass(flights,today,balloonClass,evidence)})).filter(item=>item.evaluation.status==="current");
  for(const candidate of candidates){const additional=unique.filter(item=>item!==candidate.balloonClass).map(balloonClass=>evaluateBplAdditionalClass(flights,today,balloonClass));if(additional.every(item=>item.status==="current"))return{anchorClass:candidate.balloonClass,anchor:candidate.evaluation,additional,current:true};}
  return{anchorClass:null,anchor:null,additional:unique.map(balloonClass=>evaluateBplAdditionalClass(flights,today,balloonClass)),current:false,candidates};
}
