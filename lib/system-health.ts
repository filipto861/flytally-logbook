import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { DATABASE_SCHEMA_VERSION } from "@/lib/migration-plan";
import { loadStoredBackup } from "@/lib/backup-center";

export type SystemHealth={
  schemaVersion:number;targetSchemaVersion:number;migrations:number;indexes:number;expectedIndexes:number;
  orphanTracks:number;orphanPoints:number;duplicateTracks:number;lastBackup:string;backupStatus:"verified"|"missing"|"invalid";databaseBytes:number;
};

const expectedIndexes=[
  "idx_logbook_flights_user_date","idx_logbook_flights_user_registration","idx_logbook_tracks_user_flight",
  "idx_logbook_rates_user_registration_date","idx_logbook_aircraft_user_active","idx_logbook_airports_user_active",
  "idx_logbook_expiries_user_active_date","idx_logbook_flight_audit_user_flight","idx_logbook_account_backups_user_date",
  "idx_logbook_deleted_flights_user_date","idx_logbook_flights_restore_key","idx_logbook_tracks_restore_key",
  "idx_logbook_tracks_user_time","idx_logbook_flights_user_route",
];

export async function getSystemHealth(userId:number):Promise<SystemHealth>{
  await ensureDatabaseOptimizations();
  const [schema,integrity,backup,size]=await Promise.all([
    sql`SELECT COALESCE(MAX(version),0)::int version,COUNT(*)::int migrations FROM flytally_schema_migrations`,
    sql`SELECT
      (SELECT COUNT(*) FROM flight_tracks t LEFT JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id WHERE t.user_id=${userId} AND f.id IS NULL)::int orphan_tracks,
      (SELECT COUNT(*) FROM track_points p LEFT JOIN flight_tracks t ON t.id=p.track_id AND t.user_id=p.user_id WHERE p.user_id=${userId} AND t.id IS NULL)::int orphan_points,
      (SELECT COALESCE(SUM(n-1),0) FROM (SELECT COUNT(*) n FROM flight_tracks WHERE user_id=${userId} GROUP BY flight_id,COALESCE(file_name,''),COALESCE(point_count,0),LEFT(COALESCE(start_utc::text,''),19) HAVING COUNT(*)>1) d)::int duplicate_tracks,
      (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_logbook_flights_user_date','idx_logbook_flights_user_registration','idx_logbook_tracks_user_flight','idx_logbook_rates_user_registration_date','idx_logbook_aircraft_user_active','idx_logbook_airports_user_active','idx_logbook_expiries_user_active_date','idx_logbook_flight_audit_user_flight','idx_logbook_account_backups_user_date','idx_logbook_deleted_flights_user_date','idx_logbook_flights_restore_key','idx_logbook_tracks_restore_key','idx_logbook_tracks_user_time','idx_logbook_flights_user_route'))::int indexes`,
    sql`SELECT id,created_at::text last_backup FROM account_backups WHERE user_id=${userId} ORDER BY created_at DESC,id DESC LIMIT 1`,
    sql`SELECT COALESCE(SUM(pg_total_relation_size(format('%I.%I',schemaname,tablename)::regclass)),0)::bigint bytes FROM pg_tables WHERE schemaname='public'`,
  ]) as Array<Array<Record<string,unknown>>>;
  let backupStatus:SystemHealth["backupStatus"]="missing";
  if(backup[0]?.id){try{await loadStoredBackup(userId,Number(backup[0].id));backupStatus="verified"}catch{backupStatus="invalid"}}
  return{
    schemaVersion:Number(schema[0]?.version||0),targetSchemaVersion:DATABASE_SCHEMA_VERSION,migrations:Number(schema[0]?.migrations||0),
    indexes:Number(integrity[0]?.indexes||0),expectedIndexes:expectedIndexes.length,orphanTracks:Number(integrity[0]?.orphan_tracks||0),
    orphanPoints:Number(integrity[0]?.orphan_points||0),duplicateTracks:Number(integrity[0]?.duplicate_tracks||0),
    lastBackup:String(backup[0]?.last_backup||""),backupStatus,databaseBytes:Number(size[0]?.bytes||0),
  };
}
