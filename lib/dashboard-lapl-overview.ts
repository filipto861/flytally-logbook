import { evaluateLaplA,parseRecencyEvidence,type RecencyFlight } from "./recency-engine.ts";

// Strictly an evidence-based FCL.140.A result, NOT an authority's licence
// clearance or an assessment of the separate FCL.060 passenger requirements.
export type DashboardLaplIndicator={
  status:"CURRENT"|"NOT CURRENT"|"UNVERIFIED";
  tone:"neutral"|"danger"|"muted";
  forecastDate:string|null;
  detail:string;
};

const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&!day.startsWith("0000")&&
  Number.isFinite(Date.parse(day+"T00:00:00Z"))&&
  new Date(day+"T00:00:00Z").toISOString().slice(0,10)===day;

// The saved examiner evidence must be structurally unambiguous. A skipped
// malformed item must not silently turn into a negative or positive decision.
function recordedEvidence(raw:unknown){
  let entries:unknown=raw??[];
  if(typeof entries==="string"){
    try{entries=JSON.parse(entries)}catch{return null}
  }
  if(!Array.isArray(entries))return null;
  const parsed=parseRecencyEvidence(entries);
  return parsed.length===entries.length?parsed:null;
}

export function dashboardLaplIndicator(flights:readonly RecencyFlight[],asOf:string,rawEvidence:unknown):DashboardLaplIndicator{
  const unknown=(detail:string):DashboardLaplIndicator=>({status:"UNVERIFIED",tone:"muted",forecastDate:null,detail});
  if(!validDay(asOf))return unknown("Invalid assessment date");
  const evidence=recordedEvidence(rawEvidence);
  if(!evidence)return unknown("Stored proficiency-check evidence requires review");
  if(flights.some(f=>!validDay(f.date)||!Number.isFinite(f.minutes)||f.minutes<0))
    return unknown("Recorded flight dates or duration require review");
  const evaluated=evaluateLaplA([...flights],asOf,evidence);
  if(evaluated.status==="attention")return unknown(evaluated.summary);
  return {
    status:evaluated.status==="current"?"CURRENT":"NOT CURRENT",
    tone:evaluated.status==="current"?"neutral":"danger",
    forecastDate:evaluated.forecastDate??null,
    detail:evaluated.summary,
  };
}
