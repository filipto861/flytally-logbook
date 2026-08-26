"use server";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { hashPassword } from "@/lib/auth/password";
import { createSession,tokenHash } from "@/lib/auth/session";
import { recordAuthEvent } from "@/lib/auth/security";

export type JoinState={error?:string};
export async function joinWithPassword(_:JoinState,form:FormData):Promise<JoinState>{
  const token=String(form.get("token")??"").slice(0,200),name=String(form.get("name")??"").trim().slice(0,120),password=String(form.get("password")??""),confirm=String(form.get("confirm")??"");
  if(!token||!name)return{error:"Complete all fields."};if(password.length<12||password.length>128)return{error:"Use at least 12 characters for your password."};if(password!==confirm)return{error:"Passwords do not match."};
  await ensureDatabaseOptimizations();const hash=await hashPassword(password),inviteHash=tokenHash(token),slug=`${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"pilot"}-${Date.now().toString(36)}`;
  const rows=await sql`WITH valid AS (
    SELECT id,email,role FROM auth_invites WHERE token_hash=${inviteHash} AND used_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE
  ),created AS (
    INSERT INTO users(email,display_name,slug,role,active,email_verified_at,created_at,updated_at)
    SELECT LOWER(BTRIM(email)),${name},${slug},CASE WHEN role='admin' THEN 'admin' ELSE 'user' END,1,NOW(),NOW(),NOW() FROM valid
    ON CONFLICT DO NOTHING RETURNING id,role
  ),credentials AS (
    INSERT INTO user_credentials(user_id,password_hash,created_at,updated_at) SELECT id,${hash},NOW(),NOW() FROM created
  ),settings AS (
    INSERT INTO user_settings(user_id,timezone,currency,default_role,created_at,updated_at) SELECT id,'Europe/Prague','CZK','PIC',NOW(),NOW() FROM created ON CONFLICT(user_id) DO NOTHING
  ),used AS (
    UPDATE auth_invites SET used_at=NOW(),used_by_user_id=(SELECT id FROM created) WHERE id=(SELECT id FROM valid) AND EXISTS(SELECT 1 FROM created)
  ) SELECT id,role FROM created` as Array<{id:number|string;role:string}>;
  if(!rows[0])return{error:"This invitation is invalid, expired or already used."};
  const userId=Number(rows[0].id);await createSession(userId,rows[0].role==="admin"?"admin":"user");await recordAuthEvent(userId,"invite_password_signup");redirect("/dashboard");
}
