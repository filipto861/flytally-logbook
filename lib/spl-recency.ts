import type { RecencyEvaluation,RecencyRequirement } from "./recency-engine.ts";
import { rollingDaysStart,rollingYearsStart } from "./recency-engine.ts";

export type SplFlight={
  id?:number;
  registration?:string;
  departure?:string;
  arrival?:string;
  date:string;
  regulatoryCategory:string;
  aircraftClass:string;
  role:string;
  minutes:number;
  airMinutes:number;
  launches:number;
  launchMethod:string;
  landingsDay:number;
  landingsNight:number;
  takeoffsDay:number;
  takeoffsNight:number;
  purposeCode:string;
  instructorSigned:boolean;
};
export type SplProficiencyEvidence={id:number;aircraftContext:"SAILPLANE"|"TMG";date:string;signer:string;reference:string;note:string};
export type LaunchMethod="WINCH"|"AEROTOW"|"SELF_LAUNCH"|"CAR"|"BUNGEE";

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();
const rounded=(value:number)=>Math.round(value*100)/100;
const requirement=(id:string,label:string,current:number,target:number,unit:"hours"|"count"):RecencyRequirement=>({id,label,current:rounded(current),target,unit,met:current>=target});
const flightTime=(flight:SplFlight)=>Math.max(0,flight.airMinutes||flight.minutes||0);
const within=(flight:SplFlight,start:string,today:string)=>flight.date>=start&&flight.date<=today;
const picRole=(flight:SplFlight)=>["PIC","INSTRUCTOR","EXAMINER"].includes(upper(flight.role));
const experienceRole=(flight:SplFlight)=>picRole(flight)||(["DUAL","SOLO"].includes(upper(flight.role))&&flight.instructorSigned);
const currentFrom=(requirements:RecencyRequirement[])=>requirements.every(item=>item.met);
const duration=(hours:number)=>{const mins=Math.max(0,Math.ceil(hours*60));return`${Math.floor(mins/60)}:${String(mins%60).padStart(2,"0")}`};
const missing=(requirements:RecencyRequirement[])=>requirements.filter(item=>!item.met).map(item=>`${item.label}: ${item.unit==="hours"?duration(item.target-item.current):Math.max(0,Math.ceil(item.target-item.current))} remaining`).join(" · ");
const latestCheck=(evidence:SplProficiencyEvidence[],context:"SAILPLANE"|"TMG",start:string,today:string)=>evidence.filter(item=>item.aircraftContext===context&&item.date>=start&&item.date<=today).sort((a,b)=>b.date.localeCompare(a.date))[0];
const sourceIds=(flights:SplFlight[])=>[...new Set(flights.map(flight=>Number(flight.id)||0).filter(Boolean))].join(",");

export function evaluateSplSailplane(flights:SplFlight[],today:string,evidence:SplProficiencyEvidence[]=[]):RecencyEvaluation{
  const start=rollingYearsStart(today,2),allSailplanes=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="SAILPLANE"),eligible=allSailplanes.filter(experienceRole),nonTmg=eligible.filter(f=>upper(f.aircraftClass)!=="TMG"),training=nonTmg.filter(f=>upper(f.role)==="DUAL"&&f.instructorSigned&&upper(f.purposeCode)==="SPL_SFCL160_TRAINING"),check=latestCheck(evidence,"SAILPLANE",start,today);
  const requirements=[
    requirement("flight-time","Flight time",eligible.reduce((sum,f)=>sum+flightTime(f),0)/60,5,"hours"),
    requirement("launches","Launches",nonTmg.reduce((sum,f)=>sum+Math.max(0,f.launches),0),15,"count"),
    requirement("training-flights","FI(S) training flights",training.length,2,"count"),
  ],experienceCurrent=currentFrom(requirements);
  if(check)return{id:"spl-sailplane-sfcl160",code:"SFCL.160(a)",title:"SPL · Sailplanes",status:"current",badge:"CURRENT",summary:`Current via proficiency check passed ${check.date}`,windowLabel:"Last 24 months",requirements,note:`FE(S) evidence: ${check.signer} · ${check.reference}. The proficiency-check route is an alternative to the experience requirements shown below.`,meta:{proficiencyCheck:true,proficiencyEvidenceId:check.id,evidenceFlightIds:""}};
  return{id:"spl-sailplane-sfcl160",code:"SFCL.160(a)",title:"SPL · Sailplanes",status:experienceCurrent?"current":"not-current",badge:experienceCurrent?"CURRENT":"NOT CURRENT",summary:experienceCurrent?"Current on the 24-month experience route":`Remaining — ${missing(requirements)}`,windowLabel:"Last 24 months",requirements,note:"The 5-hour total may include qualifying SPL sailplane experience including TMG time. The 15 launches and two FI(S) training flights must be in sailplanes excluding TMGs. Dual and supervised-solo experience counts only with current instructor-signed evidence.",meta:{evidenceFlightIds:sourceIds(eligible),trainingFlightIds:sourceIds(training)}};
}

export function evaluateSplTmg(flights:SplFlight[],today:string,evidence:SplProficiencyEvidence[]=[],partFclTmgPrivilege=false):RecencyEvaluation{
  const start=rollingYearsStart(today,2),window=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="SAILPLANE"),eligible=window.filter(experienceRole),tmg=eligible.filter(f=>upper(f.aircraftClass)==="TMG"),training=tmg.filter(f=>upper(f.role)==="DUAL"&&f.instructorSigned&&upper(f.purposeCode)==="SPL_SFCL160_TRAINING"&&flightTime(f)>=60),takeoffs=tmg.reduce((sum,f)=>sum+Math.max(0,f.takeoffsDay)+Math.max(0,f.takeoffsNight),0),landings=tmg.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),check=latestCheck(evidence,"TMG",start,today);
  const requirements=[
    requirement("total-time","Total sailplane flight time",eligible.reduce((sum,f)=>sum+flightTime(f),0)/60,12,"hours"),
    requirement("tmg-time","TMG flight time",tmg.reduce((sum,f)=>sum+flightTime(f),0)/60,6,"hours"),
    requirement("tmg-movements","TMG take-offs / landings",Math.min(takeoffs,landings),12,"count"),
    requirement("training-flight","FI(S) training flight ≥ 1 h",training.length,1,"count"),
  ],experienceCurrent=currentFrom(requirements);
  if(partFclTmgPrivilege)return{id:"spl-tmg-sfcl160",code:"SFCL.160(c)",title:"SPL · TMG",status:"current",badge:"PART-FCL ROUTE",summary:"Exempt from SFCL.160(b) through Part-FCL TMG privileges",windowLabel:"Part-FCL controls TMG privilege",requirements,note:"FlyTally does not use SPL flight totals to decide this route. The underlying TMG privileges and their Part-FCL validity/recency remain controlling and are monitored separately where configured.",meta:{partFclExemption:true}};
  if(check)return{id:"spl-tmg-sfcl160",code:"SFCL.160(b)",title:"SPL · TMG",status:"current",badge:"CURRENT",summary:`Current via proficiency check passed ${check.date}`,windowLabel:"Last 24 months",requirements,note:`Examiner evidence: ${check.signer} · ${check.reference}. The proficiency-check route is an alternative to the experience requirements shown below.`,meta:{proficiencyCheck:true,proficiencyEvidenceId:check.id,evidenceFlightIds:""}};
  return{id:"spl-tmg-sfcl160",code:"SFCL.160(b)",title:"SPL · TMG",status:experienceCurrent?"current":"not-current",badge:experienceCurrent?"CURRENT":"NOT CURRENT",summary:experienceCurrent?"Current on the 24-month experience route":`Remaining — ${missing(requirements)}`,windowLabel:"Last 24 months",requirements,note:"The 12-hour total may include qualifying SPL sailplane experience; at least 6 hours, 12 take-offs and landings, and the ≥1 h instructor training flight must be on TMGs. Supervised experience is counted only with instructor-signed evidence.",meta:{evidenceFlightIds:sourceIds(eligible),trainingFlightIds:sourceIds(training)}};
}

export function evaluateSplPassenger(flights:SplFlight[],today:string,context:"SAILPLANE"|"TMG",night=false):RecencyEvaluation{
  const start=rollingDaysStart(today,90),window=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="SAILPLANE"&&picRole(f));
  if(context==="SAILPLANE"){
    const relevant=window.filter(f=>upper(f.aircraftClass)!=="TMG"),launches=relevant.reduce((sum,f)=>sum+Math.max(0,f.launches),0),requirements=[requirement("launches","PIC launches",launches,3,"count")],current=currentFrom(requirements);
    return{id:"spl-passenger-sailplane",code:"SFCL.160(e)",title:"SPL passenger currency · Sailplane",status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Passenger currency satisfied":`Remaining — ${missing(requirements)}`,windowLabel:"Preceding 90 days",requirements,note:"Counts explicit launches performed as PIC in sailplanes excluding TMGs.",meta:{evidenceFlightIds:sourceIds(relevant)}};
  }
  const tmg=window.filter(f=>upper(f.aircraftClass)==="TMG"),takeoffs=tmg.reduce((sum,f)=>sum+Math.max(0,f.takeoffsDay)+Math.max(0,f.takeoffsNight),0),landings=tmg.reduce((sum,f)=>sum+Math.max(0,f.landingsDay)+Math.max(0,f.landingsNight),0),nightPairs=Math.min(tmg.reduce((sum,f)=>sum+Math.max(0,f.takeoffsNight),0),tmg.reduce((sum,f)=>sum+Math.max(0,f.landingsNight),0)),requirements=[requirement("movements","PIC take-offs / landings",Math.min(takeoffs,landings),3,"count"),...(night?[requirement("night-movement","Night take-off / landing",nightPairs,1,"count")]:[])],current=currentFrom(requirements);
  return{id:night?"spl-passenger-tmg-night":"spl-passenger-tmg",code:"SFCL.160(e)",title:`SPL passenger currency · TMG${night?" night":""}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Passenger currency satisfied":`Remaining — ${missing(requirements)}`,windowLabel:"Preceding 90 days",requirements,note:night?"For night passenger carriage in a TMG, at least one of the three qualifying take-offs and landings must have been at night.":"Counts explicit TMG take-offs and landings performed as PIC.",meta:{evidenceFlightIds:sourceIds(tmg)}};
}

export function evaluateLaunchMethod(flights:SplFlight[],today:string,method:LaunchMethod):RecencyEvaluation{
  const start=rollingYearsStart(today,2),eligible=flights.filter(f=>within(f,start,today)&&upper(f.regulatoryCategory)==="SAILPLANE"&&experienceRole(f)),ownFlights=eligible.filter(f=>upper(f.launchMethod)==method&&Math.max(0,f.launches)>0),own=ownFlights.reduce((sum,f)=>sum+Math.max(0,f.launches),0),tmgFlights=method==="SELF_LAUNCH"?eligible.filter(f=>upper(f.aircraftClass)==="TMG"&&(Math.max(0,f.takeoffsDay)+Math.max(0,f.takeoffsNight)>0)):[],tmgTakeoffs=tmgFlights.reduce((sum,f)=>sum+Math.max(0,f.takeoffsDay)+Math.max(0,f.takeoffsNight),0),target=method==="BUNGEE"?2:5,currentCount=own+tmgTakeoffs,requirements=[requirement("launches",method==="SELF_LAUNCH"?"Self-launches / TMG take-offs":"Launches",currentCount,target,"count")],current=currentFrom(requirements),label={WINCH:"Winch launch",AEROTOW:"Aerotow",SELF_LAUNCH:"Self-launch",CAR:"Car launch",BUNGEE:"Bungee launch"}[method];
  return{id:`spl-launch-${method.toLowerCase()}`,code:"SFCL.155(c)",title:`SPL · ${label}`,status:current?"current":"not-current",badge:current?"CURRENT":"NOT CURRENT",summary:current?"Launch-method recency satisfied":`Remaining — ${missing(requirements)}`,windowLabel:"Last 2 years",requirements,note:method==="SELF_LAUNCH"?"Self-launch recency may be maintained by self-launches, TMG take-offs, or a combination of both.":"If this recency is not met, the missing launches must be completed dual or solo under instructor supervision before the privilege is renewed.",meta:{evidenceFlightIds:sourceIds([...ownFlights,...tmgFlights])}};
}
