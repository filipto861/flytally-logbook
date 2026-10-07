import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v13 account backup exports protected void history and omits legacy track_points",()=>{
  const source=read("lib/account-backup.ts");
  assert.match(source,/version:13/);
  for(const section of [
    "voided_certified_flights",
    "voided_flight_certified_revisions",
    "voided_flight_verifications",
    "voided_flight_archive_items",
    "flight_source_provenance",
  ])assert.ok(source.includes(section),`missing v13 backup section ${section}`);
  assert.doesNotMatch(source,/FROM track_points|track_points:/);
});

test("portable parser keeps v12 track_points compatibility but requires v13 protected history",()=>{
  const source=read("lib/portable-backup.ts");
  assert.match(source,/const legacyArrays=.*"track_points"/);
  assert.match(source,/const v13Arrays=/);
  for(const section of [
    "voided_certified_flights",
    "voided_flight_certified_revisions",
    "voided_flight_verifications",
    "voided_flight_archive_items",
    "flight_source_provenance",
  ])assert.ok(source.includes(`"${section}"`),`missing v13 parser section ${section}`);
  assert.match(source,/version>=13.*v13Arrays/);
  assert.match(source,/Backup contains both an active flight and its voided certified tombstone/);
});

test("v13 exact restore never reconstructs tombstone snapshots as active flights",()=>{
  const source=read("lib/account-restore-v6.ts");
  assert.match(source,/INSERT INTO voided_certified_flights/);
  assert.match(source,/INSERT INTO voided_flight_certified_revisions/);
  assert.match(source,/INSERT INTO voided_flight_verifications/);
  assert.match(source,/INSERT INTO voided_flight_archive_items/);
  assert.match(source,/INSERT INTO flight_source_provenance/);
  assert.doesNotMatch(source,/INSERT INTO track_points|FROM track_points/);
  assert.doesNotMatch(source,/flight_snapshot.*INSERT INTO flights|INSERT INTO flights.*flight_snapshot/);
  assert.match(source,/created_txid\s*\n?\s*\)/);
  assert.match(source,/txid_current\(\)/);
});

test("v13 restore uses existing v20 trigger contract without bypass markers",()=>{
  const restore=read("lib/account-restore-v6.ts");
  const schema=read("lib/db-optimization.ts");
  assert.doesNotMatch(restore,/session_replication_role|DISABLE TRIGGER|SET LOCAL .*restore/i);
  assert.match(schema,/v\.created_txid=txid_current\(\)/);
  assert.match(schema,/Voided certified flight archive cannot coexist with its active flight/);
  assert.match(schema,/Voided certified flight identity cannot be recreated as an active flight/);
});

test("v13 portable restore requires verified authenticity for protected history",()=>{
  const action=read("app/(protected)/export/actions.ts");
  const auth=read("lib/backup-authenticity.ts");
  assert.match(action,/version\)>=13&&authenticity!=="verified"/);
  for(const section of [
    "voided_certified_flights",
    "voided_flight_certified_revisions",
    "voided_flight_verifications",
    "voided_flight_archive_items",
    "flight_source_provenance",
  ])assert.ok(auth.includes(`"${section}"`),`missing protected authenticity section ${section}`);
});

test("participant provenance is DB-protected and restore-compatible",()=>{
  const schema=read("lib/db-optimization.ts");
  assert.match(schema,/CREATE OR REPLACE FUNCTION logbook_protect_source_provenance/);
  assert.match(schema,/BEFORE INSERT OR UPDATE OR DELETE ON flight_source_provenance/);
  assert.match(schema,/v\.created_txid=txid_current\(\)/);
  assert.match(schema,/Flight source provenance is immutable/);
});
