import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV162Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.62-sailplane-regulatory-context";

async function applyV162Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(162020260)`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS regulatory_category TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS regulatory_category TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS launch_method TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS launches INTEGER NOT NULL DEFAULT 0`,
    sql`CREATE TABLE IF NOT EXISTS spl_recency_evidence (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
      aircraft_context TEXT NOT NULL,
      evidence_date DATE NOT NULL,
      signer TEXT NOT NULL,
      reference TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(evidence_kind IN ('PROFICIENCY_CHECK')),
      CHECK(aircraft_context IN ('SAILPLANE','TMG'))
    )`,
    sql`UPDATE aircraft SET regulatory_category=CASE
      WHEN UPPER(COALESCE(evidence,''))='ULL' OR UPPER(COALESCE(aircraft_class,''))='ULL' THEN 'ULL'
      WHEN UPPER(COALESCE(aircraft_class,''))='GLIDER' THEN 'SAILPLANE'
      WHEN UPPER(COALESCE(aircraft_class,'')) IN ('SEP','TMG','MEP','SET') THEN 'AEROPLANE'
      ELSE 'OTHER' END
      WHERE COALESCE(regulatory_category,'')=''`,
    sql`UPDATE flights SET regulatory_category=CASE
      WHEN UPPER(COALESCE(evidence,''))='ULL' OR UPPER(COALESCE(aircraft_class,''))='ULL' THEN 'ULL'
      WHEN UPPER(COALESCE(aircraft_class,''))='GLIDER' THEN 'SAILPLANE'
      WHEN UPPER(COALESCE(aircraft_class,'')) IN ('SEP','TMG','MEP','SET') THEN 'AEROPLANE'
      ELSE 'OTHER' END
      WHERE COALESCE(regulatory_category,'')=''`,
    sql`CREATE INDEX IF NOT EXISTS idx_flights_user_regulatory_category_date ON flights(user_id,regulatory_category,date DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_spl_recency_evidence_user_date ON spl_recency_evidence(user_id,evidence_date DESC)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV162Schema(){
  if(!globalThis.__flytallyV162Schema){
    globalThis.__flytallyV162Schema=applyV162Schema().catch(error=>{globalThis.__flytallyV162Schema=undefined;throw error});
  }
  return globalThis.__flytallyV162Schema;
}
