import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { before,test } from "node:test";
import { bootstrapProductionSchema,importServerModule } from "./server-modules.ts";

// Behavioural test of the portable account backup. It calls the real buildAccountBackup()
// from lib/account-backup.ts on the full production-like schema, with two other pilots'
// data in every section, and checks tenant scope, completeness, the profile projection,
// the Trash filter and the server signature.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const A=9001,B=9002,C=9003;

function psql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}

type Backup=Record<string,unknown>&{profile:Record<string,unknown>;counts:Record<string,number>;integrity:Record<string,unknown>;version:number};
let backup:Backup;
let json="";
let digest="";

before(async()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  bootstrapProductionSchema();
  // A owns or takes part in every row marked 'A'; rows marked 'X' belong to B and C only.
  psql(`
    INSERT INTO users(id,email,display_name,role,active,email_verified_at) VALUES(${C},'third@example.test','Third Pilot','user',1,NOW());
    INSERT INTO user_credentials(user_id,password_hash) VALUES(${C},'scrypt$third-secret-hash');
    INSERT INTO user_settings(user_id) VALUES(${C}) ON CONFLICT DO NOTHING;
    INSERT INTO flights(id,user_id,date,registration,note) VALUES(9101,${A},'2026-09-01','OK-AAA','A'),(9201,${B},'2026-09-01','OK-BBB','X'),(9301,${C},'2026-09-01','OK-CCC','X');
    INSERT INTO aircraft(user_id,registration) VALUES(${B},'OK-XBB');
    INSERT INTO rates(user_id,registration,valid_from) VALUES(${A},'OK-AAA','2026-01-01'),(${B},'OK-XBB','2026-01-01');
    INSERT INTO airports(user_id,ident,name) VALUES(${A},'ZZZA','A'),(${B},'ZZZB','X');
    INSERT INTO user_expiries(user_id,label,expiry_date) VALUES(${A},'A','2027-01-01'),(${B},'X','2027-01-01');
    INSERT INTO flight_tracks(user_id,flight_id,file_name) VALUES(${A},9101,'A'),(${B},9201,'X');
    INSERT INTO flight_audit_log(flight_id,user_id,action) VALUES(9101,${A},'created'),(9201,${B},'created');
    INSERT INTO fstd_sessions(id,user_id,session_date,device_type,total_minutes,remarks) VALUES(9111,${A},'2026-09-02','FNPT II',60,'A'),(9211,${B},'2026-09-02','FNPT II',60,'X');
    INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency) VALUES(${A},9101,'FUEL','A',100,'EUR'),(${B},9201,'FUEL','X',100,'EUR');
    INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data) VALUES(${A},8101,'A-active','{"note":"A"}');
    INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,restored_at) VALUES(${A},8102,'A-restored','{"note":"X"}',NOW());
    INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,purge_after) VALUES(${A},8103,'A-expired','{"note":"X"}',NOW()-INTERVAL '1 day');
    INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data) VALUES(${B},8201,'B-active','{"note":"X"}');
    INSERT INTO pilot_connections(requester_user_id,recipient_user_id,status) VALUES(${B},${C},'pending');
    INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,status) VALUES
      (9101,${A},${B},'INSTRUCTOR','pending'),(9201,${B},${A},'PIC','pending'),(9301,${B},${C},'PIC','pending');
    INSERT INTO instructor_flight_approvals(flight_id,student_user_id,instructor_user_id) VALUES(9101,${A},${B}),(9201,${B},${A}),(9301,${C},${B});
    INSERT INTO pilot_licences(user_id,licence_type,licence_number,validity_mode) VALUES(${A},'PPL(A)','A','unlimited'),(${B},'PPL(A)','X','unlimited');
    INSERT INTO pilot_qualifications(user_id,qualification_type,validity_mode) VALUES(${A},'SEP','unlimited'),(${B},'SEP','unlimited');
    INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key) VALUES(${B},'info','X','X','/','x-only');
    INSERT INTO flight_verifications(flight_id,flight_user_id,signer_user_id,verification_role,record_revision,flight_hash) VALUES
      (9101,${A},${B},'INSTRUCTOR',1,'A'),(9201,${B},${A},'INSTRUCTOR',1,'A'),(9201,${B},${C},'INSTRUCTOR',1,'X');
    INSERT INTO connection_audit_log(actor_user_id,subject_user_id,entity_type,entity_id,event_type) VALUES
      (${A},${B},'connection',1,'A'),(${B},${A},'connection',2,'A'),(${B},${C},'connection',3,'X');
    INSERT INTO spl_recency_evidence(user_id,aircraft_context,evidence_date,signer,reference) VALUES(${A},'SAILPLANE','2026-01-01','A','A'),(${B},'SAILPLANE','2026-01-01','X','X');
    INSERT INTO helicopter_recency_evidence(user_id,helicopter_type,evidence_date,signer,reference) VALUES(${A},'R44','2026-01-01','A','A'),(${B},'R44','2026-01-01','X','X');
    INSERT INTO bpl_recency_evidence(user_id,balloon_class,evidence_date,signer,reference) VALUES(${A},'HOT_AIR_BALLOON','2026-01-01','A','A'),(${B},'HOT_AIR_BALLOON','2026-01-01','X','X');
    INSERT INTO flight_source_provenance(participant_flight_id,participant_user_id,source_flight_id,source_user_id,source_revision,source_hash,participant_role) VALUES
      (9101,${A},9201,${B},1,'A','PIC'),(9301,${C},9201,${B},1,'X','PIC');
  `);
  // Certified history and void archives are written by protected paths in production;
  // the fixture inserts them directly with user triggers disabled for this one transaction.
  psql(`BEGIN;
    ALTER TABLE flight_certified_revisions DISABLE TRIGGER USER;
    ALTER TABLE fstd_certified_revisions DISABLE TRIGGER USER;
    ALTER TABLE voided_certified_flights DISABLE TRIGGER USER;
    ALTER TABLE voided_flight_certified_revisions DISABLE TRIGGER USER;
    ALTER TABLE voided_flight_verifications DISABLE TRIGGER USER;
    ALTER TABLE voided_flight_archive_items DISABLE TRIGGER USER;
    INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,snapshot_data,certification_hash,certified_at,superseded_by_user_id,correction_reason) VALUES
      (9101,${A},1,'{}','A',NOW(),${A},'A correction'),(9201,${B},1,'{}','X',NOW(),${B},'X correction');
    INSERT INTO fstd_certified_revisions(fstd_session_id,user_id,revision_number,snapshot_data,certification_hash,certified_at,superseded_by_user_id,correction_reason) VALUES
      (9111,${A},1,'{}','A',NOW(),${A},'A correction'),(9211,${B},1,'{}','X',NOW(),${B},'X correction');
    INSERT INTO voided_certified_flights(id,user_id,original_flight_id,record_revision,certification_hash,certification_version,certified_at,flight_snapshot,flight_snapshot_sha256,voided_by_user_id,void_reason,operation_token) VALUES
      (9121,${A},7101,1,'A',8,NOW(),'{}',repeat('a',64),${A},'A void reason',gen_random_uuid()),
      (9221,${B},7201,1,'X',8,NOW(),'{}',repeat('b',64),${B},'X void reason',gen_random_uuid());
    INSERT INTO voided_flight_certified_revisions(voided_flight_id,source_revision_id,revision_number,certification_hash,certification_version,certified_at,snapshot_data,snapshot_sha256) VALUES
      (9121,1,1,'A',8,NOW(),'{}',repeat('a',64)),(9221,2,1,'X',8,NOW(),'{}',repeat('b',64));
    INSERT INTO voided_flight_verifications(voided_flight_id,source_verification_id,record_revision,verification_role,status,flight_hash,source_data,source_sha256) VALUES
      (9121,1,1,'INSTRUCTOR','signed','A','{}',repeat('a',64)),(9221,2,1,'INSTRUCTOR','signed','X','{}',repeat('b',64));
    INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256) VALUES
      (9121,'TRACK','A','{}',repeat('a',64)),(9221,'TRACK','X','{}',repeat('b',64));
    ALTER TABLE flight_certified_revisions ENABLE TRIGGER USER;
    ALTER TABLE fstd_certified_revisions ENABLE TRIGGER USER;
    ALTER TABLE voided_certified_flights ENABLE TRIGGER USER;
    ALTER TABLE voided_flight_certified_revisions ENABLE TRIGGER USER;
    ALTER TABLE voided_flight_verifications ENABLE TRIGGER USER;
    ALTER TABLE voided_flight_archive_items ENABLE TRIGGER USER;
    COMMIT;`);
  const {buildAccountBackup}=await importServerModule<{buildAccountBackup:(userId:number)=>Promise<{backup:Backup;json:string;digest:string}>}>("lib/account-backup.ts");
  ({backup,json,digest}=await buildAccountBackup(A));
});

const sections=(b:Backup)=>Object.entries(b).filter(([,value])=>Array.isArray(value)) as Array<[string,Array<Record<string,unknown>>]>;
const ids=(value:unknown)=>Number(value);

test("every backup section holds only the pilot's own rows or rows the pilot takes part in",{skip:!enabled},()=>{
  const voidedIds=new Set((backup.voided_certified_flights as Array<Record<string,unknown>>).map(row=>ids(row.id)));
  const owner:Record<string,(row:Record<string,unknown>)=>boolean>={
    pilot_connections:row=>[row.requester_user_id,row.recipient_user_id].map(ids).includes(A),
    flight_participations:row=>[row.source_user_id,row.participant_user_id].map(ids).includes(A),
    instructor_flight_approvals:row=>[row.student_user_id,row.instructor_user_id].map(ids).includes(A),
    flight_verifications:row=>[row.flight_user_id,row.signer_user_id].map(ids).includes(A),
    connection_audit_log:row=>[row.actor_user_id,row.subject_user_id].map(ids).includes(A),
    flight_source_provenance:row=>ids(row.participant_user_id)===A,
    voided_flight_certified_revisions:row=>voidedIds.has(ids(row.voided_flight_id)),
    voided_flight_verifications:row=>voidedIds.has(ids(row.voided_flight_id)),
    voided_flight_archive_items:row=>voidedIds.has(ids(row.voided_flight_id)),
  };
  const all=sections(backup);
  assert.equal(all.length,29,"backup v13 has 29 data sections");
  for(const [name,rows] of all){
    const belongs=owner[name]??(row=>ids(row.user_id)===A);
    for(const row of rows)assert.ok(belongs(row),`${name} leaks a row that is not the pilot's: ${JSON.stringify(row).slice(0,160)}`);
    assert.equal(backup.counts[name],rows.length,`${name} count`);
  }
  // No seeded row of another pilot appears anywhere, and no secret either.
  const compact=JSON.stringify(backup);
  assert.ok(compact.includes('"note":"A"'),"the scan below sees the seeded markers");
  assert.ok(!/"(?:note|label|remarks|signer|reference|file_name|name|certification_hash|source_hash|flight_hash|event_type|source_key|delete_token|licence_number|correction_reason|void_reason)":"X/.test(compact),"a row marked X leaked");
  for(const secret of ["third-secret-hash","scrypt$","password_hash","OK-BBB","OK-CCC","OK-XBB","ZZZB","ZZZN","B-active","x-only"])assert.ok(!json.includes(secret),`backup contains ${secret}`);
});

test("each section carries rows of its own table",{skip:!enabled},()=>{
  // A column only that table has, so a mislabelled section cannot pass the ownership check.
  const marker:Record<string,string>={
    flights:"off_block",aircraft:"registration",rates:"valid_from",airports:"ident",expiries:"expiry_date",settings:"preferences_json",
    flight_tracks:"coordinates_json",audit_log:"action",fstd_sessions:"device_type",flight_certified_revisions:"snapshot_data",
    fstd_certified_revisions:"fstd_session_id",deleted_flights:"delete_token",pilot_connections:"requester_user_id",
    flight_participations:"participant_role",instructor_flight_approvals:"student_user_id",pilot_licences:"licence_number",
    pilot_qualifications:"qualification_type",user_notifications:"dedupe_key",flight_verifications:"signer_user_id",
    connection_audit_log:"event_type",flight_expenses:"amount_minor",spl_recency_evidence:"aircraft_context",
    helicopter_recency_evidence:"helicopter_type",bpl_recency_evidence:"balloon_class",voided_certified_flights:"void_reason",
    voided_flight_certified_revisions:"source_revision_id",voided_flight_verifications:"source_verification_id",
    voided_flight_archive_items:"item_kind",flight_source_provenance:"source_hash",
  };
  for(const [name,rows] of sections(backup)){
    assert.ok(marker[name],`no marker column for section ${name}`);
    assert.ok(rows.length>0,`${name} is seeded`);
    for(const row of rows)assert.ok(Object.hasOwn(row,marker[name]),`${name} holds a row without ${marker[name]}`);
  }
});

test("every section includes all of the pilot's rows, and Trash only what can still be restored",{skip:!enabled},()=>{
  const count=(name:string)=>(backup[name] as unknown[]).length;
  const expected:Record<string,number>={
    rates:1,airports:1,expiries:1,flight_tracks:1,audit_log:1,fstd_sessions:1,flight_expenses:1,pilot_licences:1,pilot_qualifications:1,
    spl_recency_evidence:1,helicopter_recency_evidence:1,bpl_recency_evidence:1,flight_certified_revisions:1,fstd_certified_revisions:1,
    voided_certified_flights:1,voided_flight_certified_revisions:1,voided_flight_verifications:1,voided_flight_archive_items:1,
    flight_participations:2,instructor_flight_approvals:2,flight_verifications:2,connection_audit_log:2,flight_source_provenance:1,
    pilot_connections:1,deleted_flights:1,settings:1,
  };
  for(const [name,value] of Object.entries(expected))assert.equal(count(name),value,name);
  assert.ok((backup.flights as Array<Record<string,unknown>>).some(row=>ids(row.id)===9101));
  assert.deepEqual((backup.deleted_flights as Array<Record<string,unknown>>).map(row=>row.delete_token),["A-active"]);
  assert.ok(!("track_points" in backup),"legacy track points are not exported");
  for(const row of backup.voided_certified_flights as Array<Record<string,unknown>>)assert.ok(!("created_txid" in row),"the void archive's transaction id is not exported");
});

test("the profile exposes only the account's public identity",{skip:!enabled},()=>{
  assert.deepEqual(Object.keys(backup.profile).sort(),["created_at","display_name","email","id","role","slug","updated_at"]);
  assert.equal(ids(backup.profile.id),A);
});

test("the backup is server-signed for this pilot and any change breaks the signature",{skip:!enabled},async()=>{
  const {portableBackupAuthenticity}=await importServerModule<{portableBackupAuthenticity:(b:unknown,d:string)=>string}>("lib/backup-authenticity.ts");
  const {portableBackupDigest}=await importServerModule<{portableBackupDigest:(text:string)=>Promise<string>}>("lib/portable-backup.ts");
  assert.equal(backup.version,13);
  assert.equal(portableBackupAuthenticity(backup,digest),"verified");
  const {integrity:_integrity,...payload}=backup;
  assert.equal(await portableBackupDigest(JSON.stringify(payload)),digest,"the digest covers the exported payload");
  const tampered={...payload,flights:[...(backup.flights as unknown[]),{id:1,user_id:A}]};
  assert.equal(portableBackupAuthenticity(backup,await portableBackupDigest(JSON.stringify(tampered))),"invalid");
  assert.equal(portableBackupAuthenticity({...backup,profile:{...backup.profile,id:B}},digest),"invalid","the signature is bound to the source pilot");
});
