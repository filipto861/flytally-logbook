import test from "node:test";
import assert from "node:assert/strict";
import { flightRestoreKey,parsePortableBackup,portableBackupDigest,trackRestoreKey,validateBackupRelationships } from "../lib/portable-backup.ts";

test("restore keys ignore source database ids",()=>{
  const left={id:1,date:"2026-08-22",registration:"ok-bid",off_block:"10:00",departure:"lksz",arrival:"lkro"},right={id:999,date:"2026-08-22",registration:"OK-BID",off_block:"10:00",departure:"LKSZ",arrival:"LKRO"};
  assert.equal(flightRestoreKey(left),flightRestoreKey(right));
});

test("track restore key belongs to its natural flight",()=>{
  const track={file_name:"flight.kml",start_utc:"2026-08-22T08:00:00Z",end_utc:"2026-08-22T09:00:00Z",point_count:500};
  assert.notEqual(trackRestoreKey("flight-a",track),trackRestoreKey("flight-b",track));
});

async function backup(version:number){
  const payload={format:"pilot-logbook-portable",version,exported_at:"2026-08-22T12:00:00.000Z",profile:{},counts:{flights:0,aircraft:0,rates:0,airports:0,expiries:0,flight_tracks:0,track_points:0,...(version>=5?{audit_log:1}:{})},flights:[],aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],track_points:[],...(version>=5?{audit_log:[{id:1,action:"updated"}]}:{})};
  return JSON.stringify({...payload,integrity:{algorithm:"SHA-256",payload_sha256:await portableBackupDigest(JSON.stringify(payload))}});
}

test("version 4 backups remain compatible and receive an empty audit section",async()=>{
  const parsed=await parsePortableBackup(await backup(4));assert.deepEqual(parsed.backup.audit_log,[]);
});

test("version 5 backup validates its audit history count",async()=>{
  const parsed=await parsePortableBackup(await backup(5));assert.equal(parsed.backup.audit_log.length,1);
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
