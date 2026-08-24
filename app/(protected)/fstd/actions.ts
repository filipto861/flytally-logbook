"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { durationMinutes } from "@/lib/easa-logbook";
import { blockingComplianceIssues,fstdCompliance } from "@/lib/fcl050-compliance";
import { fstdCertificationHash } from "@/lib/certification-integrity";

const text=(form:FormData,key:string,max=500)=>String(form.get(key)??"").trim().slice(0,max);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const revalidateFstd=()=>{revalidatePath("/fstd");revalidatePath("/certification");revalidatePath("/print");};
const formRecord=(form:FormData)=>{const sessionDate=text(form,"sessionDate",10),deviceType=text(form,"deviceType",120),qualificationNumber=text(form,"qualificationNumber",120),instruction=text(form,"instruction",300),remarks=text(form,"remarks",2000),totalMinutes=durationMinutes(form.get("totalTime"));return{sessionDate,deviceType,qualificationNumber,instruction,remarks,totalMinutes,draft:{session_date:sessionDate,device_type:deviceType,qualification_number:qualificationNumber,instruction,total_minutes:totalMinutes,remarks}}};

export async function createFstdSession(form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const value=formRecord(form);
  if(!validDate(value.sessionDate)||blockingComplianceIssues(fstdCompliance(value.draft)).length)return;
  await sql`INSERT INTO fstd_sessions(user_id,session_date,device_type,qualification_number,instruction,total_minutes,remarks,created_at,updated_at) VALUES(${userId},${value.sessionDate},${value.deviceType},${value.qualificationNumber},${value.instruction},${value.totalMinutes},${value.remarks},NOW(),NOW())`;
  revalidateFstd();
}

export async function updateFstdSession(form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const id=Number(form.get("id")),value=formRecord(form);if(!Number.isSafeInteger(id)||id<=0)return;
  if(!validDate(value.sessionDate)||blockingComplianceIssues(fstdCompliance(value.draft)).length)return;
  await sql`UPDATE fstd_sessions SET session_date=${value.sessionDate},device_type=${value.deviceType},qualification_number=${value.qualificationNumber},instruction=${value.instruction},total_minutes=${value.totalMinutes},remarks=${value.remarks},updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND certified_at IS NULL`;
  revalidateFstd();
}

export async function deleteFstdSession(form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;
  await sql`DELETE FROM fstd_sessions s WHERE s.id=${id} AND s.user_id=${userId} AND s.certified_at IS NULL AND NOT EXISTS(SELECT 1 FROM fstd_certified_revisions r WHERE r.user_id=s.user_id AND r.fstd_session_id=s.id)`;
  revalidateFstd();
}

export async function certifyFstdSession(form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0||text(form,"confirm",20)!=="certify")return;
  const rows=await sql`SELECT id,session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at,certification_version,record_revision,correction_reason FROM fstd_sessions WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||row.certified_at||blockingComplianceIssues(fstdCompliance(row)).length)return;
  const certificationHash=fstdCertificationHash({...row,certification_version:2},userId,2);
  await sql`UPDATE fstd_sessions SET certified_at=NOW(),certified_by_user_id=${userId},certification_hash=${certificationHash},certification_version=2,updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND certified_at IS NULL`;
  revalidateFstd();
}

export async function startFstdCorrection(form:FormData){
  const {userId}=await requireUser();await ensureDatabaseOptimizations();const id=Number(form.get("id")),reason=text(form,"reason",1000);if(!Number.isSafeInteger(id)||id<=0||reason.length<8)return;
  const rows=await sql`SELECT certified_at,record_revision FROM fstd_sessions WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;const current=rows[0];if(!current||!current.certified_at)return;
  await sql.transaction([
    sql`INSERT INTO fstd_certified_revisions(fstd_session_id,user_id,revision_number,snapshot_data,certification_hash,certification_version,certified_at,certified_by_user_id,superseded_at,superseded_by_user_id,correction_reason)
      SELECT s.id,s.user_id,COALESCE(s.record_revision,1),to_jsonb(s),COALESCE(s.certification_hash,''),COALESCE(s.certification_version,1),s.certified_at,s.certified_by_user_id,NOW(),${userId},${reason}
      FROM fstd_sessions s WHERE s.id=${id} AND s.user_id=${userId} AND s.certified_at IS NOT NULL
      ON CONFLICT(user_id,fstd_session_id,revision_number) DO NOTHING`,
    sql`UPDATE fstd_sessions SET record_revision=COALESCE(record_revision,1)+1,correction_reason=${reason},correction_opened_at=NOW(),correction_opened_by_user_id=${userId},certified_at=NULL,certified_by_user_id=NULL,certification_hash='' WHERE id=${id} AND user_id=${userId} AND certified_at IS NOT NULL`,
  ]);
  revalidateFstd();
}
