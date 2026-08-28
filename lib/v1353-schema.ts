import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV1353Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.35.3-fcl060-structured-movements";

async function applyV1353Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(135320260)`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS takeoffs_day INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS takeoffs_night INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS approaches_day INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS approaches_night INTEGER NOT NULL DEFAULT 0`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV1353Schema(){
  if(!globalThis.__flytallyV1353Schema){
    globalThis.__flytallyV1353Schema=applyV1353Schema().catch(error=>{globalThis.__flytallyV1353Schema=undefined;throw error});
  }
  return globalThis.__flytallyV1353Schema;
}
