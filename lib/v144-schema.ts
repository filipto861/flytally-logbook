import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV144Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.44-production-hardening-indexes";

async function applyV144Schema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(144020260)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_track_points_user_track_seq ON track_points(user_id,track_id,seq)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_participations_source_status ON flight_participations(source_user_id,status,source_flight_id,source_revision DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_participations_received ON flight_participations(participant_user_id,participant_flight_id) WHERE participant_flight_id IS NOT NULL`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_verifications_exact_revision ON flight_verifications(flight_user_id,flight_id,record_revision,flight_hash,status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_notifications_user_href ON user_notifications(user_id,href)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_licences_user_active ON pilot_licences(user_id,active,licence_type)`,
    sql`CREATE INDEX IF NOT EXISTS idx_v144_connection_audit_actor ON connection_audit_log(actor_user_id,created_at DESC)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV144Schema(){
  if(!globalThis.__flytallyV144Schema){
    globalThis.__flytallyV144Schema=applyV144Schema().catch(error=>{globalThis.__flytallyV144Schema=undefined;throw error});
  }
  return globalThis.__flytallyV144Schema;
}
