import "server-only";
import { sql } from "@/lib/db";
export async function getDatabaseData(userId:number){
  const [aircraft,rates,airports,quality]=await Promise.all([
    sql`SELECT id,registration,aircraft_type,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,note FROM aircraft WHERE user_id=${userId} ORDER BY active DESC,registration`,
    sql`SELECT id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source FROM rates WHERE user_id=${userId} ORDER BY registration,valid_from DESC NULLS LAST`,
    sql`SELECT id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,active,closed,source FROM airports WHERE user_id=${userId} ORDER BY active DESC,ident LIMIT 500`,
    sql`WITH flight_quality AS (
      SELECT COUNT(*)::int total,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(registration),'') IS NULL)::int missing_registration,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(departure),'') IS NULL OR NULLIF(TRIM(arrival),'') IS NULL)::int missing_route,
        COUNT(*) FILTER(WHERE off_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR on_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')::int invalid_block_time,
        COUNT(*) FILTER(WHERE price_per_hour IS NULL OR price_per_hour<=0)::int missing_price,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(evidence),'') IS NULL OR NULLIF(TRIM(role),'') IS NULL)::int missing_classification
      FROM flights WHERE user_id=${userId}
    ), track_quality AS (
      SELECT COUNT(*)::int tracks,
        COUNT(*) FILTER(WHERE COALESCE(point_count,0)<2)::int empty_tracks,
        COUNT(*) FILTER(WHERE COALESCE(distance_km,0)<=0)::int zero_distance_tracks
      FROM flight_tracks WHERE user_id=${userId}
    ), duplicate_flights AS (
      SELECT COALESCE(SUM(n-1),0)::int duplicate_flights FROM (
        SELECT COUNT(*) n FROM flights WHERE user_id=${userId}
        GROUP BY date,UPPER(TRIM(registration)),UPPER(TRIM(departure)),UPPER(TRIM(arrival)),off_block,on_block HAVING COUNT(*)>1
      ) d
    ) SELECT * FROM flight_quality CROSS JOIN track_quality CROSS JOIN duplicate_flights`
  ]);return {aircraft,rates,airports,quality:quality[0]??{}} as {aircraft:Array<Record<string,unknown>>;rates:Array<Record<string,unknown>>;airports:Array<Record<string,unknown>>;quality:Record<string,unknown>};
}
