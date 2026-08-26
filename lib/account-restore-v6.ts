import "server-only";
import { sql } from "@/lib/db";
import { validateBackupCertificationHistory,type BackupCertificationSummary } from "@/lib/backup-certification";
import { flightRestoreKey,type BackupRow,type PortableBackup } from "@/lib/portable-backup";

export type ExactRestorePreview={digest:string;exportedAt:string;source:Record<string,number>;add:Record<string,number>;skip:Record<string,number>;settings:boolean;legacyPoints:number;accountBound:boolean;schemaVersion:number;certification:BackupCertificationSummary};
export type ExactRestorePlan={preview:ExactRestorePreview;addRows:Record<string,BackupRow[]>};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const id=(row:BackupRow)=>String(row.id??"");
const chunks=<T>(rows:T[],size:number)=>Array.from({length:Math.ceil(rows.length/size)},(_,index)=>rows.slice(index*size,(index+1)*size));
const flightKey=(row:BackupRow)=>flightRestoreKey(row);
const aircraftKey=(row:BackupRow)=>upper(row.registration);
const rateKey=(row:BackupRow)=>`${upper(row.registration)}|${text(row.valid_from).slice(0,10)}`;
const airportKey=(row:BackupRow)=>upper(row.ident);
const expiryKey=(row:BackupRow)=>`${upper(row.category)}|${upper(row.label)}|${text(row.expiry_date).slice(0,10)}`;
const trackKey=(row:BackupRow)=>`${String(row.flight_id??"")}|${text(row.file_name)}|${text(row.start_utc)}|${text(row.end_utc)}|${Number(row.point_count||0)}`;
const pointKey=(row:BackupRow)=>`${String(row.track_id??"")}|${String(row.seq??"")}`;
const fstdKey=(row:BackupRow)=>`${text(row.session_date).slice(0,10)}|${upper(row.device_type)}|${upper(row.qualification_number)}|${upper(row.instruction)}|${Number(row.total_minutes||0)}`;
const flightRevisionKey=(row:BackupRow)=>`${String(row.flight_id??"")}|${Number(row.revision_number||0)}`;
const fstdRevisionKey=(row:BackupRow)=>`${String(row.fstd_session_id??"")}|${Number(row.revision_number||0)}`;
const auditKey=(row:BackupRow)=>id(row);
const deletedKey=(row:BackupRow)=>text(row.delete_token);

function classify(source:BackupRow[],current:BackupRow[],key:(row:BackupRow)=>string,label:string,requireStableId=true){
  const byId=new Map(current.filter(row=>id(row)).map(row=>[id(row),row])),byKey=new Map(current.filter(row=>key(row)).map(row=>[key(row),row])),add:BackupRow[]=[];
  let skip=0;
  for(const row of source){
    const sourceId=id(row),natural=key(row);
    if(requireStableId&&sourceId&&byId.has(sourceId)){skip++;continue}
    const match=natural?byKey.get(natural):undefined;
    if(match){
      if(requireStableId&&sourceId&&id(match)!==sourceId)throw new Error(`${label} restore conflict: ${natural} already exists under record ${id(match)} instead of source record ${sourceId}. Exact recovery was stopped.`);
      skip++;continue;
    }
    add.push(row);
  }
  return{add,skip};
}

function checkExistingCertification(source:BackupRow[],current:BackupRow[],label:string){
  const byId=new Map(current.map(row=>[id(row),row]));
  for(const row of source){const existing=byId.get(id(row));if(!existing)continue;const sourceRevision=Math.max(1,Number(row.record_revision||1)),currentRevision=Math.max(1,Number(existing.record_revision||1));if(currentRevision<sourceRevision)throw new Error(`${label} ${id(row)} exists at revision ${currentRevision}, but the backup contains newer revision ${sourceRevision}. Non-destructive recovery was stopped.`);if(currentRevision===sourceRevision&&text(row.certification_hash)&&text(existing.certification_hash)!==text(row.certification_hash))throw new Error(`${label} ${id(row)} has a different certification fingerprint at revision ${sourceRevision}. Exact recovery was stopped.`)}
}
function checkExistingRevisionHashes(source:BackupRow[],current:BackupRow[],parentField:string,label:string){const byKey=new Map(current.map(row=>[`${String(row[parentField]??"")}|${Number(row.revision_number||0)}`,row]));for(const row of source){const key=`${String(row[parentField]??"")}|${Number(row.revision_number||0)}`,existing=byKey.get(key);if(existing&&text(existing.certification_hash)!==text(row.certification_hash))throw new Error(`${label} ${key} has a different archived certification fingerprint. Exact recovery was stopped.`)}}

export async function prepareExactAccountRestore(userId:number,backup:PortableBackup,digest:string):Promise<ExactRestorePlan>{
  const certification=validateBackupCertificationHistory(backup,userId);
  const [flights,aircraft,rates,airports,expiries,tracks,points,fstd,flightRevisions,fstdRevisions,audit,deleted]=await Promise.all([
    sql`SELECT id,date::text date,registration,off_block,departure,arrival,record_revision,certified_at,certification_hash FROM flights WHERE user_id=${userId}`,
    sql`SELECT id,registration FROM aircraft WHERE user_id=${userId}`,
    sql`SELECT id,registration,COALESCE(valid_from,'') valid_from FROM rates WHERE user_id=${userId}`,
    sql`SELECT id,ident FROM airports WHERE user_id=${userId}`,
    sql`SELECT id,category,label,expiry_date::text expiry_date FROM user_expiries WHERE user_id=${userId}`,
    sql`SELECT id,flight_id,file_name,start_utc::text start_utc,end_utc::text end_utc,point_count FROM flight_tracks WHERE user_id=${userId}`,
    sql`SELECT track_id,seq FROM track_points WHERE user_id=${userId}`,
    sql`SELECT id,session_date::text session_date,device_type,qualification_number,instruction,total_minutes,record_revision,certified_at,certification_hash FROM fstd_sessions WHERE user_id=${userId}`,
    sql`SELECT id,flight_id,revision_number,certification_hash FROM flight_certified_revisions WHERE user_id=${userId}`,
    sql`SELECT id,fstd_session_id,revision_number,certification_hash FROM fstd_certified_revisions WHERE user_id=${userId}`,
    sql`SELECT id FROM flight_audit_log WHERE user_id=${userId}`,
    sql`SELECT id,delete_token FROM deleted_flights WHERE user_id=${userId}`,
  ]) as Array<Array<BackupRow>>;
  checkExistingCertification(backup.flights,flights,"Flight");checkExistingCertification(backup.fstd_sessions,fstd,"FSTD session");checkExistingRevisionHashes(backup.flight_certified_revisions,flightRevisions,"flight_id","Certified flight revision");checkExistingRevisionHashes(backup.fstd_certified_revisions,fstdRevisions,"fstd_session_id","Certified FSTD revision");

  const sections:[string,BackupRow[],BackupRow[],(row:BackupRow)=>string,string,boolean][]=[
    ["flights",backup.flights,flights,flightKey,"Flight",true],
    ["aircraft",backup.aircraft,aircraft,aircraftKey,"Aircraft",true],
    ["rates",backup.rates,rates,rateKey,"Rate",true],
    ["airports",backup.airports,airports,airportKey,"Airport",true],
    ["expiries",backup.expiries,expiries,expiryKey,"Licence/document",true],
    ["flight_tracks",backup.flight_tracks,tracks,trackKey,"GPS track",true],
    ["track_points",backup.track_points,points,pointKey,"Legacy GPS point",false],
    ["fstd_sessions",backup.fstd_sessions,fstd,fstdKey,"FSTD session",true],
    ["flight_certified_revisions",backup.flight_certified_revisions,flightRevisions,flightRevisionKey,"Certified flight revision",true],
    ["fstd_certified_revisions",backup.fstd_certified_revisions,fstdRevisions,fstdRevisionKey,"Certified FSTD revision",true],
    ["audit_log",backup.audit_log,audit,auditKey,"Audit event",true],
    ["deleted_flights",backup.deleted_flights,deleted,deletedKey,"Trash record",true],
  ];
  const source:Record<string,number>={},add:Record<string,number>={},skip:Record<string,number>={},addRows:Record<string,BackupRow[]>={};
  for(const [name,backupRows,currentRows,key,label,stable] of sections){const result=classify(backupRows,currentRows,key,label,stable);source[name]=backupRows.length;add[name]=result.add.length;skip[name]=result.skip;addRows[name]=result.add}
  return{preview:{digest,exportedAt:String(backup.exported_at||""),source,add,skip,settings:Boolean(backup.settings[0]),legacyPoints:backup.track_points.length,accountBound:true,schemaVersion:Number(backup.schema_version||0),certification},addRows};
}

function stageFlight(row:BackupRow):BackupRow{return{...row,aircraft_make:"",aircraft_model:"",aircraft_variant:"",certified_at:null,certified_by_user_id:null,certification_hash:"",locked_at:null,locked_by_user_id:null}}
function stageFstd(row:BackupRow):BackupRow{return{...row,certified_at:null,certified_by_user_id:null,certification_hash:""}}

export async function executeExactAccountRestore(userId:number,backup:PortableBackup,plan:ExactRestorePlan){
  validateBackupCertificationHistory(backup,userId);
  const maxAudit=await sql`SELECT COALESCE(MAX(id),0)::bigint id FROM flight_audit_log` as Array<{id:number|string}>;const auditFloor=Number(maxAudit[0]?.id||0);
  const queries:any[]=[];
  const profileName=text(backup.profile?.display_name);if(profileName)queries.push(sql`UPDATE users SET display_name=${profileName},updated_at=NOW() WHERE id=${userId} AND COALESCE(TRIM(display_name),'')=''`);
  for(const batch of chunks(backup.settings,20))queries.push(sql`INSERT INTO user_settings SELECT (json_populate_record(NULL::user_settings,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.aircraft??[],100))queries.push(sql`INSERT INTO aircraft SELECT (json_populate_record(NULL::aircraft,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.rates??[],150))queries.push(sql`INSERT INTO rates SELECT (json_populate_record(NULL::rates,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.airports??[],150))queries.push(sql`INSERT INTO airports SELECT (json_populate_record(NULL::airports,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.expiries??[],100))queries.push(sql`INSERT INTO user_expiries SELECT (json_populate_record(NULL::user_expiries,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);

  const newFlights=plan.addRows.flights??[];
  for(const batch of chunks(newFlights.map(stageFlight),75))queries.push(sql`INSERT INTO flights SELECT (json_populate_record(NULL::flights,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(newFlights,75))queries.push(sql`UPDATE flights f SET aircraft_make=COALESCE(item->>'aircraft_make',''),aircraft_model=COALESCE(item->>'aircraft_model',item->>'aircraft_type',''),aircraft_variant=COALESCE(item->>'aircraft_variant',''),certified_at=NULLIF(item->>'certified_at','')::timestamptz,certified_by_user_id=NULLIF(item->>'certified_by_user_id','')::bigint,certification_hash=COALESCE(item->>'certification_hash',''),certification_version=COALESCE(NULLIF(item->>'certification_version','')::int,1),locked_at=NULLIF(item->>'locked_at','')::timestamptz,locked_by_user_id=NULLIF(item->>'locked_by_user_id','')::bigint FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) WHERE f.user_id=${userId} AND f.id=(item->>'id')::bigint`);

  const newFstd=plan.addRows.fstd_sessions??[];
  for(const batch of chunks(newFstd.map(stageFstd),100))queries.push(sql`INSERT INTO fstd_sessions SELECT (json_populate_record(NULL::fstd_sessions,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(newFstd,100))queries.push(sql`UPDATE fstd_sessions s SET certified_at=NULLIF(item->>'certified_at','')::timestamptz,certified_by_user_id=NULLIF(item->>'certified_by_user_id','')::bigint,certification_hash=COALESCE(item->>'certification_hash',''),certification_version=COALESCE(NULLIF(item->>'certification_version','')::int,1) FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) WHERE s.user_id=${userId} AND s.id=(item->>'id')::bigint`);

  for(const batch of chunks(plan.addRows.flight_tracks??[],75))queries.push(sql`INSERT INTO flight_tracks SELECT (json_populate_record(NULL::flight_tracks,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.track_points??[],750))queries.push(sql`INSERT INTO track_points SELECT (json_populate_record(NULL::track_points,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.flight_certified_revisions??[],100))queries.push(sql`INSERT INTO flight_certified_revisions SELECT (json_populate_record(NULL::flight_certified_revisions,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.fstd_certified_revisions??[],100))queries.push(sql`INSERT INTO fstd_certified_revisions SELECT (json_populate_record(NULL::fstd_certified_revisions,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);

  if(newFlights.length){const ids=JSON.stringify(newFlights.map(row=>String(row.id)));queries.push(sql`DELETE FROM flight_audit_log WHERE user_id=${userId} AND id>${auditFloor} AND flight_id IN (SELECT value::bigint FROM jsonb_array_elements_text(${ids}::jsonb))`)}
  for(const batch of chunks(plan.addRows.audit_log??[],150))queries.push(sql`INSERT INTO flight_audit_log SELECT (json_populate_record(NULL::flight_audit_log,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  for(const batch of chunks(plan.addRows.deleted_flights??[],100))queries.push(sql`INSERT INTO deleted_flights SELECT (json_populate_record(NULL::deleted_flights,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  if(Number(backup.version)>=7){
    for(const batch of chunks(backup.pilot_licences??[],100))queries.push(sql`INSERT INTO pilot_licences SELECT (json_populate_record(NULL::pilot_licences,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.pilot_qualifications??[],100))queries.push(sql`INSERT INTO pilot_qualifications SELECT (json_populate_record(NULL::pilot_qualifications,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.pilot_connections??[],100))queries.push(sql`INSERT INTO pilot_connections SELECT (json_populate_record(NULL::pilot_connections,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.instructor_flight_approvals??[],100))queries.push(sql`INSERT INTO instructor_flight_approvals SELECT (json_populate_record(NULL::instructor_flight_approvals,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.flight_participations??[],100))queries.push(sql`INSERT INTO flight_participations SELECT (json_populate_record(NULL::flight_participations,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.flight_verifications??[],100))queries.push(sql`INSERT INTO flight_verifications SELECT (json_populate_record(NULL::flight_verifications,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.user_notifications??[],150))queries.push(sql`INSERT INTO user_notifications SELECT (json_populate_record(NULL::user_notifications,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
    for(const batch of chunks(backup.connection_audit_log??[],150))queries.push(sql`INSERT INTO connection_audit_log SELECT (json_populate_record(NULL::connection_audit_log,item)).* FROM json_array_elements(${JSON.stringify(batch)}::json) AS items(item) ON CONFLICT DO NOTHING`);
  }

  queries.push(sql`DO $$ DECLARE item record;seq_name text;current_value bigint;max_value bigint;BEGIN FOR item IN SELECT * FROM (VALUES ('flights'),('aircraft'),('rates'),('airports'),('user_expiries'),('flight_tracks'),('flight_audit_log'),('fstd_sessions'),('flight_certified_revisions'),('fstd_certified_revisions'),('deleted_flights'),('pilot_licences'),('pilot_qualifications'),('pilot_connections'),('instructor_flight_approvals'),('flight_participations'),('flight_verifications'),('user_notifications'),('connection_audit_log')) AS v(table_name) LOOP seq_name:=pg_get_serial_sequence(item.table_name,'id');IF seq_name IS NOT NULL THEN EXECUTE format('SELECT last_value FROM %s',seq_name) INTO current_value;EXECUTE format('SELECT COALESCE(MAX(id),0) FROM %I',item.table_name) INTO max_value;IF max_value>current_value THEN PERFORM setval(seq_name,max_value,true);END IF;END IF;END LOOP;END $$`);
  if(queries.length>1000)throw new Error("Backup restore plan is too large for one atomic database transaction.");
  await sql.transaction(queries);
  return{added:Object.values(plan.preview.add).reduce((sum,value)=>sum+value,0),queries:queries.length};
}
