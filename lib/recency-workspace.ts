import type { RecencyEvaluation,RecencyRequirement } from "./recency-engine";

export type ComplianceWorkspaceStatus="current"|"action-soon"|"not-current"|"incomplete-evidence";
export type ComplianceWorkspaceKind="recency"|"licence"|"qualification"|"document"|"setup";
export type ComplianceWorkspaceCategory="aeroplane"|"helicopter"|"sailplane"|"balloon"|"ull"|"other";
export type ComplianceWorkspaceFamily="Part-FCL"|"Part-SFCL"|"Part-BFCL"|"Custom"|"Credential";
export type ComplianceEvidenceLink={id:string;label:string;detail?:string;href?:string};

export type ComplianceWorkspaceItem={
  id:string;
  sourceId:string;
  kind:ComplianceWorkspaceKind;
  category:ComplianceWorkspaceCategory;
  family:ComplianceWorkspaceFamily;
  code?:string;
  title:string;
  status:ComplianceWorkspaceStatus;
  statusLabel:string;
  summary:string;
  windowLabel?:string;
  requirements:RecencyRequirement[];
  forecastDate?:string;
  deadline?:string;
  nextDate?:string;
  href:string;
  evidenceLinks:ComplianceEvidenceLink[];
  evidenceSummary?:string;
};

type ValidityLike={status:"valid"|"warning"|"expired"|"incomplete";label:string;daysRemaining:number|null;until:string};
const dateNumber=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?Math.floor(new Date(`${value}T00:00:00Z`).getTime()/86400000):null;
const daysUntil=(today:string,value?:string)=>{if(!value)return null;const from=dateNumber(today),to=dateNumber(value);return from===null||to===null?null:to-from};
const statusLabels:Record<ComplianceWorkspaceStatus,string>={current:"CURRENT","action-soon":"ACTION SOON","not-current":"NOT CURRENT","incomplete-evidence":"INCOMPLETE EVIDENCE"};
const incompleteEvaluation=(item:RecencyEvaluation)=>/LIMITED DATA|DATE NEEDED|REVIEW DATA/i.test(item.badge??"")||/limited (data|movement|evidence)|evidence (is )?(missing|unavailable)|date .*needed/i.test(`${item.summary} ${item.note??""}`);

export function complianceStatusLabel(status:ComplianceWorkspaceStatus){return statusLabels[status]}

/** Presentation-only status mapping. Regulatory rule engines remain authoritative for the underlying evaluation. */
export function complianceStatusFromEvaluation(item:RecencyEvaluation,today:string,actionSoonDays=30):ComplianceWorkspaceStatus{
  if(item.status==="not-current")return"not-current";
  if(item.status==="attention")return incompleteEvaluation(item)?"incomplete-evidence":"action-soon";
  const candidateDates=[item.forecastDate,item.deadline].filter((value):value is string=>typeof value==="string");
  const soon=candidateDates.some(value=>{const days=daysUntil(today,value);return days!==null&&days>=0&&days<=Math.max(0,actionSoonDays)});
  return soon?"action-soon":"current";
}

export function complianceStatusFromValidity(state:ValidityLike):ComplianceWorkspaceStatus{
  if(state.status==="incomplete")return"incomplete-evidence";
  if(state.status==="expired")return"not-current";
  if(state.status==="warning")return"action-soon";
  return"current";
}

export function evaluationWorkspaceItem(input:{evaluation:RecencyEvaluation;today:string;category:ComplianceWorkspaceCategory;family:ComplianceWorkspaceFamily;href?:string;evidenceLinks?:ComplianceEvidenceLink[];evidenceSummary?:string;actionSoonDays?:number}):ComplianceWorkspaceItem{
  const{evaluation,today}=input,status=complianceStatusFromEvaluation(evaluation,today,input.actionSoonDays),dates=[evaluation.forecastDate,evaluation.deadline].filter((value):value is string=>typeof value==="string"&&value>=today).sort();
  return{id:`${input.family}:${evaluation.id}`,sourceId:evaluation.id,kind:"recency",category:input.category,family:input.family,code:evaluation.code,title:evaluation.title,status,statusLabel:complianceStatusLabel(status),summary:evaluation.summary,windowLabel:evaluation.windowLabel,requirements:evaluation.requirements,forecastDate:evaluation.forecastDate,deadline:evaluation.deadline,nextDate:dates[0],href:input.href??"/credentials?view=recency&detail=1",evidenceLinks:input.evidenceLinks??[],evidenceSummary:input.evidenceSummary};
}

export function credentialWorkspaceItem(input:{id:string;kind:"licence"|"qualification"|"document";category:ComplianceWorkspaceCategory;title:string;detail:string;validity:ValidityLike;href:string}):ComplianceWorkspaceItem{
  const status=complianceStatusFromValidity(input.validity);
  return{id:`credential:${input.kind}:${input.id}`,sourceId:input.id,kind:input.kind,category:input.category,family:"Credential",title:input.title,status,statusLabel:complianceStatusLabel(status),summary:input.detail||input.validity.label,windowLabel:input.validity.label,requirements:[],deadline:input.validity.until||undefined,nextDate:input.validity.until||undefined,href:input.href,evidenceLinks:[]};
}

export function setupWorkspaceItem(input:{id:string;category:ComplianceWorkspaceCategory;family:ComplianceWorkspaceFamily;title:string;summary:string;href:string}):ComplianceWorkspaceItem{
  return{id:`setup:${input.id}`,sourceId:input.id,kind:"setup",category:input.category,family:input.family,title:input.title,status:"incomplete-evidence",statusLabel:statusLabels["incomplete-evidence"],summary:input.summary,requirements:[],href:input.href,evidenceLinks:[]};
}

export function complianceStatusRank(status:ComplianceWorkspaceStatus){return status==="not-current"?0:status==="incomplete-evidence"?1:status==="action-soon"?2:3}
export function sortComplianceWorkspaceItems(items:ComplianceWorkspaceItem[]){return[...items].sort((a,b)=>complianceStatusRank(a.status)-complianceStatusRank(b.status)||(a.nextDate??"9999-12-31").localeCompare(b.nextDate??"9999-12-31")||a.title.localeCompare(b.title))}
