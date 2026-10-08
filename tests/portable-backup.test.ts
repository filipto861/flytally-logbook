import test from "node:test";
import assert from "node:assert/strict";
import { canonicalEvidenceJson } from "../lib/canonical-evidence.ts";
import { flightRestoreKey,parsePortableBackup,portableBackupDigest,trackRestoreKey,validateBackupArchiveRelationships,validateBackupRelationships,validateVoidHistoryRelationships } from "../lib/portable-backup.ts";

test("restore keys ignore source database ids",()=>{
  const left={id:1,date:"2026-08-22",registration:"ok-bid",off_block:"10:00",departure:"lksz",arrival:"lkro"},right={id:999,date:"2026-08-22",registration:"OK-BID",off_block:"10:00",departure:"LKSZ",arrival:"LKRO"};
  assert.equal(flightRestoreKey(left),flightRestoreKey(right));
});

test("track restore key belongs to its natural flight",()=>{
  const track={file_name:"flight.kml",start_utc:"2026-08-22T08:00:00Z",end_utc:"2026-08-22T09:00:00Z",point_count:500};
  assert.notEqual(trackRestoreKey("flight-a",track),trackRestoreKey("flight-b",track));
});

async function backup(version:number){
  const legacyCore={flights:[],aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],...(version<13?{track_points:[]}:{})};
  const extra5=version>=5?{audit_log:[{id:1,user_id:7,action:"updated"}]}:{};
  const extra6=version>=6?{fstd_sessions:[],flight_certified_revisions:[],fstd_certified_revisions:[],deleted_flights:[]}:{};
  const extra7=version>=7?{pilot_connections:[],flight_participations:[],instructor_flight_approvals:[],pilot_licences:[],pilot_qualifications:[],user_notifications:[],flight_verifications:[],connection_audit_log:[]}:{};
  const extra8=version>=8?{flight_expenses:[]}:{};
  const extra9=version>=9?{spl_recency_evidence:[]}:{};
  const extra10=version>=10?{helicopter_recency_evidence:[]}:{};
  const extra11=version>=11?{bpl_recency_evidence:[]}:{};
  const extra13=version>=13?{voided_certified_flights:[],voided_flight_certified_revisions:[],voided_flight_verifications:[],voided_flight_archive_items:[],flight_source_provenance:[]}:{};
  const arrays={...legacyCore,...extra5,...extra6,...extra7,...extra8,...extra9,...extra10,...extra11,...extra13} as Record<string,unknown[]>;
  const counts=Object.fromEntries(Object.entries(arrays).map(([key,value])=>[key,value.length]));
  const payload={format:"pilot-logbook-portable",version,...(version>=6?{schema_version:20}:{}),exported_at:"2026-08-22T12:00:00.000Z",profile:version>=6?{id:7}:{},counts,...arrays};
  return JSON.stringify({...payload,integrity:{algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))}});
}

test("version 4 backups remain compatible and receive empty modern sections",async()=>{
  const parsed=await parsePortableBackup(await backup(4));assert.deepEqual(parsed.backup.audit_log,[]);assert.deepEqual(parsed.backup.fstd_sessions,[]);assert.deepEqual(parsed.backup.flight_certified_revisions,[]);
});

test("version 5 backup validates its audit history count",async()=>{
  const parsed=await parsePortableBackup(await backup(5));assert.equal(parsed.backup.audit_log.length,1);assert.deepEqual(parsed.backup.fstd_sessions,[]);
});

test("version 6 requires complete recovery sections",async()=>{
  const source=await backup(6),parsed=JSON.parse(source),{integrity:_integrity,...payload}=parsed;delete payload.fstd_sessions;parsed.integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity:parsed.integrity})),/fstd_sessions is missing/);
});

test("version 6 rejects records owned by another account",async()=>{
  const parsed=JSON.parse(await backup(6)),{integrity:_integrity,...payload}=parsed;payload.flights=[{id:10,user_id:99}];payload.counts.flights=1;const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/another account/);
});

test("version 8 rejects orphan or cross-account expenses",async()=>{
  const parsed=JSON.parse(await backup(8)),{integrity:_integrity,...payload}=parsed;payload.flights=[{id:10,user_id:7,date:"2026-09-01",registration:"OK-TST",off_block:"10:00",departure:"LKPR",arrival:"LKPR"}];payload.flight_expenses=[{id:1,user_id:7,flight_id:999,category:"LANDING",label:"",amount_minor:1000,currency:"CZK"}];payload.counts.flights=1;payload.counts.flight_expenses=1;let integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/expense refers to a missing flight/);payload.flight_expenses[0].flight_id=10;payload.flight_expenses[0].user_id=99;integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/expense from another account/);
});

test("backup integrity rejects modified content",async()=>{
  const source=await backup(5);await assert.rejects(()=>parsePortableBackup(source.replace('"version":5','"version":6')),/Integrity check failed/);
});

test("backup relationship check accepts a complete flight and track graph",()=>{
  assert.deepEqual(validateBackupRelationships({flights:[{id:7}],flight_tracks:[{id:9,flight_id:7}],track_points:[{track_id:9}]}),{flights:1,tracks:1,points:1});
});

test("backup relationship check rejects orphan tracks and points",()=>{
  assert.throws(()=>validateBackupRelationships({flights:[],flight_tracks:[{id:9,flight_id:7}],track_points:[]}),/missing flight/);
  assert.throws(()=>validateBackupRelationships({flights:[{id:7}],flight_tracks:[],track_points:[{track_id:9}]}),/missing track/);
});

test("archive relationship check rejects orphan certified revisions",()=>{
  assert.throws(()=>validateBackupArchiveRelationships({flights:[],fstd_sessions:[],flight_certified_revisions:[{flight_id:7,revision_number:1}],fstd_certified_revisions:[]}),/missing flight/);
  assert.throws(()=>validateBackupArchiveRelationships({flights:[],fstd_sessions:[],flight_certified_revisions:[],fstd_certified_revisions:[{fstd_session_id:8,revision_number:1}]}),/missing FSTD session/);
});


test("version 12 legacy track_points remain parser-compatible",async()=>{
  const parsed=JSON.parse(await backup(12)),{integrity:_integrity,...payload}=parsed;
  payload.flights=[{id:10,user_id:7,date:"2026-09-01",registration:"OK-TST",off_block:"10:00",departure:"LKPR",arrival:"LKPR"}];
  payload.flight_tracks=[{id:20,user_id:7,flight_id:10,file_name:"legacy.kml",point_count:1,coordinates_json:"[]",overview_coordinates_json:"[]"}];
  payload.track_points=[{track_id:20,seq:0,lat:50.1,lon:14.2}];
  payload.counts.flights=1;payload.counts.flight_tracks=1;payload.counts.track_points=1;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  const restored=await parsePortableBackup(JSON.stringify({...payload,integrity}));
  assert.equal(restored.backup.version,12);assert.equal(restored.backup.track_points?.length,1);
});

test("version 13 omits legacy track_points and requires protected-history sections",async()=>{
  const parsed=await parsePortableBackup(await backup(13));assert.equal(parsed.backup.version,13);assert.deepEqual(parsed.backup.track_points,[]);
  const source=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=source;delete payload.voided_flight_archive_items;delete payload.counts.voided_flight_archive_items;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/voided_flight_archive_items is missing/);
});

test("version 13 rejects active flight and matching void tombstone in the same payload",async()=>{
  const parsed=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=parsed;
  const flight={id:10,user_id:7,date:"2026-09-01",registration:"OK-TST",off_block:"10:00",departure:"LKPR",arrival:"LKPR",record_revision:1,certification_hash:"a".repeat(64)};
  payload.flights=[flight];payload.voided_certified_flights=[{id:30,user_id:7,original_flight_id:10,record_revision:1,certification_hash:"a".repeat(64),certification_version:8,flight_snapshot:flight,flight_snapshot_sha256:"b".repeat(64),archive_version:1,voided_at:"2026-10-06T12:00:00Z",voided_by_user_id:7,void_reason:"Duplicate certified record",operation_token:"00000000-0000-0000-0000-000000000001"}];
  payload.counts.flights=1;payload.counts.voided_certified_flights=1;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/both an active flight and its voided certified tombstone/);
});

test("version 13 rejects orphan void children and mismatched same-account provenance",async()=>{
  const base=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=base;
  payload.voided_flight_archive_items=[{id:40,voided_flight_id:999,item_kind:"TRACK",source_key:"1",source_data:{},source_sha256:"c".repeat(64),archived_at:"2026-10-06T12:00:00Z"}];payload.counts.voided_flight_archive_items=1;
  let integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/archive item refers to a missing tombstone/);

  const flight={id:20,user_id:7,date:"2026-09-01",registration:"OK-COPY",off_block:"11:00",departure:"LKPR",arrival:"LKPR"};
  const snapshot={id:10,user_id:7,record_revision:1,certification_hash:"d".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7};
  payload.flights=[flight];payload.voided_flight_archive_items=[];payload.counts.voided_flight_archive_items=0;payload.voided_certified_flights=[{id:30,user_id:7,original_flight_id:10,record_revision:1,certification_hash:"d".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7,flight_snapshot:snapshot,flight_snapshot_sha256:"e".repeat(64),archive_version:1,voided_at:"2026-10-06T12:00:00Z",voided_by_user_id:7,void_reason:"Duplicate certified record",operation_token:"00000000-0000-0000-0000-000000000002"}];
  payload.flight_source_provenance=[{id:50,participant_flight_id:20,participant_user_id:7,source_flight_id:10,source_user_id:7,source_revision:2,source_hash:"f".repeat(64),participant_role:"PIC",source_voided_flight_id:30}];
  payload.counts.flights=1;payload.counts.voided_certified_flights=1;payload.counts.flight_source_provenance=1;
  integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/does not match its source tombstone revision\/hash/);
});

test("void-history relationship helper accepts history-only tombstone plus independent participant copy",async()=>{
  const parsed=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=parsed;
  const copy={id:20,user_id:7,date:"2026-09-01",registration:"OK-COPY",off_block:"11:00",departure:"LKPR",arrival:"LKPR"};
  const snapshot={id:10,user_id:7,record_revision:1,certification_hash:"a".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7};
  const snapshotDigest=await portableBackupDigest(canonicalEvidenceJson(snapshot));payload.flights=[copy];payload.voided_certified_flights=[{id:30,user_id:7,original_flight_id:10,record_revision:1,certification_hash:"a".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7,flight_snapshot:snapshot,flight_snapshot_sha256:snapshotDigest,archive_version:1,voided_at:"2026-10-06T12:00:00Z",voided_by_user_id:7,void_reason:"Duplicate certified record",operation_token:"00000000-0000-0000-0000-000000000003"}];
  payload.flight_source_provenance=[{id:50,participant_flight_id:20,participant_user_id:7,source_flight_id:10,source_user_id:7,source_revision:1,source_hash:"a".repeat(64),participant_role:"PIC",source_voided_flight_id:30}];
  payload.counts.flights=1;payload.counts.voided_certified_flights=1;payload.counts.flight_source_provenance=1;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  const result=await parsePortableBackup(JSON.stringify({...payload,integrity}));
  assert.deepEqual(validateVoidHistoryRelationships(result.backup),{tombstones:1,revisions:0,verifications:0,items:0,provenance:1});
});

test("version 13 rejects internally mismatched void evidence digests even when outer backup digest is valid",async()=>{
  const parsed=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=parsed;
  const snapshot={id:10,user_id:7,record_revision:1,certification_hash:"a".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7};
  payload.voided_certified_flights=[{id:30,user_id:7,original_flight_id:10,record_revision:1,certification_hash:"a".repeat(64),certification_version:8,certified_at:"2026-10-06T10:00:00Z",certified_by_user_id:7,flight_snapshot:snapshot,flight_snapshot_sha256:"b".repeat(64),archive_version:1,voided_at:"2026-10-06T12:00:00Z",voided_by_user_id:7,void_reason:"Duplicate certified record",operation_token:"00000000-0000-0000-0000-000000000004"}];
  payload.counts.voided_certified_flights=1;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  await assert.rejects(()=>parsePortableBackup(JSON.stringify({...payload,integrity})),/SHA-256 does not match its protected JSON evidence/);
});


test("P1.5 portable backup keeps flight and rate calendar dates literal across timezone settings",async()=>{
  const parsed=JSON.parse(await backup(13)),{integrity:_integrity,...payload}=parsed;
  payload.settings=[{user_id:7,timezone:"Pacific/Auckland"}];
  payload.flights=[{id:10,user_id:7,date:"2026-01-01",registration:"OK-TST",off_block:"00:15",departure:"NZAA",arrival:"NZAA"}];
  payload.rates=[{id:20,user_id:7,registration:"OK-TST",aircraft_type:"B23",valid_from:"2025-12-31",price_per_hour:2500}];
  payload.counts.settings=1;payload.counts.flights=1;payload.counts.rates=1;
  const integrity={algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))};
  const result=await parsePortableBackup(JSON.stringify({...payload,integrity}));
  assert.equal(result.backup.settings[0]?.timezone,"Pacific/Auckland");
  assert.equal(result.backup.flights[0]?.date,"2026-01-01");
  assert.equal(result.backup.rates[0]?.valid_from,"2025-12-31");
  assert.match(flightRestoreKey(result.backup.flights[0]),/^2026-01-01\|OK-TST\|00:15\|NZAA\|NZAA$/);
});
