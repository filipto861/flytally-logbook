import test from "node:test";
import assert from "node:assert/strict";
import { flightCertificationHash,fstdCertificationHash } from "../lib/certification-integrity.ts";
import { validateBackupCertificationHistory } from "../lib/backup-certification.ts";
import type { PortableBackup } from "../lib/portable-backup.ts";

const userId=42;
const flight=(overrides:Record<string,unknown>={}):Record<string,unknown>=>({id:101,user_id:userId,date:"2026-08-25",evidence:"EASA",registration:"OK-BID",aircraft_make:"BRM AERO",aircraft_model:"Bristell B23",aircraft_variant:"",aircraft_type:"B23",aircraft_class:"SEP",departure:"LKLT",arrival:"LKBE",off_block:"08:00",takeoff:"08:05",landing:"08:55",on_block:"09:00",operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,commander:"",instructor:"",role:"PIC",task:"Test",note:"",verification_name:"",verification_reference:"",record_revision:1,correction_reason:"",certification_version:2,...overrides});
const fstd=(overrides:Record<string,unknown>={}):Record<string,unknown>=>({id:201,user_id:userId,session_date:"2026-08-25",device_type:"FNPT II",qualification_number:"Q1",instruction:"IR",total_minutes:60,remarks:"",record_revision:1,correction_reason:"",certification_version:2,...overrides});
const base=(flights:Record<string,unknown>[],fstd_sessions:Record<string,unknown>[],flightRevisions:Record<string,unknown>[]=[],fstdRevisions:Record<string,unknown>[]=[])=>({format:"pilot-logbook-portable",version:6,schema_version:8,exported_at:"2026-08-25T06:00:00Z",profile:{id:userId},counts:{flights:flights.length,aircraft:0,rates:0,airports:0,expiries:0,settings:0,flight_tracks:0,track_points:0,audit_log:0,fstd_sessions:fstd_sessions.length,flight_certified_revisions:flightRevisions.length,fstd_certified_revisions:fstdRevisions.length,deleted_flights:0},flights,aircraft:[],rates:[],airports:[],expiries:[],settings:[],flight_tracks:[],track_points:[],audit_log:[],fstd_sessions,flight_certified_revisions:flightRevisions,fstd_certified_revisions:fstdRevisions,deleted_flights:[],integrity:{algorithm:"SHA-256",payload_sha256:"x"}} as PortableBackup);

test("v6 backup verifies certified current flight and FSTD fingerprints",()=>{
  const f=flight(),s=fstd();f.certification_hash=flightCertificationHash(f,userId,2);f.certified_at="2026-08-25T09:00:00Z";s.certification_hash=fstdCertificationHash(s,userId,2);s.certified_at="2026-08-25T09:00:00Z";
  assert.deepEqual(validateBackupCertificationHistory(base([f],[s]),userId),{certifiedFlights:1,flightRevisions:0,certifiedFstd:1,fstdRevisions:0});
});

test("v6 backup rejects cross-account restore of certification history",()=>{
  const f=flight();f.certification_hash=flightCertificationHash(f,userId,2);f.certified_at="2026-08-25T09:00:00Z";
  assert.throws(()=>validateBackupCertificationHistory(base([f],[]),99),/account-bound/);
});

test("v6 backup rejects a missing certified revision in the chain",()=>{
  const f=flight({record_revision:2,correction_reason:"Corrected route"});
  assert.throws(()=>validateBackupCertificationHistory(base([f],[]),userId),/incomplete certified revision chain/);
});

test("v6 backup verifies archived flight revision fingerprints",()=>{
  const r1=flight({record_revision:1,correction_reason:""});r1.certification_hash=flightCertificationHash(r1,userId,2);r1.certified_at="2026-08-25T08:30:00Z";
  const current=flight({record_revision:2,correction_reason:"Corrected route",certified_at:null,certification_hash:""});
  const revision={id:501,user_id:userId,flight_id:101,revision_number:1,snapshot_data:r1,certification_hash:r1.certification_hash,certification_version:2,certified_at:r1.certified_at,certified_by_user_id:userId,superseded_at:"2026-08-25T09:00:00Z",superseded_by_user_id:userId,correction_reason:"Corrected route"};
  const result=validateBackupCertificationHistory(base([current],[],[revision]),userId);assert.equal(result.flightRevisions,1);
});
