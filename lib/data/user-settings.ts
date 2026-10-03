import { FALLBACK_TIMEZONE,normalizeTimeZone } from "../display-format.ts";
import { nightDefinitionFromPreferences,type NightDefinition } from "../night-definition.ts";

export type UserTimezoneReader=(userId:number)=>Promise<Array<Record<string,unknown>>>;

async function readUserTimezone(userId:number){
  const{sql}=await import("@/lib/db");
  return sql`SELECT timezone FROM user_settings WHERE user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>;
}

export async function getUserTimezone(userId:number,reader:UserTimezoneReader=readUserTimezone){
  try{
    const rows=await reader(userId);
    return normalizeTimeZone(rows[0]?.timezone);
  }catch{
    return FALLBACK_TIMEZONE;
  }
}


export type UserNightDefinitionReader=(userId:number)=>Promise<Array<Record<string,unknown>>>;

async function readUserNightDefinition(userId:number){
  const{sql}=await import("@/lib/db");
  return sql`SELECT preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>;
}

export async function getUserNightDefinition(userId:number,reader:UserNightDefinitionReader=readUserNightDefinition):Promise<NightDefinition>{
  try{
    const rows=await reader(userId);
    return nightDefinitionFromPreferences(rows[0]?.preferences_json);
  }catch{
    return"MANUAL";
  }
}
