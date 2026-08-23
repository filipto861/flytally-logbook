import "server-only";
import { sql } from "@/lib/db";
import { DATABASE_SCHEMA_VERSION,pendingMigrationVersions } from "@/lib/migration-plan";

declare global{
  // eslint-disable-next-line no-var
  var __logbookOptimization:Promise<void>|undefined;
}

const migrationNames:Record<number,string>={
  1:"flight audit and locking",
  2:"backups and recoverable trash",
  3:"core query indexes",
  4:"restore and route performance indexes",
};

const migrationQueries=(version:number)=>{
  if(version===1)return[
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
    sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT`,
    sql`CREATE TABLE IF NOT EXISTS flight_audit_log (
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,actor_user_id BIGINT,
      action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),old_data JSONB,new_data JSONB,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP='DELETE' AND OLD.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Locked flight cannot be deleted'; END IF;
        IF TG_OP='UPDATE' AND OLD.locked_at IS NOT NULL
          AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
          RAISE EXCEPTION 'Locked flight cannot be changed';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_protect_locked_flight' AND tgrelid='flights'::regclass AND NOT tgisinternal) THEN
        CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
      END IF;
    END $$`,
    sql`CREATE OR REPLACE FUNCTION logbook_audit_flight_change() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP='INSERT' THEN
          INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,new_data) VALUES(NEW.id,NEW.user_id,NEW.user_id,'created',to_jsonb(NEW));
          RETURN NEW;
        ELSIF TG_OP='UPDATE' THEN
          IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
            INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data,new_data) VALUES(NEW.id,NEW.user_id,NEW.user_id,'updated',to_jsonb(OLD),to_jsonb(NEW));
          END IF;
          RETURN NEW;
        ELSE
          INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data) VALUES(OLD.id,OLD.user_id,OLD.user_id,'deleted',to_jsonb(OLD));
          RETURN OLD;
        END IF;
      END;
    $$ LANGUAGE plpgsql`,
    sql`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_audit_flight_change' AND tgrelid='flights'::regclass AND NOT tgisinternal) THEN
        CREATE TRIGGER trg_logbook_audit_flight_change AFTER INSERT OR UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_audit_flight_change();
      END IF;
    END $$`,
  ];
  if(version===2)return[
    sql`CREATE TABLE IF NOT EXISTS account_backups (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('automatic','manual','pre_restore')),
      version INTEGER NOT NULL,exported_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload_base64 TEXT NOT NULL,payload_sha256 TEXT NOT NULL,raw_bytes BIGINT NOT NULL,compressed_bytes BIGINT NOT NULL,counts JSONB NOT NULL DEFAULT '{}'::jsonb
    )`,
    sql`CREATE TABLE IF NOT EXISTS deleted_flights (
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,original_flight_id BIGINT NOT NULL,delete_token TEXT NOT NULL UNIQUE,
      flight_data JSONB NOT NULL,tracks_data JSONB NOT NULL DEFAULT '[]'::jsonb,deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '90 days'),restored_at TIMESTAMPTZ,restored_flight_id BIGINT
    )`,
  ];
  if(version===3)return[
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date ON flights(user_id,date DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration ON flights(user_id,registration)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight ON flight_tracks(user_id,flight_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_rates_user_registration_date ON rates(user_id,registration,valid_from DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_aircraft_user_active ON aircraft(user_id,active,registration)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_airports_user_active ON airports(user_id,active,ident)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_expiries_user_active_date ON user_expiries(user_id,active,expiry_date)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flight_audit_user_flight ON flight_audit_log(user_id,flight_id,changed_at DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_account_backups_user_date ON account_backups(user_id,created_at DESC,id DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_deleted_flights_user_date ON deleted_flights(user_id,restored_at,purge_after,deleted_at DESC,id DESC)`,
  ];
  if(version===4)return[
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_restore_key ON flights(user_id,date,registration,off_block,departure,arrival)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_restore_key ON flight_tracks(user_id,flight_id,file_name,point_count)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_time ON flight_tracks(user_id,start_utc,id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_route ON flights(user_id,departure,arrival,date DESC)`,
  ];
  throw new Error(`Unknown database migration ${version}`);
};

async function migrateDatabase(){
  await sql`CREATE TABLE IF NOT EXISTS flytally_schema_migrations (
    version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows=await sql`SELECT version FROM flytally_schema_migrations WHERE version<=${DATABASE_SCHEMA_VERSION} ORDER BY version` as Array<{version:number|string}>;
  for(const version of pendingMigrationVersions(rows.map(row=>Number(row.version)))){
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(704190104)`,
      ...migrationQueries(version),
      sql`INSERT INTO flytally_schema_migrations(version,name) VALUES(${version},${migrationNames[version]}) ON CONFLICT(version) DO NOTHING`,
    ]);
  }
}

export function ensureDatabaseOptimizations():Promise<void>{
  if(!globalThis.__logbookOptimization){
    globalThis.__logbookOptimization=migrateDatabase().catch(error=>{
      globalThis.__logbookOptimization=undefined;
      console.error("database-migration-failed",error);
      throw error;
    });
  }
  return globalThis.__logbookOptimization;
}
