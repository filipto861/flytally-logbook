export const COMMERCIAL_RELEASE_AUDIT_VERSION="2026-09-18-c6-v1";
export const COMMERCIAL_RELEASE_EXTERNAL_EVIDENCE_VERSION:string|null=null;

type Env=Readonly<Record<string,string|undefined>>;

export type CommercialReleaseControl=Readonly<{
  auditVersion:string;
  requestedAuditVersion:string|null;
  externalEvidenceVersion:string|null;
  finalApprovalRecorded:boolean;
  commercialReady:boolean;
  blockers:readonly string[];
}>;

function normalized(value:string|undefined):string|null{
  const result=value?.trim();
  return result||null;
}

export function getCommercialReleaseControl(env:Env=process.env):CommercialReleaseControl{
  const requestedAuditVersion=normalized(env.COMMERCIAL_RELEASE_AUDIT_VERSION);
  const finalApprovalRecorded=env.COMMERCIAL_FINAL_RELEASE_STATUS?.trim().toUpperCase()==="APPROVED";
  const blockers:string[]=[];

  if(requestedAuditVersion!==COMMERCIAL_RELEASE_AUDIT_VERSION)blockers.push("final-release-audit-version");
  if(!finalApprovalRecorded)blockers.push("final-release-approval");
  if(COMMERCIAL_RELEASE_EXTERNAL_EVIDENCE_VERSION!==COMMERCIAL_RELEASE_AUDIT_VERSION)blockers.push("final-release-evidence");

  return{
    auditVersion:COMMERCIAL_RELEASE_AUDIT_VERSION,
    requestedAuditVersion,
    externalEvidenceVersion:COMMERCIAL_RELEASE_EXTERNAL_EVIDENCE_VERSION,
    finalApprovalRecorded,
    commercialReady:blockers.length===0,
    blockers,
  };
}
