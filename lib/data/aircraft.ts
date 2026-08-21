import "server-only";
import { sql } from "@/lib/db";

export type AircraftOption = { registration: string; aircraft_type: string; aircraft_class: string; evidence: string; default_role: string; billing_basis: string };

export async function getAircraftOptions(userId: number) {
  return await sql`
    SELECT registration, COALESCE(aircraft_type, '') AS aircraft_type,
           COALESCE(aircraft_class, '') AS aircraft_class, COALESCE(evidence, '') AS evidence,
           COALESCE(default_role, 'PIC') AS default_role, COALESCE(billing_basis, 'BLOCK') AS billing_basis
    FROM aircraft WHERE user_id = ${userId} AND active = 1 ORDER BY registration
  ` as AircraftOption[];
}
