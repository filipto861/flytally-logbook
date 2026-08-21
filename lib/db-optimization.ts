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
        const ready=await sql`SELECT to_regclass('public.idx_logbook_flights_user_date')::text ready` as Array<{ready:string|null}>;
        if(ready[0]?.ready)return;
        await sql.transaction([
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_date ON flights(user_id,date DESC,id DESC)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_flights_user_registration ON flights(user_id,registration)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_tracks_user_flight ON flight_tracks(user_id,flight_id)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_rates_user_registration_date ON rates(user_id,registration,valid_from DESC)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_aircraft_user_active ON aircraft(user_id,active,registration)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_airports_user_active ON airports(user_id,active,ident)`,
          sql`CREATE INDEX IF NOT EXISTS idx_logbook_expiries_user_active_date ON user_expiries(user_id,active,expiry_date)`,
        ]);
      }catch(error){
        console.error("database-optimization-skipped",error);
      }
    })();
  }
  return globalThis.__logbookOptimization;
}
