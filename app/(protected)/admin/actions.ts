"use server";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { hashLegacyPassword } from "@/lib/auth/password";
import { tokenHash } from "@/lib/auth/session";
import { sendInvitationEmail } from "@/lib/email";

async function admin(){const session=await requireUser();if(session.role!=="admin")throw new Error("Access denied.");return session}
export async function toggleUser(form:FormData){const session=await admin(),id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0||id===session.userId)return;const rows=await sql`UPDATE users SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${id} RETURNING active` as Array<{active:number|string}>;if(Number(rows[0]?.active)!==1)await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${id} AND revoked_at IS NULL`;revalidatePath("/admin")}
export async function changeRole(form:FormData){const session=await admin(),id=Number(form.get("id")),role=String(form.get("role"))==="admin"?"admin":"user";if(!Number.isSafeInteger(id)||id<=0||id===session.userId)return;await sql`UPDATE users SET role=${role},updated_at=NOW() WHERE id=${id}`;revalidatePath("/admin")}
export async function createUser(form:FormData){await admin();const email=String(form.get("email")??"").trim().toLowerCase().slice(0,254),displayName=String(form.get("display_name")??"").trim().slice(0,120),password=String(form.get("password")??""),role=String(form.get("role"))==="admin"?"admin":"user";if(!email||!email.includes("@")||!displayName||password.length<12||password.length>128)return;const hash=await hashLegacyPassword(password),slug=`${email.split("@")[0].replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"pilot"}-${Date.now().toString(36)}`;const rows=await sql`WITH created AS (INSERT INTO users(email,display_name,slug,role,active,created_at,updated_at) VALUES(${email},${displayName},${slug},${role},1,NOW(),NOW()) RETURNING id) INSERT INTO user_credentials(user_id,password_hash,created_at,updated_at) SELECT id,${hash},NOW(),NOW() FROM created RETURNING user_id` as Array<{user_id:number|string}>;if(rows[0])await sql`INSERT INTO user_settings(user_id,timezone,currency,default_role,created_at,updated_at) VALUES(${Number(rows[0].user_id)},'Europe/Prague','CZK','PIC',NOW(),NOW()) ON CONFLICT(user_id) DO NOTHING`;revalidatePath("/admin")}
export async function resetUserPassword(form:FormData){const session=await admin(),id=Number(form.get("id")),password=String(form.get("password")??"");if(!Number.isSafeInteger(id)||id<=0||id===session.userId||password.length<12||password.length>128)return;const hash=await hashLegacyPassword(password);await sql`INSERT INTO user_credentials(user_id,password_hash,created_at,updated_at) VALUES(${id},${hash},NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=NOW()`;await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${id} AND revoked_at IS NULL`;revalidatePath("/admin")}

export type InviteState={error?:string;url?:string;sent?:boolean};
export async function createInvitation(_:InviteState,form:FormData):Promise<InviteState>{
  const session=await admin(),email=String(form.get("email")??"").trim().toLowerCase().slice(0,254),days=Math.min(14,Math.max(1,Number(form.get("days"))||7));
  if(!email.includes("@"))return{error:"Enter a valid email address."};
  const existing=await sql`SELECT id FROM users WHERE LOWER(BTRIM(email))=${email} LIMIT 1`;if(existing[0])return{error:"This email already has a FlyTally account."};
  const raw=randomBytes(32).toString("base64url");await sql`UPDATE auth_invites SET revoked_at=NOW() WHERE LOWER(BTRIM(email))=${email} AND used_at IS NULL AND revoked_at IS NULL`;
  const created=await sql`INSERT INTO auth_invites(email,token_hash,role,expires_at,created_by_user_id) VALUES(${email},${tokenHash(raw)},'user',NOW()+(${days}::text||' days')::interval,${session.userId}) RETURNING id` as Array<{id:number|string}>;
  const h=await headers(),origin=process.env.APP_URL?.trim().replace(/\/$/,"")||h.get("origin")||"https://fly-tally.com",url=`${origin}/join?token=${raw}`;
  try{await sendInvitationEmail(email,url,Number(created[0]?.id));revalidatePath("/admin");return{url,sent:true};}catch(error){console.error("invitation-email-failed",error);revalidatePath("/admin");return{url,error:"Invitation was created, but the email could not be sent. Copy the private link below."};}
}
export async function revokeInvitation(form:FormData){await admin();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;await sql`UPDATE auth_invites SET revoked_at=NOW() WHERE id=${id} AND used_at IS NULL`;revalidatePath("/admin")}
export async function toggleFeature(form:FormData){const session=await admin(),key=String(form.get("key")??"");if(!["crew_sharing","verified_approvals"].includes(key))return;await sql`UPDATE feature_switches SET enabled=NOT enabled,updated_by_user_id=${session.userId},updated_at=NOW() WHERE key=${key}`;revalidatePath("/admin")}
