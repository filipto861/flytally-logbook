import { evaluatePassengerCurrencyMode,daysBetween,type RecencyFlight } from "./recency-engine.ts";
import { credentialValidity } from "./credential-validity.ts";
import { isAeroplaneIrQualification } from "./regulatory-qualification.ts";
import { confirmedQualificationMatches,hasConfirmedQualificationStructure,qualificationLogicScope } from "./qualification-record.ts";

export type PassengerClass="SEP"|"TMG";
export type DashboardPassengerIndicator={
  key:string;label:string;status:"CURRENT"|"NOT CURRENT"|"UNVERIFIED";dueSoon:boolean;
  tone:"neutral"|"warning"|"danger"|"muted";until:string|null;detail:string;
};
const t=(v:unknown)=>String(v??"").trim();
const upper=(v:unknown)=>t(v).toUpperCase();
const classOf=(row:Record<string,unknown>):PassengerClass|""=>{
  const name=hasConfirmedQualificationStructure(row)
    ?confirmedQualificationMatches(row,"CLASS_TYPE","AEROPLANE","PILOT")?qualificationLogicScope(row):""
    :t(row.qualification_type);
  const value=upper(name);return value.startsWith("SEP")?"SEP":value.startsWith("TMG")?"TMG":"";
};
const isIr=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?
  confirmedQualificationMatches(row,"INSTRUMENT","AEROPLANE","PILOT")&&isAeroplaneIrQualification(qualificationLogicScope(row)):
  isAeroplaneIrQualification(row.qualification_type);
const isNight=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?
  confirmedQualificationMatches(row,"OPERATIONAL","AEROPLANE","PILOT")&&upper(qualificationLogicScope(row)).includes("NIGHT"):
  upper(row.qualification_type).includes("NIGHT");

// A malformed/ambiguous stored qualification date must not unlock the
// Dashboard night or IR-exemption route. The general credentials formatter
// accepts legacy date shapes; this regulatory read is intentionally stricter.
const validStoredDay=(value:unknown):value is string=>{
  const day=t(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)&&!day.startsWith("0000")&&
    Number.isFinite(Date.parse(day+"T00:00:00Z"))&&
    new Date(day+"T00:00:00Z").toISOString().slice(0,10)===day;
};
const credentialActive=(row:Record<string,unknown>,asOf:string)=>{
  const mode=t(row.validity_mode).toLowerCase();
  if(mode==="unlimited")return true;
  if(mode!=="date"&&mode!=="recency")return false;
  const date=mode==="recency"?row.recency_until:row.valid_until;
  if(!validStoredDay(date))return false;
  const status=credentialValidity({mode,validUntil:row.valid_until,recencyUntil:row.recency_until},asOf).status;
  return status==="valid"||status==="warning";
};

export function activePassengerClasses(licences:readonly {licenceType:string}[],qualificationRows:readonly Record<string,unknown>[]):PassengerClass[]{
  const classes=new Set<PassengerClass>();
  if(licences.some(row=>upper(row.licenceType)==="LAPL(A)"))classes.add("SEP");
  for(const row of qualificationRows){const aircraftClass=classOf(row);if(aircraftClass)classes.add(aircraftClass);}
  return [...classes].sort();
}

export function passengerRecencyOverview(input:{
  flights:readonly RecencyFlight[];classes:readonly PassengerClass[];
  qualifications:readonly Record<string,unknown>[];asOf:string;
}):DashboardPassengerIndicator[]{
  const {flights,classes,qualifications,asOf}=input;
  // A saved, unexpired IR is needed for the night IR route; do not infer IR currency.
  const hasIr=qualifications.some(row=>isIr(row)&&credentialActive(row,asOf));
  const hasNight=hasIr||qualifications.some(row=>isNight(row)&&credentialActive(row,asOf));
  return classes.flatMap(aircraftClass=>(hasNight?["day","night"]:["day"] as const).map(mode=>{
    const evaluation=evaluatePassengerCurrencyMode([...flights],aircraftClass,hasIr,asOf,mode as "day"|"night");
    const until=evaluation.status==="current"&&evaluation.forecastDate?
      new Date(Date.parse(evaluation.forecastDate+"T00:00:00Z")-86400000).toISOString().slice(0,10):null;
    const days=evaluation.forecastDate?daysBetween(asOf,evaluation.forecastDate):Infinity;
    // The badge states the calculated condition TODAY; an approaching loss of
    // coverage is secondary, never a replacement for CURRENT.
    const noFlightEvidence=evaluation.status!=="current"&&evaluation.requirements.every(item=>item.current===0);
    const status:DashboardPassengerIndicator["status"]=evaluation.status==="current"?"CURRENT":
      evaluation.status==="attention"||noFlightEvidence?"UNVERIFIED":"NOT CURRENT";
    const tone:DashboardPassengerIndicator["tone"]=status==="CURRENT"?"neutral":status==="NOT CURRENT"?"danger":"muted";
    return{
      key:aircraftClass+"-"+mode,label:aircraftClass+" · "+(mode==="day"?"Day":"Night"),
      status,tone,until,dueSoon:status==="CURRENT"&&days<=30,
      detail:evaluation.status==="current"?"Based on certified recorded PF movements; assumes no new qualifying flights":evaluation.summary,
    };
  }));
}
