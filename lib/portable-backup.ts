import { canonicalEvidenceJson } from "./canonical-evidence.ts";

export type BackupRow=Record<string,unknown>;
export type PortableBackup={
  format:string;version:number;schema_version?:number;exported_at:string;profile:BackupRow;counts:Record<string,number>;
  flights:BackupRow[];aircraft:BackupRow[];rates:BackupRow[];airports:BackupRow[];expiries:BackupRow[];
  settings:BackupRow[];flight_tracks:BackupRow[];track_points?:BackupRow[];audit_log:BackupRow[];
  fstd_sessions:BackupRow[];flight_certified_revisions:BackupRow[];fstd_certified_revisions:BackupRow[];deleted_flights:BackupRow[];
  pilot_connections?:BackupRow[];flight_participations?:BackupRow[];instructor_flight_approvals?:BackupRow[];pilot_licences?:BackupRow[];pilot_qualifications?:BackupRow[];user_notifications?:BackupRow[];flight_verifications?:BackupRow[];connection_audit_log?:BackupRow[];flight_expenses?:BackupRow[];spl_recency_evidence?:BackupRow[];helicopter_recency_evidence?:BackupRow[];bpl_recency_evidence?:BackupRow[];
  voided_certified_flights?:BackupRow[];voided_flight_certified_revisions?:BackupRow[];voided_flight_verifications?:BackupRow[];voided_flight_archive_items?:BackupRow[];flight_source_provenance?:BackupRow[];
  integrity:{algorithm:string;payload_sha256:string;signature_version?:number;server_signature?:string};
};

const legacyArrays=["flights","aircraft","rates","airports","expiries","settings","flight_tracks","track_points"] as const;
const currentCoreArrays=["flights","aircraft","rates","airports","expiries","settings","flight_tracks"] as const;
const v6Arrays=[...legacyArrays,"audit_log","fstd_sessions","flight_certified_revisions","fstd_certified_revisions","deleted_flights"] as const;
const v7Arrays=[...v6Arrays,"pilot_connections","flight_participations","instructor_flight_approvals","pilot_licences","pilot_qualifications","user_notifications","flight_verifications","connection_audit_log"] as const;
const v8Arrays=[...v7Arrays,"flight_expenses"] as const;
const v9Arrays=[...v8Arrays,"spl_recency_evidence"] as const;
const v10Arrays=[...v9Arrays,"helicopter_recency_evidence"] as const;
const v11Arrays=[...v10Arrays,"bpl_recency_evidence"] as const;
const v13Arrays=[...currentCoreArrays,"audit_log","fstd_sessions","flight_certified_revisions","fstd_certified_revisions","deleted_flights","pilot_connections","flight_participations","instructor_flight_approvals","pilot_licences","pilot_qualifications","user_notifications","flight_verifications","connection_audit_log","flight_expenses","spl_recency_evidence","helicopter_recency_evidence","bpl_recency_evidence","voided_certified_flights","voided_flight_certified_revisions","voided_flight_verifications","voided_flight_archive_items","flight_source_provenance"] as const;
export function portableBackupRequiredSections(versionInput:number):readonly string[]{
  const version=Math.trunc(Number(versionInput)||0);
  if(version>=13)return v13Arrays;
  if(version>=11)return v11Arrays;
  if(version>=10)return v10Arrays;
  if(version>=9)return v9Arrays;
  if(version>=8)return v8Arrays;
  if(version>=7)return v7Arrays;
  if(version>=6)return v6Arrays;
  if(version>=5)return [...legacyArrays,"audit_log"];
  return legacyArrays;
}
export const portableBackupDigest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const timeKey=(value:unknown)=>{const raw=String(value??"").trim();if(!raw)return"";const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toISOString()};
const sourceId=(row:BackupRow)=>String(row.id??"");

export function flightRestoreKey(row:BackupRow){return [String(row.date??"").slice(0,10),clean(row.registration),String(row.off_block??"").trim(),clean(row.departure),clean(row.arrival)].join("|")}
export function trackRestoreKey(flightKey:string,row:BackupRow){return [flightKey,String(row.file_name??"").trim(),timeKey(row.start_utc),timeKey(row.end_utc),Number(row.point_count||0)].join("|")}

export function validateBackupRelationships(backup:Pick<PortableBackup,"flights"|"flight_tracks"|"track_points">&{flight_expenses?:BackupRow[]}){
  const flightIds=new Set(backup.flights.map(row=>sourceId(row))),trackIds=new Set<string>(),legacyPoints=backup.track_points??[];
  if(flightIds.has(""))throw new Error("A flight has no source identifier.");
  if(flightIds.size!==backup.flights.length)throw new Error("Duplicate flight source identifier detected.");
  for(const track of backup.flight_tracks){const id=sourceId(track);if(!id)throw new Error("A GPS track has no source identifier.");if(trackIds.has(id))throw new Error(`Duplicate GPS track identifier ${id}.`);trackIds.add(id);if(!flightIds.has(String(track.flight_id??"")))throw new Error(`GPS track ${id} refers to a missing flight.`)}
  for(const point of legacyPoints)if(!trackIds.has(String(point.track_id??"")))throw new Error("A legacy GPS point refers to a missing track.");
  for(const expense of backup.flight_expenses??[])if(!flightIds.has(String(expense.flight_id??"")))throw new Error("A flight expense refers to a missing flight.");
  return{flights:flightIds.size,tracks:trackIds.size,points:legacyPoints.length};
}

export function validateBackupArchiveRelationships(backup:Pick<PortableBackup,"flights"|"fstd_sessions"|"flight_certified_revisions"|"fstd_certified_revisions">){
  const flightIds=new Set(backup.flights.map(row=>sourceId(row))),fstdIds=new Set(backup.fstd_sessions.map(row=>sourceId(row))),flightRevisionKeys=new Set<string>(),fstdRevisionKeys=new Set<string>();
  if(fstdIds.has(""))throw new Error("An FSTD session has no source identifier.");if(fstdIds.size!==backup.fstd_sessions.length)throw new Error("Duplicate FSTD source identifier detected.");
  for(const revision of backup.flight_certified_revisions){const parent=String(revision.flight_id??""),number=Number(revision.revision_number||0),key=`${parent}|${number}`;if(!flightIds.has(parent))throw new Error("A certified flight revision refers to a missing flight.");if(number<1||flightRevisionKeys.has(key))throw new Error("Duplicate or invalid certified flight revision detected.");flightRevisionKeys.add(key)}
  for(const revision of backup.fstd_certified_revisions){const parent=String(revision.fstd_session_id??""),number=Number(revision.revision_number||0),key=`${parent}|${number}`;if(!fstdIds.has(parent))throw new Error("A certified FSTD revision refers to a missing FSTD session.");if(number<1||fstdRevisionKeys.has(key))throw new Error("Duplicate or invalid certified FSTD revision detected.");fstdRevisionKeys.add(key)}
  return{fstd:fstdIds.size,flightRevisions:flightRevisionKeys.size,fstdRevisions:fstdRevisionKeys.size};
}

export function validateVoidHistoryRelationships(backup:PortableBackup){
  if(Number(backup.version)<13)return{tombstones:0,revisions:0,verifications:0,items:0,provenance:0};
  const sourceUserId=Number(backup.profile?.id||0),flights=backup.flights??[],tombstones=backup.voided_certified_flights??[],revisions=backup.voided_flight_certified_revisions??[],verifications=backup.voided_flight_verifications??[],items=backup.voided_flight_archive_items??[],provenance=backup.flight_source_provenance??[];
  const tombstoneIds=new Set<string>(),tombstoneKeys=new Set<string>(),tombstoneById=new Map<string,BackupRow>(),activeIds=new Set(flights.filter(row=>Number(row.user_id||sourceUserId)===sourceUserId).map(row=>sourceId(row)));
  for(const row of tombstones){
    const rowId=sourceId(row),owner=Number(row.user_id||0),original=String(row.original_flight_id??""),key=`${owner}|${original}`;
    if(!rowId||!original)throw new Error("A voided certified flight has no stable identity.");
    if(owner!==sourceUserId)throw new Error("A voided certified flight belongs to another account.");
    if(tombstoneIds.has(rowId)||tombstoneKeys.has(key))throw new Error("Duplicate voided certified flight identity detected.");
    if(activeIds.has(original))throw new Error("Backup contains both an active flight and its voided certified tombstone.");
    const snapshot=row.flight_snapshot;
    if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw new Error("A voided certified flight has no valid protected snapshot.");
    const snap=snapshot as BackupRow;
    if(String(snap.id??"")!==original||Number(snap.user_id||0)!==owner||Number(snap.record_revision||1)!==Number(row.record_revision||1)||String(snap.certification_hash??"")!==String(row.certification_hash??"")||Number(snap.certification_version||1)!==Number(row.certification_version||1)||timeKey(snap.certified_at)!==timeKey(row.certified_at)||Number(snap.certified_by_user_id||0)!==Number(row.certified_by_user_id||0))throw new Error("A voided certified flight snapshot does not match its tombstone identity.");
    tombstoneIds.add(rowId);tombstoneKeys.add(key);tombstoneById.set(rowId,row);
  }
  for(const [label,rows] of [["revision",revisions],["verification",verifications],["archive item",items]] as const){
    for(const row of rows)if(!tombstoneIds.has(String(row.voided_flight_id??"")))throw new Error(`A voided-flight ${label} refers to a missing tombstone.`);
  }
  for(const row of revisions){
    const parent=tombstoneById.get(String(row.voided_flight_id??""))!,snapshot=row.snapshot_data as BackupRow|undefined;
    const revisionNumber=Number(row.revision_number||0);
    if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot)||String(snapshot.id??"")!==String(parent.original_flight_id??"")||Number(snapshot.user_id||0)!==Number(parent.user_id||0)||Number(snapshot.record_revision||1)!==revisionNumber||revisionNumber<1||revisionNumber>=Number(parent.record_revision||1))throw new Error("A voided certified revision does not match its source tombstone history.");
  }
  for(const row of verifications){
    const parent=tombstoneById.get(String(row.voided_flight_id??""))!,source=row.source_data as BackupRow|undefined;
    const revisionNumber=Number(row.record_revision||0);
    if(!source||typeof source!=="object"||Array.isArray(source)||String(source.id??"")!==String(row.source_verification_id??"")||String(source.flight_id??"")!==String(parent.original_flight_id??"")||Number(source.flight_user_id||0)!==Number(parent.user_id||0)||revisionNumber<1||revisionNumber>Number(parent.record_revision||1))throw new Error("A voided verification does not match its source tombstone history.");
  }
  const flightIds=new Set(flights.map(row=>sourceId(row)));
  for(const row of provenance){
    if(Number(row.participant_user_id||0)!==sourceUserId)throw new Error("Backup contains participant provenance owned by another account.");
    if(!flightIds.has(String(row.participant_flight_id??"")))throw new Error("Participant provenance refers to a missing participant-owned flight.");
    const bound=String(row.source_voided_flight_id??"").trim();if(!bound)continue;
    const parent=tombstoneById.get(bound);
    if(Number(row.source_user_id||0)===sourceUserId){
      if(!parent)throw new Error("Participant provenance refers to a missing same-account source tombstone.");
      if(String(parent.original_flight_id??"")!==String(row.source_flight_id??"")||Number(parent.record_revision||1)!==Number(row.source_revision||1)||String(parent.certification_hash??"")!==String(row.source_hash??""))throw new Error("Participant provenance does not match its source tombstone revision/hash.");
    }
  }
  return{tombstones:tombstones.length,revisions:revisions.length,verifications:verifications.length,items:items.length,provenance:provenance.length};
}

async function validateVoidHistoryDigests(backup:PortableBackup){
  if(Number(backup.version)<13)return;
  const check=async(value:unknown,expected:unknown,label:string)=>{
    const stored=String(expected??"").trim(),actual=await portableBackupDigest(canonicalEvidenceJson(value));
    if(!/^[a-f0-9]{64}$/.test(stored)||stored!==actual)throw new Error(`${label} SHA-256 does not match its protected JSON evidence.`);
  };
  for(const row of backup.voided_certified_flights??[])await check(row.flight_snapshot,row.flight_snapshot_sha256,`Voided certified flight ${String(row.id??"?")}`);
  for(const row of backup.voided_flight_certified_revisions??[])await check(row.snapshot_data,row.snapshot_sha256,`Voided certified revision ${String(row.id??"?")}`);
  for(const row of backup.voided_flight_verifications??[])await check(row.source_data,row.source_sha256,`Voided verification ${String(row.id??"?")}`);
  for(const row of backup.voided_flight_archive_items??[])await check(row.source_data,row.source_sha256,`Voided archive item ${String(row.id??"?")}`);
}

function validateOwnership(payload:Record<string,unknown>){
  const sourceUserId=Number((payload.profile as BackupRow|undefined)?.id||0);if(!Number.isSafeInteger(sourceUserId)||sourceUserId<=0)throw new Error("Version 6 backup profile has no valid source account identifier.");
  for(const key of v6Arrays)for(const row of payload[key] as BackupRow[])if("user_id" in row&&Number(row.user_id)!==sourceUserId)throw new Error(`Backup section ${key} contains a record from another account.`);
  if(Number(payload.version||0)>=7){
    for(const row of payload.pilot_connections as BackupRow[])if(Number(row.requester_user_id)!==sourceUserId&&Number(row.recipient_user_id)!==sourceUserId)throw new Error("Backup contains an unrelated connection.");
    for(const row of payload.flight_participations as BackupRow[])if(Number(row.source_user_id)!==sourceUserId&&Number(row.participant_user_id)!==sourceUserId)throw new Error("Backup contains an unrelated flight participation.");
    for(const row of payload.instructor_flight_approvals as BackupRow[])if(Number(row.student_user_id)!==sourceUserId&&Number(row.instructor_user_id)!==sourceUserId)throw new Error("Backup contains an unrelated approval.");
    for(const row of payload.flight_verifications as BackupRow[])if(Number(row.flight_user_id)!==sourceUserId&&Number(row.signer_user_id)!==sourceUserId)throw new Error("Backup contains an unrelated verification.");
    for(const row of payload.connection_audit_log as BackupRow[])if(Number(row.actor_user_id)!==sourceUserId&&Number(row.subject_user_id)!==sourceUserId)throw new Error("Backup contains an unrelated connection audit event.");
    for(const key of ["pilot_licences","pilot_qualifications","user_notifications"] as const)for(const row of payload[key] as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error(`Backup section ${key} contains a record from another account.`);
  }
  if(Number(payload.version||0)>=8)for(const row of payload.flight_expenses as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error("Backup contains a flight expense from another account.");
  if(Number(payload.version||0)>=9)for(const row of payload.spl_recency_evidence as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error("Backup contains SPL recency evidence from another account.");
  if(Number(payload.version||0)>=10)for(const row of payload.helicopter_recency_evidence as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error("Backup contains helicopter recency evidence from another account.");
  if(Number(payload.version||0)>=11)for(const row of payload.bpl_recency_evidence as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error("Backup contains BPL recency evidence from another account.");
  if(Number(payload.version||0)>=13){
    for(const row of payload.voided_certified_flights as BackupRow[])if(Number(row.user_id)!==sourceUserId)throw new Error("Backup contains a voided certified flight from another account.");
    for(const row of payload.flight_source_provenance as BackupRow[])if(Number(row.participant_user_id)!==sourceUserId)throw new Error("Backup contains participant provenance owned by another account.");
  }
  return sourceUserId;
}

export async function parsePortableBackup(source:string):Promise<{backup:PortableBackup;digest:string}>{
  let parsed:Record<string,unknown>;try{parsed=JSON.parse(source)}catch{throw new Error("File is not valid JSON.")}
  const integrity=parsed.integrity as Record<string,unknown>|undefined,{integrity:_removed,...payload}=parsed,version=Number(payload.version||0);
  if(payload.format!=="pilot-logbook-portable"||version<4)throw new Error("Unsupported portable backup format. Version 4 or newer is required.");
  const expected=String(integrity?.payload_sha256??""),digest=await portableBackupDigest(JSON.stringify(payload));
  if(String(integrity?.algorithm??"").toUpperCase()!=="SHA-256"||!expected)throw new Error("Backup has no supported SHA-256 integrity value.");
  if(expected!==digest)throw new Error("Integrity check failed. The file is damaged or was modified.");
  const requiredSections=portableBackupRequiredSections(version);for(const key of requiredSections)if(!Array.isArray(payload[key]))throw new Error(`Backup section ${key} is missing.`);
  if((payload.flights as unknown[]).length>20_000||(payload.flight_tracks as unknown[]).length>30_000)throw new Error("Backup exceeds the safe number of flights or GPS tracks.");
  if(!Array.isArray(payload.track_points))payload.track_points=[];if(!Array.isArray(payload.audit_log))payload.audit_log=[];if(!Array.isArray(payload.fstd_sessions))payload.fstd_sessions=[];if(!Array.isArray(payload.flight_certified_revisions))payload.flight_certified_revisions=[];if(!Array.isArray(payload.fstd_certified_revisions))payload.fstd_certified_revisions=[];if(!Array.isArray(payload.deleted_flights))payload.deleted_flights=[];for(const key of v7Arrays)if(!Array.isArray(payload[key]))payload[key]=[];if(!Array.isArray(payload.flight_expenses))payload.flight_expenses=[];if(!Array.isArray(payload.spl_recency_evidence))payload.spl_recency_evidence=[];if(!Array.isArray(payload.helicopter_recency_evidence))payload.helicopter_recency_evidence=[];if(!Array.isArray(payload.bpl_recency_evidence))payload.bpl_recency_evidence=[];for(const key of ["voided_certified_flights","voided_flight_certified_revisions","voided_flight_verifications","voided_flight_archive_items","flight_source_provenance"] as const)if(!Array.isArray(payload[key]))payload[key]=[];
  const counts=payload.counts as Record<string,unknown>|undefined;
  for(const key of requiredSections)if(Number(counts?.[key]??-1)!==(payload[key] as unknown[]).length)throw new Error(`Declared ${key} count does not match the backup content.`);
  if(version>=6)validateOwnership(payload);
  const backup={...(payload as Omit<PortableBackup,"integrity">),integrity:{algorithm:"SHA-256",payload_sha256:expected,signature_version:Number(integrity?.signature_version||0)||undefined,server_signature:String(integrity?.server_signature??"").trim()||undefined}} as PortableBackup;
  validateBackupRelationships(backup);if(version>=6)validateBackupArchiveRelationships(backup);if(version>=13){validateVoidHistoryRelationships(backup);await validateVoidHistoryDigests(backup)}
  return{backup,digest};
}
