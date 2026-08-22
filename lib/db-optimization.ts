import "server-only";
import { sql } from "@/lib/db";

declare global{
  // eslint-disable-next-line no-var
  var __logbookOptimization:Promise<void>|undefined;
}

export function ensureDatabaseOptimizations():Promise<void>{
  if(!globalThis.__logbookOptimization){
    globalThis.__logbookOptimization=(async()=>{
      try{
        const ready=await sql`SELECT
          to_regclass('public.flight_audit_log') IS NOT NULL audit_table,
          EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='flights' AND column_name='locked_at') lock_column,
          EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal) lock_trigger,
          EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_audit_flight_change' AND NOT tgisinternal) audit_trigger` as Array<{audit_table:boolean;lock_column:boolean;lock_trigger:boolean;audit_trigger:boolean}>;
        if(ready[0]?.audit_table&&ready[0]?.lock_column&&ready[0]?.lock_trigger&&ready[0]?.audit_trigger)return;
        await sql.transaction([
          sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
          sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT`,
          sql`CREATE TABLE IF NOT EXISTS flight_audit_log (
            id BIGSERIAL PRIMARY KEY,
            flight_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            actor_user_id BIGINT,
            action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),
            old_data JSONB,
            new_data JSONB,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          sql`CREATE OR REPLACE FUNCTION logbook_protect_locked_flight() RETURNS TRIGGER AS $$
            BEGIN
              IF TG_OP='DELETE' AND OLD.locked_at IS NOT NULL THEN
                RAISE EXCEPTION 'Locked flight cannot be deleted';
              END IF;
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
                INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,new_data)
                VALUES(NEW.id,NEW.user_id,NEW.user_id,'created',to_jsonb(NEW));
                RETURN NEW;
              ELSIF TG_OP='UPDATE' THEN
                IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
                  INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data,new_data)
                  VALUES(NEW.id,NEW.user_id,NEW.user_id,'updated',to_jsonb(OLD),to_jsonb(NEW));
                END IF;
                RETURN NEW;
              ELSE
                INSERT INTO flight_audit_log(flight_id,user_id,actor_user_id,action,old_data)
                VALUES(OLD.id,OLD.user_id,OLD.user_id,'deleted',to_jsonb(OLD));
                RETURN OLD;
              END IF;
            END;
          $$ LANGUAGE plpgsql`,
          sql`DO $$ BEGIN
            IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_logbook_audit_flight_change' AND tgrelid='flights'::regclass AND NOT tgisinternal) THEN
              CREATE TRIGGER trg_logbook_audit_flight_change AFTER INSERT OR UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_audit_flight_change();
            END IF;
          END $$`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date ON flights(user_id,date DESC,id DESC)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration ON flights(user_id,registration)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight ON flight_tracks(user_id,flight_id)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_rates_user_registration_date ON rates(user_id,registration,valid_from DESC)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_aircraft_user_active ON aircraft(user_id,active,registration)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_airports_user_active ON airports(user_id,active,ident)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_expiries_user_active_date ON user_expiries(user_id,active,expiry_date)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_flight_audit_user_flight ON flight_audit_log(user_id,flight_id,changed_at DESC,id DESC)`,
        ]);
      }catch(error){
        console.error("database-optimization-skipped",error);
      }
    })();
  }
  return globalThis.__logbookOptimization;
}
