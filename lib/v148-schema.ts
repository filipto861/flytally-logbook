import "server-only";
import { sql } from "@/lib/db";
import { ensureV132Schema } from "@/lib/v132-schema";

declare global{
  // eslint-disable-next-line no-var
  var __flytallyV148Schema:Promise<void>|undefined;
}

const MIGRATION_KEY="v1.48-training-purpose-modularity";

async function applyV148Schema(){
  await ensureV132Schema();
  await sql`CREATE TABLE IF NOT EXISTS flytally_feature_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const done=await sql`SELECT 1 ok FROM flytally_feature_migrations WHERE migration_key=${MIGRATION_KEY} LIMIT 1` as Array<{ok:number}>;
  if(done[0])return;

  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(148082026)`,
    sql`DROP TRIGGER IF EXISTS trg_flytally_sync_flight_purpose ON flights`,
    sql`CREATE OR REPLACE FUNCTION flytally_sync_flight_purpose() RETURNS TRIGGER AS $$
      DECLARE purpose_text TEXT;
      BEGIN
        purpose_text:=' · '||UPPER(BTRIM(COALESCE(NEW.task,'')))||' · ';
        IF UPPER(COALESCE(NEW.role,''))='DUAL' THEN
          IF purpose_text LIKE '% · FCL.140.A REFRESHER TRAINING · %' THEN
            NEW.purpose_code:='LAPL_FCL140A_REFRESHER';
          ELSIF purpose_text LIKE '% · FCL.740.A REFRESHER TRAINING · %' THEN
            NEW.purpose_code:='SEP_TMG_FCL740A_REFRESHER';
          ELSIF purpose_text LIKE '% · DIFFERENCES TRAINING · %' THEN
            NEW.purpose_code:='AIRCRAFT_DIFFERENCES';
          ELSIF purpose_text LIKE '% · FAMILIARISATION · %' THEN
            NEW.purpose_code:='AIRCRAFT_FAMILIARISATION';
          ELSE
            NEW.purpose_code:='';
          END IF;
        ELSIF BTRIM(COALESCE(NEW.instructor,''))<>'' THEN
          IF purpose_text LIKE '% · DIFFERENCES TRAINING · %' THEN
            NEW.purpose_code:='AIRCRAFT_DIFFERENCES';
          ELSIF purpose_text LIKE '% · FAMILIARISATION · %' THEN
            NEW.purpose_code:='AIRCRAFT_FAMILIARISATION';
          ELSE
            NEW.purpose_code:='';
          END IF;
        ELSE
          NEW.purpose_code:='';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`,
    sql`CREATE TRIGGER trg_flytally_sync_flight_purpose BEFORE INSERT OR UPDATE OF role,task,instructor,purpose_code ON flights FOR EACH ROW EXECUTE FUNCTION flytally_sync_flight_purpose()`,
    sql`INSERT INTO flytally_feature_migrations(migration_key) VALUES(${MIGRATION_KEY}) ON CONFLICT(migration_key) DO NOTHING`,
  ]);
}

export function ensureV148Schema(){
  if(!globalThis.__flytallyV148Schema){
    globalThis.__flytallyV148Schema=applyV148Schema().catch(error=>{
      globalThis.__flytallyV148Schema=undefined;
      throw error;
    });
  }
  return globalThis.__flytallyV148Schema;
}
