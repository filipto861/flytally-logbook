"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { parseCustomRecencyRules,type CustomRecencyRule } from "@/lib/recency-engine";

const s=(f:FormData,key:string)=>String(f.get(key)??"").trim();
async function current(userId:number){const rows=await sql`SELECT timezone,currency,home_airport,default_role,preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;const row=rows[0]??{};return{row,preferences:parsePilotPreferences(row.preferences_json)}}
async function write(userId:number,row:Record<string,unknown>,rules:CustomRecencyRule[]){const preferences={...parsePilotPreferences(row.preferences_json),recency_rules:rules};await sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at) VALUES(${userId},${String(row.timezone||"Europe/Prague")},${String(row.currency||"CZK")},${String(row.home_airport||"")},${String(row.default_role||"PIC")},${JSON.stringify(preferences)},NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`;revalidatePath("/credentials")}
export async function addRecencyRule(f:FormData){const{userId}=await requireUser(),state=await current(userId),existing=parseCustomRecencyRules(state.preferences.recency_rules),candidate=parseCustomRecencyRules([{id:`custom-${randomUUID()}`,label:s(f,"label"),windowDays:Number(s(f,"window_days")),metric:s(f,"metric"),target:Number(s(f,"target")),evidence:s(f,"evidence"),aircraftClass:s(f,"aircraft_class"),role:s(f,"role")}])[0];if(!candidate)return;await write(userId,state.row,[...existing,candidate].slice(-20))}
export async function deleteRecencyRule(f:FormData){const{userId}=await requireUser(),state=await current(userId),id=s(f,"id");await write(userId,state.row,parseCustomRecencyRules(state.preferences.recency_rules).filter(rule=>rule.id!==id))}
