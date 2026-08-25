export type BackupRow=Record<string,unknown>;
export type PortableBackup={
  format:string;version:number;schema_version?:number;exported_at:string;profile:BackupRow;counts:Record<string,number>;
  flights:BackupRow[];aircraft:BackupRow[];rates:BackupRow[];airports:BackupRow[];expiries:BackupRow[];
  settings:BackupRow[];flight_tracks:BackupRow[];track_points:BackupRow[];audit_log:BackupRow[];
  fstd_sessions:BackupRow[];flight_certified_revisions:BackupRow[];fstd_certified_revisions:BackupRow[];deleted_flights:BackupRow[];
  integrity:{algorithm:string;payload_sha256:string};
};

const legacyArrays=["flights","aircraft","rates","airports","expiries","settings","flight_tracks","track_points"] as const;
const v6Arrays=[...legacyArrays,"audit_log","fstd_sessions","flight_certified_revisions","fstd_certified_revisions","deleted_flights"] as const;
export const portableBackupDigest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const timeKey=(value:unknown)=>{const raw=String(value??"").trim();if(!raw)return"";const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toISOString()};
const sourceId=(row:BackupRow)=>String(row.id??"");

export function flightRestoreKey(row:BackupRow){return [String(row.date??"").slice(0,10),clean(row.registration),String(row.off_block??"").trim(),clean(row.departure),clean(row.arrival)].join("|")}
export function trackRestoreKey(flightKey:string,row:BackupRow){return [flightKey,String(row.file_name??"").trim(),timeKey(row.start_utc),timeKey(row.end_utc),Number(row.point_count||0)].join("|")}

export function validateBackupRelationships(backup:Pick<PortableBackup,"flights"|"flight_tracks"|"track_points">){
  const flightIds=new Set(backup.flights.map(row=>sourceId(row))),trackIds=new Set<string>();
  if(flightIds.has(""))throw new Error("A flight has no source identifier.");
  if(flightIds.size!==backup.flights.length)throw new Error("Duplicate flight source identifier detected.");
  for(const track of backup.flight_tracks){const id=sourceId(track);if(!id)throw new Error("A GPS track has no source identifier.");if(trackIds.has(id))throw new Error(`Duplicate GPS track identifier ${id}.`);trackIds.add(id);if(!flightIds.has(String(track.flight_id??"")))throw new Error(`GPS track ${id} refers to a missing flight.`)}
  for(const point of backup.track_points)if(!trackIds.has(String(point.track_id??"")))throw new Error("A legacy GPS point refers to a missing track.");
  return{flights:flightIds.size,tracks:trackIds.size,points:backup.track_points.length};
}

export function validateBackupArchiveRelationships(backup:Pick<PortableBackup,"flights"|"fstd_sessions"|"flight_certified_revisions"|"fstd_certified_revisions">){
  const flightIds=new Set(backup.flights.map(row=>sourceId(row))),fstdIds=new Set(backup.fstd_sessions.map(row=>sourceId(row))),flightRevisionKeys=new Set<string>(),fstdRevisionKeys=new Set<string>();
  if(fstdIds.has(""))throw new Error("An FSTD session has no source identifier.");if(fstdIds.size!==backup.fstd_sessions.length)throw new Error("Duplicate FSTD source identifier detected.");
  for(const revision of backup.flight_certified_revisions){const parent=String(revision.flight_id??""),number=Number(revision.revision_number||0),key=`${parent}|${number}`;if(!flightIds.has(parent))throw new Error("A certified flight revision refers to a missing flight.");if(number<1||flightRevisionKeys.has(key))throw new Error("Duplicate or invalid certified flight revision detected.");flightRevisionKeys.add(key)}
  for(const revision of backup.fstd_certified_revisions){const parent=String(revision.fstd_session_id??""),number=Number(revision.revision_number||0),key=`${parent}|${number}`;if(!fstdIds.has(parent))throw new Error("A certified FSTD revision refers to a missing FSTD session.");if(number<1||fstdRevisionKeys.has(key))throw new Error("Duplicate or invalid certified FSTD revision detected.");fstdRevisionKeys.add(key)}
  return{fstd:fstdIds.size,flightRevisions:flightRevisionKeys.size,fstdRevisions:fstdRevisionKeys.size};
}

function validateOwnership(payload:Record<string,unknown>){
  const sourceUserId=Number((payload.profile as BackupRow|undefined)?.id||0);if(!Number.isSafeInteger(sourceUserId)||sourceUserId<=0)throw new Error("Version 6 backup profile has no valid source account identifier.");
  for(const key of v6Arrays)for(const row of payload[key] as BackupRow[])if("user_id" in row&&Number(row.user_id)!==sourceUserId)throw new Error(`Backup section ${key} contains a record from another account.`);
  return sourceUserId;
}

export async function parsePortableBackup(source:string):Promise<{backup:PortableBackup;digest:string}>{
  let parsed:Record<string,unknown>;try{parsed=JSON.parse(source)}catch{throw new Error("File is not valid JSON.")}
  const integrity=parsed.integrity as Record<string,unknown>|undefined,{integrity:_removed,...payload}=parsed,version=Number(payload.version||0);
  if(payload.format!=="pilot-logbook-portable"||version<4)throw new Error("Unsupported portable backup format. Version 4 or newer is required.");
  for(const key of legacyArrays)if(!Array.isArray(payload[key]))throw new Error(`Backup section ${key} is missing.`);
  if(version>=5&&!Array.isArray(payload.audit_log))throw new Error("Backup section audit_log is missing.");
  if(version>=6)for(const key of ["fstd_sessions","flight_certified_revisions","fstd_certified_revisions","deleted_flights"] as const)if(!Array.isArray(payload[key]))throw new Error(`Backup section ${key} is missing.`);
  if((payload.flights as unknown[]).length>20_000||(payload.flight_tracks as unknown[]).length>30_000)throw new Error("Backup exceeds the safe number of flights or GPS tracks.");
  const expected=String(integrity?.payload_sha256??""),digest=await portableBackupDigest(JSON.stringify(payload));
  if(String(integrity?.algorithm??"").toUpperCase()!=="SHA-256"||!expected)throw new Error("Backup has no supported SHA-256 integrity value.");if(expected!==digest)throw new Error("Integrity check failed. The file is damaged or was modified.");
  if(!Array.isArray(payload.audit_log))payload.audit_log=[];if(!Array.isArray(payload.fstd_sessions))payload.fstd_sessions=[];if(!Array.isArray(payload.flight_certified_revisions))payload.flight_certified_revisions=[];if(!Array.isArray(payload.fstd_certified_revisions))payload.fstd_certified_revisions=[];if(!Array.isArray(payload.deleted_flights))payload.deleted_flights=[];
  const counts=payload.counts as Record<string,unknown>|undefined,countKeys=version>=6?v6Arrays:version>=5?[...legacyArrays,"audit_log"] as const:legacyArrays;
  for(const key of countKeys)if(Number(counts?.[key]??-1)!==(payload[key] as unknown[]).length)throw new Error(`Declared ${key} count does not match the backup content.`);
  if(version>=6)validateOwnership(payload);
  const backup={...(payload as Omit<PortableBackup,"integrity">),integrity:{algorithm:"SHA-256",payload_sha256:expected}} as PortableBackup;
  validateBackupRelationships(backup);if(version>=6)validateBackupArchiveRelationships(backup);
  return{backup,digest};
}
