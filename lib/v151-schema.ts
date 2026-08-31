import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV151Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.51-regulatory-credit-profile";

async function applyV151Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(151020260)`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_class TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_basis TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS part_fcl_credit_from TEXT NOT NULL DEFAULT ''`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV151Schema(){
  if(!globalThis.__flytallyV151Schema){
    globalThis.__flytallyV151Schema=applyV151Schema().catch(error=>{globalThis.__flytallyV151Schema=undefined;throw error});
  }
  return globalThis.__flytallyV151Schema;
}
