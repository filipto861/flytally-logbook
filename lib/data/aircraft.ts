import "server-only";
import { sql } from "@/lib/db";
import { ensureV162Schema } from "@/lib/v162-schema";
import { ensureV164Schema } from "@/lib/v164-schema";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

export type AircraftOption = { registration: string; aircraft_type: string; aircraft_make:string; aircraft_model:string; aircraft_variant:string; aircraft_class: string; regulatory_category:string; balloon_class:string; balloon_group:string; evidence: string; part_fcl_credit_class?:string; part_fcl_credit_basis?:string; part_fcl_credit_from?:string; default_role: string; default_operation_type:string; billing_basis: string; price_per_hour: number };

export async function getAircraftOptions(userId: number) {
  await Promise.all([ensureDatabaseOptimizations(),ensureV162Schema(),ensureV164Schema()]);
  return await sql`
    SELECT a.registration, COALESCE(a.aircraft_type, '') AS aircraft_type,
           COALESCE(a.aircraft_make,'') AS aircraft_make,COALESCE(a.aircraft_model,'') AS aircraft_model,COALESCE(a.aircraft_variant,'') AS aircraft_variant,
           COALESCE(aircraft_class, '') AS aircraft_class, COALESCE(regulatory_category,'') AS regulatory_category,
           COALESCE(balloon_class,'') AS balloon_class,COALESCE(balloon_group,'') AS balloon_group,COALESCE(evidence, '') AS evidence,
           COALESCE(part_fcl_credit_class,'') AS part_fcl_credit_class,COALESCE(part_fcl_credit_basis,'') AS part_fcl_credit_basis,COALESCE(part_fcl_credit_from,'') AS part_fcl_credit_from,
           COALESCE(default_role, 'PIC') AS default_role, COALESCE(default_operation_type,'') AS default_operation_type, COALESCE(billing_basis, '') AS billing_basis,
           COALESCE(r.price_per_hour, a.default_price_per_hour, 0) AS price_per_hour
    FROM aircraft a LEFT JOIN LATERAL (
      SELECT price_per_hour FROM rates WHERE user_id=${userId} AND UPPER(TRIM(registration))=UPPER(TRIM(a.registration))
        AND (valid_from IS NULL OR valid_from='' OR valid_from<=CURRENT_DATE::text)
      ORDER BY valid_from DESC NULLS LAST,id DESC LIMIT 1
    ) r ON TRUE
    WHERE a.user_id = ${userId} AND active = 1 ORDER BY a.registration
  ` as AircraftOption[];
}
