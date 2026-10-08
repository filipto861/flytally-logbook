import { calendarDateInTimeZone,normalizeSaveableTimeZone } from "../calendar-date.ts";

export type SaveableCalendarDefault=
  | {status:"resolved";timeZone:string;date:string}
  | {status:"needs_configuration";reason:"missing"|"blank"|"invalid"}
  | {status:"unavailable";reason:"read_failed"};

export type UserCalendarTimeZoneReader=(userId:number)=>Promise<unknown>;

async function readUserCalendarTimeZone(userId:number){
  const{sql}=await import("@/lib/db");
  const rows=await sql`SELECT timezone FROM user_settings WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  return rows[0]?.timezone;
}

export function resolveSaveableCalendarDefault(timeZoneValue:unknown,instant:Date=new Date()):SaveableCalendarDefault{
  if(timeZoneValue===null||timeZoneValue===undefined)return{status:"needs_configuration",reason:"missing"};
  const raw=String(timeZoneValue);
  if(!raw.trim())return{status:"needs_configuration",reason:"blank"};
  const timeZone=normalizeSaveableTimeZone(raw);
  if(!timeZone)return{status:"needs_configuration",reason:"invalid"};
  const date=calendarDateInTimeZone(instant,timeZone);
  if(!date)return{status:"unavailable",reason:"read_failed"};
  return{status:"resolved",timeZone,date};
}

export async function getUserSaveableCalendarDefault(
  userId:number,
  reader:UserCalendarTimeZoneReader=readUserCalendarTimeZone,
  instant:Date=new Date(),
):Promise<SaveableCalendarDefault>{
  try{
    return resolveSaveableCalendarDefault(await reader(userId),instant);
  }catch{
    return{status:"unavailable",reason:"read_failed"};
  }
}
