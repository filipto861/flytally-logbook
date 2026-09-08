export type RecoveryConflictCode="record-identity"|"newer-backup-revision"|"certification-fingerprint"|"archived-certification-fingerprint";
export type RecoveryConflict={code:RecoveryConflictCode;title:string;record:string;detail:string};

type Row=Record<string,unknown>;
const text=(value:unknown)=>String(value??"").trim();
const revision=(value:unknown)=>Math.max(1,Number(value||1));

export class AccountRestoreConflictError extends Error{
  readonly conflict:RecoveryConflict;
  constructor(conflict:RecoveryConflict){super(conflict.detail);this.name="AccountRestoreConflictError";this.conflict=conflict}
}

export function recordIdentityConflict(label:string,naturalKey:string,sourceId:string,currentId:string):RecoveryConflict{
  const record=naturalKey||sourceId||label;
  return{code:"record-identity",title:`${label} identity conflict`,record,detail:`The backup record ${sourceId||"without an ID"} matches existing ${label.toLowerCase()} data stored under record ${currentId||"a different ID"}. FlyTally will not merge two identities automatically.`};
}

export function currentCertificationConflict(source:Row,current:Row,label:string):RecoveryConflict|null{
  const sourceId=text(source.id)||"?",sourceRevision=revision(source.record_revision),currentRevision=revision(current.record_revision),sourceHash=text(source.certification_hash),currentHash=text(current.certification_hash);
  if(currentRevision<sourceRevision)return{code:"newer-backup-revision",title:"Backup contains newer certified history",record:`${label} ${sourceId}`,detail:`This account has revision ${currentRevision}, while the backup contains revision ${sourceRevision}. Non-destructive recovery will not replace the existing record automatically.`};
  if(currentRevision===sourceRevision&&sourceHash&&currentHash!==sourceHash)return{code:"certification-fingerprint",title:"Certification fingerprint conflict",record:`${label} ${sourceId} · revision ${sourceRevision}`,detail:"The account and backup contain the same certified revision number with different certification fingerprints. Recovery is blocked to protect authoritative history."};
  return null;
}

export function archivedCertificationConflict(source:Row,current:Row,parentField:string,label:string):RecoveryConflict|null{
  const parent=text(source[parentField])||"?",revisionNumber=Number(source.revision_number||0),sourceHash=text(source.certification_hash),currentHash=text(current.certification_hash);
  if(sourceHash===currentHash)return null;
  return{code:"archived-certification-fingerprint",title:"Archived certification history conflict",record:`${label} ${parent} · revision ${revisionNumber}`,detail:"The archived revision already stored in this account has a different certification fingerprint from the backup. Recovery is blocked before any data is changed."};
}
