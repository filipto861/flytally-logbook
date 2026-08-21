import "server-only";
import { sql } from "@/lib/db";
export async function getDatabaseData(userId:number){
  const [aircraft,rates,airports]=await Promise.all([
    sql`SELECT id,registration,aircraft_type,icao_type,aircraft_class,evidence,default_price_per_hour,default_role,billing_basis,active,note FROM aircraft WHERE user_id=${userId} ORDER BY active DESC,registration`,
    sql`SELECT id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source FROM rates WHERE user_id=${userId} ORDER BY registration,valid_from DESC NULLS LAST`,
    sql`SELECT id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,active,closed,source FROM airports WHERE user_id=${userId} ORDER BY active DESC,ident LIMIT 500`
  ]);return {aircraft,rates,airports} as {aircraft:Array<Record<string,unknown>>;rates:Array<Record<string,unknown>>;airports:Array<Record<string,unknown>>};
}
