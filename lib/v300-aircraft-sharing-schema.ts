import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV300AircraftSharingSchema:Promise<void>|undefined;
}

const MIGRATION_KEY="v3.0-aircraft-profile-sharing";

async function applyV300AircraftSharingSchema(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(3000920261)`,
    sql`CREATE TABLE IF NOT EXISTS aircraft_photos (
      aircraft_id BIGINT PRIMARY KEY REFERENCES aircraft(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      image_base64 TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(mime_type IN ('image/jpeg','image/webp','image/png')),
      CHECK(length(image_base64)<=1200000)
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_aircraft_photos_user ON aircraft_photos(user_id,aircraft_id)`,
    sql`CREATE TABLE IF NOT EXISTS aircraft_profile_shares (
      id BIGSERIAL PRIMARY KEY,
      source_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_aircraft_id BIGINT NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
      snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      include_photo BOOLEAN NOT NULL DEFAULT FALSE,
      include_defaults BOOLEAN NOT NULL DEFAULT FALSE,
      include_current_rate BOOLEAN NOT NULL DEFAULT FALSE,
      include_rate_history BOOLEAN NOT NULL DEFAULT FALSE,
      include_notes BOOLEAN NOT NULL DEFAULT FALSE,
      photo_mime_type TEXT NOT NULL DEFAULT '',
      photo_base64 TEXT NOT NULL DEFAULT '',
      imported_aircraft_id BIGINT REFERENCES aircraft(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      CHECK(source_user_id<>recipient_user_id),
      CHECK(length(photo_base64)<=1200000)
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_aircraft_profile_share_pending ON aircraft_profile_shares(source_aircraft_id,recipient_user_id) WHERE status='pending'`,
    sql`CREATE INDEX IF NOT EXISTS idx_aircraft_profile_shares_recipient ON aircraft_profile_shares(recipient_user_id,status,created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_aircraft_profile_shares_source ON aircraft_profile_shares(source_user_id,status,created_at DESC)`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV300AircraftSharingSchema(){
  if(!globalThis.__flytallyV300AircraftSharingSchema){
    globalThis.__flytallyV300AircraftSharingSchema=applyV300AircraftSharingSchema().catch(error=>{globalThis.__flytallyV300AircraftSharingSchema=undefined;throw error});
  }
  return globalThis.__flytallyV300AircraftSharingSchema;
}
