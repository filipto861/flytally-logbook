import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const migrationPlan=fs.readFileSync(path.join(root,"lib/migration-plan.ts"),"utf8");
const dbOptimizations=fs.readFileSync(path.join(root,"lib/db-optimization.ts"),"utf8");

test("3.5.0 registers certified-flight voiding as schema v20",()=>{
  assert.match(migrationPlan,/DATABASE_SCHEMA_VERSION=20/);
  assert.match(migrationPlan,/\{version:20,name:"certified flight void archive and provenance"\}/);
  assert.match(dbOptimizations,/20:"certified flight void archive and provenance"/);
});

test("v20 creates a permanent certified-flight tombstone and immutable protected-evidence archives",()=>{
  for(const table of [
    "voided_certified_flights",
    "voided_flight_certified_revisions",
    "voided_flight_verifications",
    "voided_flight_archive_items",
  ])assert.match(dbOptimizations,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  assert.match(dbOptimizations,/flight_snapshot JSONB NOT NULL/);
  assert.match(dbOptimizations,/flight_snapshot_sha256 TEXT NOT NULL CHECK\(flight_snapshot_sha256 ~ '\^\[a-f0-9\]\{64\}\$'\)/);
  assert.match(dbOptimizations,/void_reason TEXT NOT NULL CHECK\(char_length\(TRIM\(void_reason\)\) BETWEEN 8 AND 1000\)/);
  assert.match(dbOptimizations,/created_txid BIGINT NOT NULL DEFAULT txid_current\(\)/);
  assert.match(dbOptimizations,/CREATE OR REPLACE FUNCTION logbook_protect_void_archive\(\)/);
  assert.match(dbOptimizations,/Certified flight void archive is immutable/);
});

test("v20 preserves accepted participant-copy provenance before source deletion can be enabled",()=>{
  assert.match(dbOptimizations,/CREATE TABLE IF NOT EXISTS flight_source_provenance/);
  assert.match(dbOptimizations,/FOREIGN KEY\(participant_flight_id,participant_user_id\) REFERENCES flights\(id,user_id\) ON DELETE CASCADE/);
  assert.match(dbOptimizations,/INSERT INTO flight_source_provenance[\s\S]*FROM flight_participations p[\s\S]*p\.status='accepted' AND p\.participant_flight_id IS NOT NULL/);
  assert.match(dbOptimizations,/source_voided_flight_id BIGINT REFERENCES voided_certified_flights\(id\) ON DELETE RESTRICT/);
});

test("certified DELETE remains forbidden unless an exact tombstone was created in the same transaction",()=>{
  assert.match(dbOptimizations,/IF OLD\.certified_at IS NOT NULL THEN[\s\S]*certified_void_transition:=EXISTS/);
  assert.match(dbOptimizations,/v\.record_revision=COALESCE\(OLD\.record_revision,1\)/);
  assert.match(dbOptimizations,/v\.certification_hash=COALESCE\(OLD\.certification_hash,''\)/);
  assert.match(dbOptimizations,/v\.created_txid=txid_current\(\)/);
  assert.match(dbOptimizations,/v\.flight_snapshot IS NOT DISTINCT FROM to_jsonb\(OLD\)/);
  assert.match(dbOptimizations,/Certified flight cannot be deleted without a matching same-transaction void archive/);
  assert.match(dbOptimizations,/DROP TRIGGER IF EXISTS trg_logbook_protect_locked_flight ON flights/);
  assert.match(dbOptimizations,/CREATE TRIGGER trg_logbook_protect_locked_flight[\s\S]*BEFORE UPDATE OR DELETE ON flights[\s\S]*EXECUTE FUNCTION logbook_protect_locked_flight\(\)/);
});

test("v20 retains the certified correction transition and never disables integrity triggers",()=>{
  assert.match(dbOptimizations,/NEW\.certified_at IS NULL[\s\S]*COALESCE\(NEW\.record_revision,1\)=COALESCE\(OLD\.record_revision,1\)\+1/);
  assert.match(dbOptimizations,/EXISTS\([\s\S]*FROM flight_certified_revisions r[\s\S]*r\.certification_hash=COALESCE\(OLD\.certification_hash,''\)/);
  assert.doesNotMatch(dbOptimizations,/DISABLE TRIGGER|session_replication_role/i);
});

test("v20 blocks reusing a voided source database identity as an active flight",()=>{
  assert.match(dbOptimizations,/CREATE OR REPLACE FUNCTION logbook_prevent_voided_flight_id_reuse\(\)/);
  assert.match(dbOptimizations,/v\.user_id=NEW\.user_id AND v\.original_flight_id=NEW\.id/);
  assert.match(dbOptimizations,/BEFORE INSERT ON flights FOR EACH ROW EXECUTE FUNCTION logbook_prevent_voided_flight_id_reuse\(\)/);
});

test("v20 rejects committed tombstones that still coexist with the active source row",()=>{
  assert.match(dbOptimizations,/CREATE CONSTRAINT TRIGGER trg_logbook_require_void_archive_separation/);
  assert.match(dbOptimizations,/DEFERRABLE INITIALLY DEFERRED/);
  assert.match(dbOptimizations,/WHERE f\.id=NEW\.original_flight_id AND f\.user_id=NEW\.user_id/);
  assert.match(dbOptimizations,/Voided certified flight archive cannot coexist with its active flight/);
});

test("v20 freezes archive child membership to the tombstone transaction",()=>{
  assert.match(dbOptimizations,/CREATE OR REPLACE FUNCTION logbook_validate_void_archive_child_insert\(\)/);
  assert.match(dbOptimizations,/v\.id=NEW\.voided_flight_id AND v\.created_txid=txid_current\(\)/);
  for(const trigger of [
    "trg_logbook_validate_voided_flight_revisions_insert",
    "trg_logbook_validate_voided_flight_verifications_insert",
    "trg_logbook_validate_voided_flight_archive_items_insert",
  ])assert.match(dbOptimizations,new RegExp(`CREATE TRIGGER ${trigger}`));
});
