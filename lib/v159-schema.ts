import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV159Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.59-user-flight-expenses";

async function applyV159Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(159020260)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS flights_id_user_owner_uq ON flights(id,user_id)`,
    sql`CREATE TABLE IF NOT EXISTS flight_expenses (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      flight_id BIGINT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('LANDING','HANDLING','PARKING','FUEL','OTHER')),
      label TEXT NOT NULL DEFAULT '',
      amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000),
      currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT flight_expenses_owner_flight_fk FOREIGN KEY(flight_id,user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_flight_expenses_user_flight ON flight_expenses(user_id,flight_id,id)`,
    sql`ALTER TABLE deleted_flights ADD COLUMN IF NOT EXISTS expenses_data JSONB NOT NULL DEFAULT '[]'::jsonb`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV159Schema(){
  if(!globalThis.__flytallyV159Schema){
    globalThis.__flytallyV159Schema=applyV159Schema().catch(error=>{globalThis.__flytallyV159Schema=undefined;throw error});
  }
  return globalThis.__flytallyV159Schema;
}
