import test from "node:test";
import assert from "node:assert/strict";
import { flightCertificationHash,fstdCertificationHash,verifyFlightCertification,verifyFstdCertification } from "../lib/certification-integrity.ts";

const flight={id:42,date:"2026-08-24",evidence:"EASA",registration:"OK-ABC",aircraft_make:"Bristell",aircraft_model:"B23",aircraft_variant:"912iS",aircraft_type:"B23",aircraft_class:"SEP",departure:"LKLT",arrival:"LKBE",off_block:"08:00",takeoff:"08:05",landing:"08:55",on_block:"09:00",operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,commander:"Test Pilot",instructor:"",role:"PIC",task:"Local flight",note:"",verification_name:"",verification_reference:"",record_revision:1,correction_reason:""};

test("legacy v1 flight fingerprint remains verifiable",()=>{
  const certification_hash=flightCertificationHash({...flight,certification_version:1},7,1);
  const result=verifyFlightCertification({...flight,certification_version:1,certification_hash},7);
  assert.equal(result.status,"verified");
});

test("v2 flight fingerprint detects material changes",()=>{
  const row={...flight,record_revision:2,correction_reason:"Corrected landing count",certification_version:2};
  const certification_hash=flightCertificationHash(row,7,2);
  assert.equal(verifyFlightCertification({...row,certification_hash},7).status,"verified");
  assert.equal(verifyFlightCertification({...row,landings_day:2,certification_hash},7).status,"mismatch");
});

test("FSTD v1 and v2 fingerprints are deterministic and revision-aware",()=>{
  const base={id:9,session_date:"2026-08-24",device_type:"FNPT II",qualification_number:"Q1234",instruction:"IR training",total_minutes:90,remarks:"ILS approaches"};
  const legacyHash=fstdCertificationHash({...base,certification_version:1},7,1);
  assert.equal(verifyFstdCertification({...base,certification_version:1,certification_hash:legacyHash},7).status,"verified");
  const revision={...base,record_revision:2,correction_reason:"Corrected session time",certification_version:2};
  const revisionHash=fstdCertificationHash(revision,7,2);
  assert.equal(verifyFstdCertification({...revision,certification_hash:revisionHash},7).status,"verified");
  assert.notEqual(legacyHash,revisionHash);
});
