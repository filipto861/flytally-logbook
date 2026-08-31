import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV145Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.45-aircraft-qualifications";

async function applyV145Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(145020260)`,
    // Aircraft-training evidence deliberately reuses the backed-up qualification graph
    // while remaining outside ordinary active licence/rating, recency and flight-signature queries.
    // New columns stay nullable so older portable backups remain restorable through
    // json_populate_record without requiring a destructive backup-format migration.
    sql`ALTER TABLE pilot_qualifications ALTER COLUMN licence_id DROP NOT NULL`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS record_kind TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS record_active BOOLEAN`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS linked_licence_id BIGINT REFERENCES pilot_licences(id) ON DELETE SET NULL`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS training_kind TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS aircraft_make TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS aircraft_model TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS aircraft_variant TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS differences TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS completed_on DATE`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS instructor_name TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS training_organisation TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS notes TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS requested_signer_user_id BIGINT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS signature_status TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verification_role TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verified_by_user_id BIGINT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verification_snapshot JSONB`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verification_signature TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verification_note TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS verification_version INTEGER`,
    sql`CREATE INDEX IF NOT EXISTS idx_v145_aircraft_training_user_active ON pilot_qualifications(user_id,record_active,completed_on DESC,id DESC) WHERE record_kind='aircraft_training'`,
    sql`CREATE INDEX IF NOT EXISTS idx_v145_aircraft_training_signer_pending ON pilot_qualifications(requested_signer_user_id,signature_status,id) WHERE record_kind='aircraft_training' AND record_active IS TRUE`,
    sql`CREATE INDEX IF NOT EXISTS idx_v145_aircraft_training_linked_licence ON pilot_qualifications(user_id,linked_licence_id) WHERE record_kind='aircraft_training'`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV145Schema(){
  if(!globalThis.__flytallyV145Schema){
    globalThis.__flytallyV145Schema=applyV145Schema().catch(error=>{globalThis.__flytallyV145Schema=undefined;throw error});
  }
  return globalThis.__flytallyV145Schema;
}
