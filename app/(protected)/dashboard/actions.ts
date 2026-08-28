"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { dashboardLayoutFromValue } from "@/lib/dashboard-widgets";
import { parsePilotPreferences } from "@/lib/logbook-print";

export type DashboardSaveState={ok:boolean;message:string};

export async function saveDashboardLayout(_previous:DashboardSaveState,formData:FormData):Promise<DashboardSaveState>{
  const{userId}=await requireUser(),raw=String(formData.get("layout")??"");
  if(!raw||raw.length>20000)return{ok:false,message:"Dashboard layout is invalid."};
  let requested:unknown;
  try{requested=JSON.parse(raw)}catch{return{ok:false,message:"Dashboard layout is invalid."}}
  if(!Array.isArray(requested))return{ok:false,message:"Dashboard layout is invalid."};
  const layout=dashboardLayoutFromValue(requested);
  if(!layout.some(item=>item.enabled))return{ok:false,message:"Keep at least one widget visible."};
  const rows=await sql`SELECT timezone,currency,home_airport,default_role,preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0]??{},preferences=parsePilotPreferences(row.preferences_json),timezone=String(row.timezone||"Europe/Prague"),currency=String(row.currency||"CZK"),homeAirport=String(row.home_airport||"").toUpperCase(),defaultRole=String(row.default_role||"PIC");
  await sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at)
    VALUES(${userId},${timezone},${currency},${homeAirport},${defaultRole},${JSON.stringify({...preferences,dashboard_widgets:layout})},NOW(),NOW())
    ON CONFLICT(user_id) DO UPDATE SET preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`;
  revalidatePath("/dashboard");
  return{ok:true,message:"Dashboard saved."};
}
