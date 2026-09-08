export const EXACT_RESTORE_STATEMENT_LIMIT=1000;

export const RESTORE_BATCH_SIZES={
  settings:20,
  aircraft:100,
  rates:150,
  airports:150,
  expiries:100,
  flights:500,
  flight_expenses:250,
  spl_recency_evidence:100,
  helicopter_recency_evidence:100,
  bpl_recency_evidence:100,
  fstd_sessions:500,
  flight_tracks:100,
  track_points:1000,
  flight_certified_revisions:250,
  fstd_certified_revisions:250,
  audit_log:500,
  deleted_flights:250,
  pilot_licences:250,
  pilot_qualifications:250,
  pilot_connections:250,
  instructor_flight_approvals:250,
  flight_participations:250,
  flight_verifications:250,
  user_notifications:500,
  connection_audit_log:500,
} as const;

export type RecoveryBatchSection=keyof typeof RESTORE_BATCH_SIZES;
export type RecoveryScaleCounts=Partial<Record<RecoveryBatchSection,number>>;

const batches=(count:number,size:number)=>Math.ceil(Math.max(0,Math.trunc(Number(count)||0))/size);

export function estimateExactRestoreStatements(counts:RecoveryScaleCounts,options:{profileUpdate?:boolean}={}):number{
  let statements=1+(options.profileUpdate?1:0);
  for(const section of Object.keys(RESTORE_BATCH_SIZES) as RecoveryBatchSection[]){
    const multiplier=section==='flights'||section==='fstd_sessions'?2:1;
    statements+=batches(counts[section]??0,RESTORE_BATCH_SIZES[section])*multiplier;
  }
  if((counts.flights??0)>0)statements+=1;
  return statements;
}
