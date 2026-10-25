// The Dashboard reports stored evidence only; it never certifies flight privileges.
export type DashboardLicenceSummary={id:number;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardQualificationSummary={id:number;qualificationType:string;licenceType:string;validityMode:string;validUntil:string;recencyUntil:string};
export type DashboardDocumentSummary={id:number;category:string;label:string;expiryDate:string};
export type CredentialOverviewTone="neutral"|"warning"|"danger"|"muted";
export type CredentialOverviewGroup={count:number;status:"No date alerts"|"Date passed"|"Due soon"|"Needs review"|"Recency-based"|"Not recorded";tone:CredentialOverviewTone;reviewCount:number};

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
  // A LAPL SEP/TMG privilege has no invented fixed class-rating expiry.
  // Display any user-saved date informationally; without a date, delegate
  // the actual experience judgement to the separate Recency workspace.
  if(isLaplClass){
    const date=row.validityMode==="recency"?row.recencyUntil:row.validUntil;
    if((row.validityMode==="date"||row.validityMode==="recency")&&validDay(date))
      return storedDateEvidence("date",date,asOf);
    if(row.validityMode==="unlimited"||!date)return "separate";
  }
  return storedDateEvidence(row.validityMode,row.validityMode==="recency"?row.recencyUntil:row.validUntil,asOf);
}
function documentEvidence(row:DashboardDocumentSummary,asOf:string):DateEvidence{
  if(!row.label.trim())return "unknown";
  return storedDateEvidence(row.expiryDate==="9999-12-31"?"unlimited":"date",row.expiryDate,asOf);
}
function summarize<T>(records:readonly T[],asOf:string,evidence:(item:T,day:string)=>DateEvidence):CredentialOverviewGroup{
  if(!records.length)return{count:0,status:"Not recorded",tone:"muted",reviewCount:0};
  const states=records.map(item=>evidence(item,asOf));
  const reviewCount=states.filter(state=>state==="unknown"||state==="warning"||state==="danger").length;
  if(states.includes("danger"))return{count:records.length,status:"Date passed",tone:"danger",reviewCount};
  if(states.includes("warning"))return{count:records.length,status:"Due soon",tone:"warning",reviewCount};
  if(states.includes("unknown"))return{count:records.length,status:"Needs review",tone:"warning",reviewCount};
  if(states.includes("separate"))return{count:records.length,status:"Recency-based",tone:"muted",reviewCount:0};
  return{count:records.length,status:"No date alerts",tone:"neutral",reviewCount:0};
}
export function buildCredentialOverview(input:{licences:readonly DashboardLicenceSummary[];qualifications:readonly DashboardQualificationSummary[];documents:readonly DashboardDocumentSummary[];asOf:string}){
  const {documents,medical}=partitionCredentialDocuments(input.documents);
  return{
    licences:summarize(input.licences,input.asOf,licenceEvidence),
    ratings:summarize(input.qualifications,input.asOf,ratingEvidence),
    documents:summarize(documents,input.asOf,documentEvidence),
    medical:summarize(medical,input.asOf,documentEvidence),
  };
}
