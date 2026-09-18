import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyPushSchema:Promise<void>|undefined;
}

const MIGRATION_KEY="v3.0-web-push-v1";

async function applyPushSchema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(3000920262)`,
    sql`CREATE TABLE IF NOT EXISTS push_preferences (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      compliance BOOLEAN NOT NULL DEFAULT TRUE,
      activity BOOLEAN NOT NULL DEFAULT TRUE,
      security BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL DEFAULT '',
      auth TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_success_at TIMESTAMPTZ,
      failure_count INTEGER NOT NULL DEFAULT 0,
      CHECK(length(endpoint)<=2000),
      CHECK(length(p256dh)<=500),
      CHECK(length(auth)<=500)
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id,updated_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_session ON push_subscriptions(session_id)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensurePushSchema(){
  if(!globalThis.__flytallyPushSchema){
    globalThis.__flytallyPushSchema=applyPushSchema().catch(error=>{globalThis.__flytallyPushSchema=undefined;throw error});
  }
  return globalThis.__flytallyPushSchema;
}
