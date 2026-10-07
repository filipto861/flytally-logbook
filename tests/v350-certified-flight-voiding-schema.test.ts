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
  assert.doesNotMatch(dbOptimizations,/TRACK_POINT/);
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
  assert.match(dbOptimizations,/CREATE OR REPLACE FUNCTION logbook_protect_locked_flight\(\) RETURNS TRIGGER AS \$void\$/);
  assert.match(dbOptimizations,/\$void\$ LANGUAGE plpgsql/);
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


test("flight source provenance is append-only except exact same-transaction tombstone binding",()=>{
  assert.match(dbOptimizations,/CREATE OR REPLACE FUNCTION logbook_protect_source_provenance/);
  assert.match(dbOptimizations,/OLD\.source_voided_flight_id IS NULL[\s\S]*NEW\.source_voided_flight_id IS NOT NULL/);
  assert.match(dbOptimizations,/v\.user_id=NEW\.source_user_id[\s\S]*v\.original_flight_id=NEW\.source_flight_id[\s\S]*v\.record_revision=NEW\.source_revision[\s\S]*v\.certification_hash=NEW\.source_hash/);
  assert.match(dbOptimizations,/v\.created_txid=txid_current\(\)/);
  assert.match(dbOptimizations,/Flight source provenance is immutable/);
  assert.match(dbOptimizations,/BEFORE INSERT OR UPDATE OR DELETE ON flight_source_provenance/);
  assert.match(dbOptimizations,/Flight source provenance does not match its source tombstone/);
});


test("3.5.0 production v20 tooling mirrors runtime migration and closes the deploy-window provenance race",()=>{
  const pre=fs.readFileSync(path.join(root,"tooling/v350-v20-preflight.sql"),"utf8");
  const mig=fs.readFileSync(path.join(root,"tooling/v350-v20-migrate.sql"),"utf8");
  const reconcile=fs.readFileSync(path.join(root,"tooling/v350-v20-reconcile-provenance.sql"),"utf8");
  const post=fs.readFileSync(path.join(root,"tooling/v350-v20-postflight.sql"),"utf8");

  assert.match(pre,/BEGIN TRANSACTION READ ONLY/);
  assert.match(pre,/registry is not exact versions 1\.\.19/);
  assert.match(pre,/partial v20 table state detected/);
  assert.match(pre,/accepted participant provenance is incomplete/);
  assert.doesNotMatch(pre,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|ALTER TABLE|CREATE TABLE/i);

  const runtimeStart=dbOptimizations.indexOf("if(version===20)return[");
  const runtimeEnd=dbOptimizations.indexOf("  ];",runtimeStart);
  assert.ok(runtimeStart>=0&&runtimeEnd>runtimeStart);
  const runtimeBlocks=[...dbOptimizations.slice(runtimeStart,runtimeEnd).matchAll(/sql\`([\s\S]*?)\`/g)].map(match=>match[1].trim());
  const normalizedMigration=mig.replace(/\s+/g," ");
  for(const block of runtimeBlocks){
    assert.ok(normalizedMigration.includes(block.replace(/\s+/g," ")),`production migration is missing runtime v20 statement: ${block.slice(0,80)}`);
  }
  assert.match(mig,/pg_advisory_xact_lock\(704190104\)/);
  assert.match(mig,/VALUES\(20,'certified flight void archive and provenance'\)/);
  assert.match(mig,/provenance backfill content mismatch/);
  assert.match(mig,/COMMIT;/);

  assert.match(reconcile,/INSERT INTO public\.flight_source_provenance/);
  assert.match(reconcile,/ON CONFLICT\(participant_flight_id,participant_user_id\) DO NOTHING/);
  assert.match(reconcile,/accepted participant provenance mismatch remains/);
  assert.doesNotMatch(reconcile,/\bUPDATE\b|\bDELETE\b|ALTER TABLE|DROP TABLE/i);

  assert.match(post,/BEGIN TRANSACTION READ ONLY/);
  assert.match(post,/registry is not exact versions 1\.\.20/);
  assert.match(post,/accepted participant provenance is incomplete or mismatched/);
  assert.match(post,/voided_flight_rows/);
  assert.match(post,/ROLLBACK/);
});
