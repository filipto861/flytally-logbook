import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV165Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.65-advanced-qualifications";

async function applyV165Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(165020260)`,
    // Ordinary licence qualifications keep their existing identity and validity columns.
    // These fields add explicit structure without rewriting legacy user-entered labels.
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS qualification_family TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS regulatory_category TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS qualification_scope TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS privilege_role TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS classification_source TEXT`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS issued_on DATE`,
    sql`ALTER TABLE pilot_qualifications ADD COLUMN IF NOT EXISTS limitations TEXT`,
    sql`CREATE INDEX IF NOT EXISTS idx_v165_qualification_structure ON pilot_qualifications(user_id,regulatory_category,qualification_family,id) WHERE active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training'`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV165Schema(){
  if(!globalThis.__flytallyV165Schema){
    globalThis.__flytallyV165Schema=applyV165Schema().catch(error=>{globalThis.__flytallyV165Schema=undefined;throw error});
  }
  return globalThis.__flytallyV165Schema;
}
