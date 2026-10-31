import "server-only";
import { createHash,createHmac,randomBytes,randomUUID } from "node:crypto";
import { cookies,headers } from "next/headers";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

const COOKIE_NAME="logbook_session";
const SESSION_SECONDS=60*60*24*7;

export type Session={userId:number;role:"admin"|"user";exp:number;sessionId:string};

function secret(){const value=process.env.SESSION_SECRET?.trim();if(!value||value.length<32)throw new Error("SESSION_SECRET must contain at least 32 characters.");return value;}
export const tokenHash=(value:string)=>createHash("sha256").update(value).digest("base64url");
export const privacyHash=(value:string)=>createHmac("sha256",secret()).update(value).digest("base64url");
export async function requestMetadata(){const h=await headers(),forwarded=h.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";return{ipHash:privacyHash(forwarded),userAgent:(h.get("user-agent")||"").slice(0,500)};}

export async function createSession(userId:number,role:"admin"|"user"){
  await ensureDatabaseOptimizations();
  const raw=randomBytes(32).toString("base64url"),id=randomUUID(),meta=await requestMetadata();
  await sql`DELETE FROM auth_sessions WHERE expires_at<NOW()-INTERVAL '30 days' OR revoked_at<NOW()-INTERVAL '30 days'`;
  await sql`INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,user_agent,ip_hash) VALUES(${id},${userId},${tokenHash(raw)},NOW()+INTERVAL '7 days',${meta.userAgent},${meta.ipHash})`;
  const store=await cookies();
  store.set(COOKIE_NAME,raw,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:SESSION_SECONDS});
  return id;
}

export async function getSession():Promise<Session|null>{
  const raw=(await cookies()).get(COOKIE_NAME)?.value;
  if(!raw||raw.length<40)return null;
  await ensureDatabaseOptimizations();
  const rows=await sql`SELECT s.id,s.user_id,u.role,EXTRACT(EPOCH FROM s.expires_at)::bigint exp,s.last_seen_at
    FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(raw)} AND s.revoked_at IS NULL AND s.expires_at>NOW() AND u.active=1 LIMIT 1` as Array<{id:string;user_id:number|string;role:string;exp:number|string;last_seen_at:string}>;
  const row=rows[0];if(!row)return null;
  if(Date.now()-new Date(row.last_seen_at).getTime()>15*60*1000)void sql`UPDATE auth_sessions SET last_seen_at=NOW() WHERE id=${row.id}`.catch(()=>undefined);
  return{userId:Number(row.user_id),role:row.role==="admin"?"admin":"user",exp:Number(row.exp),sessionId:row.id};
}

export async function destroySession(){
  const store=await cookies(),raw=store.get(COOKIE_NAME)?.value;
  if(raw){await ensureDatabaseOptimizations();await sql`UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE token_hash=${tokenHash(raw)}`;}
  store.delete(COOKIE_NAME);
}

export async function revokeOtherSessions(userId:number,currentSessionId:string){await ensureDatabaseOptimizations();await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${userId} AND id<>${currentSessionId} AND revoked_at IS NULL`;}
export async function revokeSession(userId:number,sessionId:string){await ensureDatabaseOptimizations();await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${userId} AND id=${sessionId} AND revoked_at IS NULL`;}
