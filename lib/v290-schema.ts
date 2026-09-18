import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV290Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v2.9-c3-entitlement-ledger";

async function applyV290Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(2900320260)`,
    sql`CREATE TABLE IF NOT EXISTS account_entitlements (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entitlement_key TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('billing','organization','manual')),
      external_reference TEXT NOT NULL,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(valid_until IS NULL OR valid_until>valid_from)
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_account_entitlement_external
      ON account_entitlements(user_id,source,entitlement_key,external_reference)`,
    sql`CREATE INDEX IF NOT EXISTS idx_account_entitlements_active
      ON account_entitlements(user_id,entitlement_key,valid_until)
      WHERE revoked_at IS NULL`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV290Schema(){
  if(!globalThis.__flytallyV290Schema){
    globalThis.__flytallyV290Schema=applyV290Schema().catch(error=>{globalThis.__flytallyV290Schema=undefined;throw error});
  }
  return globalThis.__flytallyV290Schema;
}
