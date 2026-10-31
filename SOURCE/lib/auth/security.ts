import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { privacyHash,requestMetadata } from "./session";

export async function loginContext(email:string){await ensureDatabaseOptimizations();const meta=await requestMetadata();return{...meta,emailHash:privacyHash(email.trim().toLowerCase())};}
export async function isLoginLimited(emailHash:string,ipHash:string){const rows=await sql`SELECT
  COUNT(*) FILTER(WHERE email_hash=${emailHash} AND succeeded=FALSE)::int email_failures,
  COUNT(*) FILTER(WHERE ip_hash=${ipHash} AND succeeded=FALSE)::int ip_failures
  FROM auth_login_attempts WHERE attempted_at>NOW()-INTERVAL '15 minutes'` as Array<{email_failures:number|string;ip_failures:number|string}>;return Number(rows[0]?.email_failures||0)>=8||Number(rows[0]?.ip_failures||0)>=30;}
export async function recordLoginAttempt(emailHash:string,ipHash:string,succeeded:boolean){await sql`DELETE FROM auth_login_attempts WHERE attempted_at<NOW()-INTERVAL '7 days'`;if(succeeded){await sql`DELETE FROM auth_login_attempts WHERE email_hash=${emailHash} OR ip_hash=${ipHash}`;return;}await sql`INSERT INTO auth_login_attempts(email_hash,ip_hash,succeeded) VALUES(${emailHash},${ipHash},FALSE)`;}
export async function recordAuthEvent(userId:number|null,eventType:string,details:Record<string,unknown>={}){const meta=await requestMetadata();await sql`INSERT INTO auth_events(user_id,event_type,ip_hash,user_agent,details) VALUES(${userId},${eventType},${meta.ipHash},${meta.userAgent},${JSON.stringify(details)})`;}
