"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { durationMinutes } from "@/lib/easa-logbook";

const text=(form:FormData,key:string,max=500)=>String(form.get(key)??"").trim().slice(0,max);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function createFstdSession(form:FormData){
  const {userId}=await requireUser(),sessionDate=text(form,"sessionDate",10),deviceType=text(form,"deviceType",120),qualificationNumber=text(form,"qualificationNumber",120),instruction=text(form,"instruction",300),remarks=text(form,"remarks",2000),totalMinutes=durationMinutes(form.get("totalTime"));
  if(!validDate(sessionDate)||!deviceType||totalMinutes<=0)return;
  await sql`INSERT INTO fstd_sessions(user_id,session_date,device_type,qualification_number,instruction,total_minutes,remarks,created_at,updated_at) VALUES(${userId},${sessionDate},${deviceType},${qualificationNumber},${instruction},${totalMinutes},${remarks},NOW(),NOW())`;
  revalidatePath("/fstd");revalidatePath("/print");
}

export async function deleteFstdSession(form:FormData){
  const {userId}=await requireUser(),id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;
  await sql`DELETE FROM fstd_sessions WHERE id=${id} AND user_id=${userId} AND certified_at IS NULL`;
  revalidatePath("/fstd");revalidatePath("/print");
}

export async function certifyFstdSession(form:FormData){
  const {userId}=await requireUser(),id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0||text(form,"confirm",20)!=="certify")return;
  const rows=await sql`SELECT id,session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at FROM fstd_sessions WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||row.certified_at)return;
  const certificationHash=hash({version:1,userId,id:Number(row.id),date:String(row.session_date),deviceType:String(row.device_type||""),qualificationNumber:String(row.qualification_number||""),instruction:String(row.instruction||""),totalMinutes:Number(row.total_minutes||0),remarks:String(row.remarks||"")});
  await sql`UPDATE fstd_sessions SET certified_at=NOW(),certified_by_user_id=${userId},certification_hash=${certificationHash},certification_version=1,updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND certified_at IS NULL`;
  revalidatePath("/fstd");revalidatePath("/print");
}
