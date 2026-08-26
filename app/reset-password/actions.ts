"use server";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { hashPassword } from "@/lib/auth/password";
import { tokenHash } from "@/lib/auth/session";
import { recordAuthEvent } from "@/lib/auth/security";

export type ResetState={error?:string};
export async function resetPassword(_:ResetState,form:FormData):Promise<ResetState>{
  const token=String(form.get("token")??"").slice(0,200),password=String(form.get("password")??""),confirm=String(form.get("confirm")??"");
  if(password.length<12||password.length>128)return{error:"Use at least 12 characters for your password."};if(password!==confirm)return{error:"Passwords do not match."};
  await ensureDatabaseOptimizations();const hash=await hashPassword(password);
  const rows=await sql`WITH consumed AS (
    UPDATE auth_password_resets SET used_at=NOW() WHERE token_hash=${tokenHash(token)} AND used_at IS NULL AND expires_at>NOW() RETURNING user_id
  ),changed AS (
    UPDATE user_credentials SET password_hash=${hash},updated_at=NOW() WHERE user_id=(SELECT user_id FROM consumed) RETURNING user_id
  ),revoked AS (
    UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=(SELECT user_id FROM consumed) AND revoked_at IS NULL
  ) SELECT user_id FROM changed` as Array<{user_id:number|string}>;
  if(!rows[0])return{error:"This reset link is invalid, expired or has already been used."};await recordAuthEvent(Number(rows[0].user_id),"password_reset_completed");redirect("/login?reset=success");
}
