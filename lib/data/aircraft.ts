import "server-only";
import { sql } from "@/lib/db";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";

export type AircraftOption = { registration: string; aircraft_type: string; aircraft_make:string; aircraft_model:string; aircraft_variant:string; aircraft_class: string; regulatory_category:string; balloon_class:string; balloon_group:string; evidence: string; default_role: string; billing_basis: string; price_per_hour: number };

export async function getAircraftOptions(userId: number) {
  await Promise.all([ensureV162Schema(),ensureV164Schema()]);
  return await sql`
    SELECT a.registration, COALESCE(a.aircraft_type, '') AS aircraft_type,
           COALESCE(a.aircraft_make,'') AS aircraft_make,COALESCE(a.aircraft_model,'') AS aircraft_model,COALESCE(a.aircraft_variant,'') AS aircraft_variant,
           COALESCE(aircraft_class, '') AS aircraft_class, COALESCE(regulatory_category,'') AS regulatory_category,
           COALESCE(balloon_class,'') AS balloon_class,COALESCE(balloon_group,'') AS balloon_group,COALESCE(evidence, '') AS evidence,
           COALESCE(default_role, 'PIC') AS default_role, COALESCE(billing_basis, 'BLOCK') AS billing_basis,
           COALESCE(r.price_per_hour, a.default_price_per_hour, 0) AS price_per_hour
    FROM aircraft a LEFT JOIN LATERAL (
      SELECT price_per_hour FROM rates WHERE user_id=${userId} AND UPPER(TRIM(registration))=UPPER(TRIM(a.registration))
        AND (valid_from IS NULL OR valid_from='' OR valid_from<=CURRENT_DATE::text)
      ORDER BY valid_from DESC NULLS LAST,id DESC LIMIT 1
    ) r ON TRUE
    WHERE a.user_id = ${userId} AND active = 1 ORDER BY a.registration
  ` as AircraftOption[];
}
