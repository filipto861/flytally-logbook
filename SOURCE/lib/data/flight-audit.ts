import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import type { FlightAuditAction,FlightAuditEvent } from "@/lib/flight-audit";

const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;

export async function getFlightAudit(userId:number,flightId:number):Promise<FlightAuditEvent[]>{
  await ensureDatabaseOptimizations();
  const rows=await sql`SELECT a.id,a.flight_id,a.action,a.old_data,a.new_data,a.changed_at,u.display_name
    FROM flight_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id
    WHERE a.user_id=${userId} AND a.flight_id=${flightId}
    ORDER BY a.changed_at DESC,a.id DESC LIMIT 100` as Array<Record<string,unknown>>;
  return rows.map(row=>({id:Number(row.id),flightId:Number(row.flight_id),action:String(row.action) as FlightAuditAction,changedAt:String(row.changed_at||""),actor:String(row.display_name||"Account owner"),oldData:object(row.old_data),newData:object(row.new_data)}));
}
