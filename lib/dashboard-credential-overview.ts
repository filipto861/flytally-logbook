// The Dashboard reports stored evidence only; it never certifies flight privileges.
import type { DashboardLaplIndicator } from "./dashboard-lapl-overview.ts";
export type DashboardLicenceSummary={id:number;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardQualificationSummary={id:number;qualificationType:string;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardDocumentSummary={id:number;category:string;label:string;expiryDate:string};
export type CredentialOverviewTone="neutral"|"warning"|"danger"|"muted";
export type CredentialOverviewGroup={count:number;status:"No date alerts"|"Date passed"|"Due soon"|"Needs review"|"CURRENT"|"NOT CURRENT"|"UNVERIFIED"|"Not recorded";tone:CredentialOverviewTone;reviewCount:number};

const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&!day.startsWith("0000")&&Number.isFinite(Date.parse(day+"T00:00:00Z"))&&new Date(day+"T00:00:00Z").toISOString().slice(0,10)===day;
const isMedical=(record:Pick<DashboardDocumentSummary,"category"|"label">)=>record.category.trim().toUpperCase()==="MEDICAL"||/\bmedical\b/i.test(record.label);
export function partitionCredentialDocuments<T extends Pick<DashboardDocumentSummary,"category"|"label">>(rows:readonly T[]){
  const documents:T[]=[],medical:T[]=[];
  for(const row of rows){if(isMedical(row))medical.push(row);else documents.push(row);}
  return {documents,medical};
}

type DateEvidence="neutral"|"warning"|"danger"|"unknown"|"separate";
function storedDateEvidence(mode:string,date:string,asOf:string):DateEvidence{
  if(mode==="unlimited")return "neutral"; // Only the recorded document/licence expiry, never privileges.
  if(!["date","recency"].includes(mode)||!validDay(date)||!validDay(asOf))return "unknown"; // Saved recency dates are informational only.
  const days=(Date.parse(date+"T00:00:00Z")-Date.parse(asOf+"T00:00:00Z"))/86400000;
  return days<0?"danger":days<=30?"warning":"neutral";
}
function licenceEvidence(row:DashboardLicenceSummary,asOf:string):DateEvidence{
  if(!row.licenceType.trim())return "unknown";
  // The LAPL licence itself has indefinite expiry in the existing records contract.
  if(["LAPL(A)","LAPL(H)"].includes(row.licenceType.trim().toUpperCase()))return "neutral";
  return storedDateEvidence(row.validityMode,row.validUntil,asOf);
}
function ratingEvidence(row:DashboardQualificationSummary,asOf:string):DateEvidence{
  if(!row.qualificationType.trim()||!row.licenceType.trim())return "unknown";
  const isLaplClass=row.licenceType.trim().toUpperCase()==="LAPL(A)"&&/^(SEP|TMG)/i.test(row.qualificationType.trim());
  // LAPL(A) SEP/TMG has FCL.140.A experience requirements, not a fixed
  // rating expiry. A manually saved date can never substitute for the engine.
  if(isLaplClass)return "separate";
  return storedDateEvidence(row.validityMode,row.validityMode==="recency"?row.recencyUntil:row.validUntil,asOf);
}
function documentEvidence(row:DashboardDocumentSummary,asOf:string):DateEvidence{
  if(!row.label.trim())return "unknown";
  return storedDateEvidence(row.expiryDate==="9999-12-31"?"unlimited":"date",row.expiryDate,asOf);
}
function summarize<T>(records:readonly T[],asOf:string,evidence:(item:T,day:string)=>DateEvidence,lapl?:DashboardLaplIndicator):CredentialOverviewGroup{
  if(!records.length)return{count:0,status:"Not recorded",tone:"muted",reviewCount:0};
  const states=records.map(item=>evidence(item,asOf));
  const reviewCount=states.filter(state=>state==="unknown"||state==="warning"||state==="danger").length;
  if(states.includes("danger"))return{count:records.length,status:"Date passed",tone:"danger",reviewCount};
  if(states.includes("warning"))return{count:records.length,status:"Due soon",tone:"warning",reviewCount};
  if(states.includes("unknown"))return{count:records.length,status:"Needs review",tone:"warning",reviewCount};
  if(states.includes("separate"))return{count:records.length,status:lapl?.status??"UNVERIFIED",tone:lapl?.tone??"muted",reviewCount:reviewCount+(!lapl||lapl.status!=="CURRENT"?1:0)};
  return{count:records.length,status:"No date alerts",tone:"neutral",reviewCount:0};
}
export function buildCredentialOverview(input:{licences:readonly DashboardLicenceSummary[];qualifications:readonly DashboardQualificationSummary[];documents:readonly DashboardDocumentSummary[];asOf:string;laplRecency?:DashboardLaplIndicator|null}){
  const {documents,medical}=partitionCredentialDocuments(input.documents);
  return{
    licences:summarize(input.licences,input.asOf,licenceEvidence),
    ratings:(()=>{
      const regular=summarize(input.qualifications,input.asOf,ratingEvidence,input.laplRecency??undefined);
      // LAPL(A) is a licence-level FCL.140.A assessment. Its recency applies
      // even where a separate SEP/TMG qualification record is not saved.
      const hasLapl=input.licences.some(l=>l.licenceType.trim().toUpperCase()==="LAPL(A)");
      if(!hasLapl||input.qualifications.length)return regular;
      return {count:0,status:input.laplRecency?.status??"UNVERIFIED",tone:input.laplRecency?.tone??"muted",reviewCount:input.laplRecency?.status==="CURRENT"?0:1};
    })(),
    documents:summarize(documents,input.asOf,documentEvidence),
    medical:summarize(medical,input.asOf,documentEvidence),
  };
}
