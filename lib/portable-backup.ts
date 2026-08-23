export type BackupRow=Record<string,unknown>;
export type PortableBackup={
  format:string;version:number;exported_at:string;profile:BackupRow;counts:Record<string,number>;
  flights:BackupRow[];aircraft:BackupRow[];rates:BackupRow[];airports:BackupRow[];expiries:BackupRow[];
  settings:BackupRow[];flight_tracks:BackupRow[];track_points:BackupRow[];audit_log:BackupRow[];integrity:{algorithm:string;payload_sha256:string};
};

const arrays=["flights","aircraft","rates","airports","expiries","settings","flight_tracks","track_points"] as const;
export const portableBackupDigest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const timeKey=(value:unknown)=>{const raw=String(value??"").trim();if(!raw)return"";const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toISOString()};

export function flightRestoreKey(row:BackupRow){return [String(row.date??"").slice(0,10),clean(row.registration),String(row.off_block??"").trim(),clean(row.departure),clean(row.arrival)].join("|")}
export function trackRestoreKey(flightKey:string,row:BackupRow){return [flightKey,String(row.file_name??"").trim(),timeKey(row.start_utc),timeKey(row.end_utc),Number(row.point_count||0)].join("|")}

export function validateBackupRelationships(backup:Pick<PortableBackup,"flights"|"flight_tracks"|"track_points">){
  const flightIds=new Set(backup.flights.map(row=>String(row.id??""))),trackIds=new Set<string>();
  for(const track of backup.flight_tracks){
    const id=String(track.id??"");
    if(!id)throw new Error("A GPS track has no source identifier.");
    if(trackIds.has(id))throw new Error(`Duplicate GPS track identifier ${id}.`);
    trackIds.add(id);
    if(!flightIds.has(String(track.flight_id??"")))throw new Error(`GPS track ${id} refers to a missing flight.`);
  }
  for(const point of backup.track_points){
    if(!trackIds.has(String(point.track_id??"")))throw new Error("A legacy GPS point refers to a missing track.");
  }
  return{flights:flightIds.size,tracks:trackIds.size,points:backup.track_points.length};
}

export async function parsePortableBackup(source:string):Promise<{backup:PortableBackup;digest:string}>{
  let parsed:Record<string,unknown>;try{parsed=JSON.parse(source)}catch{throw new Error("File is not valid JSON.")}
  const integrity=parsed.integrity as Record<string,unknown>|undefined,{integrity:_removed,...payload}=parsed;
  if(payload.format!=="pilot-logbook-portable"||Number(payload.version)<4)throw new Error("Unsupported portable backup format. Version 4 or newer is required.");
  for(const key of arrays)if(!Array.isArray(payload[key]))throw new Error(`Backup section ${key} is missing.`);
  if(Number(payload.version)>=5&&!Array.isArray(payload.audit_log))throw new Error("Backup section audit_log is missing.");
  if((payload.flights as unknown[]).length>20_000||(payload.flight_tracks as unknown[]).length>30_000)throw new Error("Backup exceeds the safe number of flights or GPS tracks.");
  const expected=String(integrity?.payload_sha256??""),digest=await portableBackupDigest(JSON.stringify(payload));
  if(String(integrity?.algorithm??"").toUpperCase()!=="SHA-256"||!expected)throw new Error("Backup has no supported SHA-256 integrity value.");
  if(expected!==digest)throw new Error("Integrity check failed. The file is damaged or was modified.");
  if(!Array.isArray(payload.audit_log))payload.audit_log=[];
  const counts=payload.counts as Record<string,unknown>|undefined;
  for(const key of ["flights","aircraft","rates","airports","expiries","flight_tracks","track_points"] as const)if(Number(counts?.[key]??-1)!==(payload[key] as unknown[]).length)throw new Error(`Declared ${key} count does not match the backup content.`);
  if(Number(payload.version)>=5&&Number(counts?.audit_log??-1)!==(payload.audit_log as unknown[]).length)throw new Error("Declared audit_log count does not match the backup content.");
  const backup={...(payload as Omit<PortableBackup,"integrity">),integrity:{algorithm:"SHA-256",payload_sha256:expected}};
  validateBackupRelationships(backup);
  return{backup,digest};
}
