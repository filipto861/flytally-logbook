import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV164Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.64-balloon-bpl-free-tethered";

async function applyV164Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(164020260)`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS balloon_class TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS balloon_group TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS balloon_class TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS balloon_group TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS balloon_operation TEXT NOT NULL DEFAULT ''`,
    sql`CREATE TABLE IF NOT EXISTS bpl_recency_evidence (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
      balloon_class TEXT NOT NULL,
      balloon_group TEXT NOT NULL DEFAULT '',
      evidence_date DATE NOT NULL,
      signer TEXT NOT NULL,
      reference TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(evidence_kind IN ('PROFICIENCY_CHECK')),
      CHECK(balloon_class IN ('HOT_AIR_BALLOON','GAS_BALLOON','HOT_AIR_AIRSHIP','MIXED_BALLOON')),
      CHECK(balloon_group IN ('','A','B','C','D'))
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_bpl_recency_evidence_user_class_date ON bpl_recency_evidence(user_id,balloon_class,evidence_date DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_flights_user_balloon_context_date ON flights(user_id,balloon_class,balloon_group,date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_flights_user_balloon_operation_date ON flights(user_id,balloon_class,balloon_operation,date)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV164Schema(){
  if(!globalThis.__flytallyV164Schema){
    globalThis.__flytallyV164Schema=applyV164Schema().catch(error=>{globalThis.__flytallyV164Schema=undefined;throw error});
  }
  return globalThis.__flytallyV164Schema;
}
