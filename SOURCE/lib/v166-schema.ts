import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV166Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.66-professional-pilot-layer";

async function applyV166Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(166020260)`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS operator_name TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS flight_number TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS operation_context TEXT NOT NULL DEFAULT ''`,
    sql`CREATE INDEX IF NOT EXISTS idx_v166_professional_context ON flights(user_id,date DESC,id DESC) WHERE evidence='EASA' AND regulatory_category IN ('AEROPLANE','HELICOPTER')`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV166Schema(){
  if(!globalThis.__flytallyV166Schema){
    globalThis.__flytallyV166Schema=applyV166Schema().catch(error=>{globalThis.__flytallyV166Schema=undefined;throw error});
  }
  return globalThis.__flytallyV166Schema;
}
