"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { normalizeAppearance } from "@/lib/ui-preferences";

export async function saveAppearance(formData:FormData){
  const{userId}=await requireUser();
  const rows=await sql`SELECT timezone,currency,home_airport,default_role,preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0]??{},preferences=parsePilotPreferences(row.preferences_json),appearance=normalizeAppearance(formData.get("appearance"));
  const timezone=String(row.timezone||"Europe/Prague"),currency=String(row.currency||"CZK"),homeAirport=String(row.home_airport||"").toUpperCase(),defaultRole=String(row.default_role||"PIC");
  await sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at)
    VALUES(${userId},${timezone},${currency},${homeAirport},${defaultRole},${JSON.stringify({...preferences,appearance})},NOW(),NOW())
    ON CONFLICT(user_id) DO UPDATE SET preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`;
  revalidatePath("/profile");revalidatePath("/dashboard");revalidatePath("/map");
}
