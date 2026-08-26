"use server";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { loginContext,recordAuthEvent } from "@/lib/auth/security";
import { tokenHash } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/email";

export type ForgotState={sent?:boolean};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export async function requestPasswordReset(_:ForgotState,form:FormData):Promise<ForgotState>{
  const started=Date.now(),email=String(form.get("email")??"").trim().toLowerCase().slice(0,254);if(!email.includes("@"))return{sent:true};
  await ensureDatabaseOptimizations();const context=await loginContext(email);
  try{
    const users=await sql`SELECT u.id FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE u.active=1 AND LOWER(BTRIM(u.email))=${email} LIMIT 1` as Array<{id:number|string}>;
    const userId=Number(users[0]?.id||0);
    if(userId){
      const limits=await sql`SELECT COUNT(*) FILTER(WHERE user_id=${userId})::int user_requests,COUNT(*) FILTER(WHERE requested_ip_hash=${context.ipHash})::int ip_requests FROM auth_password_resets WHERE created_at>NOW()-INTERVAL '1 hour'` as Array<{user_requests:number|string;ip_requests:number|string}>;
      if(Number(limits[0]?.user_requests||0)<3&&Number(limits[0]?.ip_requests||0)<10){
        const raw=randomBytes(32).toString("base64url");await sql`UPDATE auth_password_resets SET used_at=NOW() WHERE user_id=${userId} AND used_at IS NULL`;
        const rows=await sql`INSERT INTO auth_password_resets(user_id,token_hash,expires_at,requested_ip_hash) VALUES(${userId},${tokenHash(raw)},NOW()+INTERVAL '30 minutes',${context.ipHash}) RETURNING id` as Array<{id:number|string}>;
        const origin=process.env.APP_URL?.trim().replace(/\/$/,"")||"https://fly-tally.com";await sendPasswordResetEmail(email,`${origin}/reset-password?token=${raw}`,Number(rows[0]?.id));await recordAuthEvent(userId,"password_reset_requested");
      }
    }
  }catch(error){console.error("password-reset-request-failed",error);}
  await wait(Math.max(0,650-(Date.now()-started)));return{sent:true};
}
