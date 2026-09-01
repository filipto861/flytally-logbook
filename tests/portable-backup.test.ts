import test from "node:test";
import assert from "node:assert/strict";
import { flightRestoreKey,parsePortableBackup,portableBackupDigest,trackRestoreKey,validateBackupArchiveRelationships,validateBackupRelationships } from "../lib/portable-backup.ts";

test("restore keys ignore source database ids",()=>{
  const left={id:1,date:"2026-08-22",registration:"ok-bid",off_block:"10:00",departure:"lksz",arrival:"lkro"},right={id:999,date:"2026-08-22",registration:"OK-BID",off_block:"10:00",departure:"LKSZ",arrival:"LKRO"};
  assert.equal(flightRestoreKey(left),flightRestoreKey(right));
});

test("track restore key belongs to its natural flight",()=>{
  const track={file_name:"flight.kml",start_utc:"2026-08-22T08:00:00Z",end_utc:"2026-08-22T09:00:00Z",point_count:500};
  assert.notEqual(trackRestoreKey("flight-a",track),trackRestoreKey("flight-b",track));
});

async function backup(version:number){
  const core={flights:[],aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],track_points:[]};
  const extra5=version>=5?{audit_log:[{id:1,user_id:7,action:"updated"}]}:{};
  const extra6=version>=6?{fstd_sessions:[],flight_certified_revisions:[],fstd_certified_revisions:[],deleted_flights:[]}:{};
  const extra7=version>=7?{pilot_connections:[],flight_participations:[],instructor_flight_approvals:[],pilot_licences:[],pilot_qualifications:[],user_notifications:[],flight_verifications:[],connection_audit_log:[]}:{};
  const extra8=version>=8?{flight_expenses:[]}:{};
  const arrays={...core,...extra5,...extra6,...extra7,...extra8} as Record<string,unknown[]>;
  const counts=Object.fromEntries(Object.entries(arrays).map(([key,value])=>[key,value.length]));
  const payload={format:"pilot-logbook-portable",version,...(version>=6?{schema_version:9}:{}),exported_at:"2026-08-22T12:00:00.000Z",profile:version>=6?{id:7}:{},counts,...arrays};
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
