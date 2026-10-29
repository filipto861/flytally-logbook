/**
 * DATA-1: fail-closed interpretation of a single PostgreSQL MVCC read snapshot.
 *
 * The Neon HTTP batch and the local psql adapter must return 32 results:
 * a transaction-state probe, the 30 original backup SELECTs, and the same
 * transaction-state probe again. Neither a digest nor a signature can make
 * an incomplete or mixed-snapshot response correct.
 */
export type AccountBackupSnapshotErrorCode=
  |"INVALID_USER_ID"
  |"SNAPSHOT_UNAVAILABLE"
  |"MALFORMED_SNAPSHOT"
  |"ISOLATION_NOT_ENFORCED"
  |"MISSING_PROFILE";

export class AccountBackupSnapshotError extends Error{
  readonly code:AccountBackupSnapshotErrorCode;
  constructor(code:AccountBackupSnapshotErrorCode,message:string){
    super(message);
    this.code=code;
    this.name="AccountBackupSnapshotError";
  }
}

type SnapshotRow=Record<string,unknown>;

const isRow=(value:unknown):value is SnapshotRow=>
  value!==null&&typeof value==="object"&&!Array.isArray(value);

function verifiedProbe(value:unknown):{snapshot:string}{
  if(!Array.isArray(value)||value.length!==1||!isRow(value[0])){
    throw new AccountBackupSnapshotError("MALFORMED_SNAPSHOT","Account backup snapshot verification is incomplete.");
  }
  const [row]=value;
  if(row.transaction_isolation!=="repeatable read"||row.transaction_read_only!=="on"){
    throw new AccountBackupSnapshotError("ISOLATION_NOT_ENFORCED","Account backup requires a read-only repeatable-read snapshot.");
  }
  if(typeof row.snapshot_id!=="string"||row.snapshot_id.length===0){
    throw new AccountBackupSnapshotError("MALFORMED_SNAPSHOT","Account backup has no confirmed snapshot identity.");
  }
  return{snapshot:row.snapshot_id};
}

export function validateAccountBackupSnapshotResults(
  result:unknown,
  userId:number,
):SnapshotRow[][]{
  if(!Number.isSafeInteger(userId)||userId<=0){
    throw new AccountBackupSnapshotError("INVALID_USER_ID","Account backup requires a valid account identifier.");
  }
  if(!Array.isArray(result)||result.length!==32){
    throw new AccountBackupSnapshotError("MALFORMED_SNAPSHOT","Account backup did not return all required sections.");
  }
  const first=verifiedProbe(result[0]),last=verifiedProbe(result[31]);
  if(first.snapshot!==last.snapshot){
    throw new AccountBackupSnapshotError("ISOLATION_NOT_ENFORCED","Account backup did not retain one database snapshot.");
  }
  const sections:SnapshotRow[][]=[];
  for(const rows of result.slice(1,31)){
    if(!Array.isArray(rows)||rows.some(row=>!isRow(row))){
      throw new AccountBackupSnapshotError("MALFORMED_SNAPSHOT","Account backup contains an incomplete section.");
    }
    sections.push(rows);
  }
  const profileRows=sections[29];
  if(profileRows.length!==1||!Number.isSafeInteger(Number(profileRows[0].id))
    ||Number(profileRows[0].id)!==userId){
    throw new AccountBackupSnapshotError("MISSING_PROFILE","Account backup cannot find its exact owning profile.");
  }
  return sections;
}
