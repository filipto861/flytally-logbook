import { FALLBACK_TIMEZONE,normalizeTimeZone } from "../display-format.ts";

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
