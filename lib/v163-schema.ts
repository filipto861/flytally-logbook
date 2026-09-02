import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV163Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.63-helicopter-core";

async function applyV163Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(163020260)`,
    sql`CREATE TABLE IF NOT EXISTS helicopter_recency_evidence (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      evidence_kind TEXT NOT NULL DEFAULT 'PROFICIENCY_CHECK',
      helicopter_type TEXT NOT NULL,
      evidence_date DATE NOT NULL,
      signer TEXT NOT NULL,
      reference TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(evidence_kind IN ('PROFICIENCY_CHECK'))
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_helicopter_recency_evidence_user_type_date ON helicopter_recency_evidence(user_id,helicopter_type,evidence_date DESC)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV163Schema(){
  if(!globalThis.__flytallyV163Schema){
    globalThis.__flytallyV163Schema=applyV163Schema().catch(error=>{globalThis.__flytallyV163Schema=undefined;throw error});
  }
  return globalThis.__flytallyV163Schema;
}
