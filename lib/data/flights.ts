import "server-only";
import { sql } from "@/lib/db";

export const FLIGHTS_PAGE_SIZE = 50;

export type FlightRow = {
  id: number;
  date: string;
  evidence: string;
  registration: string;
  aircraft_type: string;
  departure: string;
  arrival: string;
  off_block: string;
  on_block: string;
  role: string;
  starts: number;
  takeoff?: string;
  landing?: string;
  aircraft_class?: string;
  commander?: string;
  instructor?: string;
  task?: string;
  billing_basis?: string;
  note?: string;
};

export async function getFlightsPage(userId: number, page: number) {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * FLIGHTS_PAGE_SIZE;
  const rows = await sql`
    SELECT id, date, evidence, registration, aircraft_type, departure, arrival,
           off_block, on_block, role, COALESCE(starts, 0)::integer AS starts,
           COUNT(*) OVER()::integer AS total_count
    FROM flights
    WHERE user_id = ${userId}
    ORDER BY date DESC, off_block DESC NULLS LAST, id DESC
    LIMIT ${FLIGHTS_PAGE_SIZE} OFFSET ${offset}
  ` as Array<FlightRow & { total_count: number }>;
  return {
    rows: rows.map(({ total_count: _total, ...flight }) => flight),
    total: Number(rows[0]?.total_count ?? 0),
    page: safePage,
  };
}

export async function getFlight(userId: number, id: number) {
  const rows = await sql`
    SELECT id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,
           off_block,takeoff,landing,on_block,starts,commander,instructor,role,task,billing_basis,note
    FROM flights WHERE user_id=${userId} AND id=${id} LIMIT 1
  ` as FlightRow[];
  return rows[0] ?? null;
}
