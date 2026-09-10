import { NextRequest,NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { createSession,getSession,tokenHash } from "@/lib/auth/session";
import { decodeGoogleFlow,googleConfiguration,googleOidc,GOOGLE_FLOW_COOKIE } from "@/lib/auth/google";
import { recordAuthEvent } from "@/lib/auth/security";
import { safeLocalReturnTo } from "@/lib/auth/return-to";

export const runtime="nodejs";
const errorRedirect=(request:NextRequest,code:string,returnTo="/dashboard")=>{const target=new URL("/login",request.url);target.searchParams.set("error",code);const safe=safeLocalReturnTo(returnTo);if(safe!=="/dashboard")target.searchParams.set("returnTo",safe);return NextResponse.redirect(target);};
const slug=(email:string)=>`${email.split("@")[0].replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"pilot"}-${Date.now().toString(36)}`;

export async function GET(request:NextRequest){
  const flow=decodeGoogleFlow(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value);if(!flow)return errorRedirect(request,"google_expired");
  const returnTo=flow.intent==="login"?safeLocalReturnTo(flow.returnTo):"/dashboard";
  try{
    const config=await googleConfiguration(),tokens=await googleOidc.authorizationCodeGrant(config,new URL(request.url),{pkceCodeVerifier:flow.verifier,expectedState:flow.state,expectedNonce:flow.nonce});
    const claims=tokens.claims(),subject=String(claims?.sub||""),email=String(claims?.email||"").trim().toLowerCase(),name=String(claims?.name||email.split("@")[0]||"Pilot").trim().slice(0,120);
    if(!subject||!email||claims?.email_verified!==true)return errorRedirect(request,"google_unverified",returnTo);
    await ensureDatabaseOptimizations();

    if(flow.intent==="link"){
      const session=await getSession();if(!session||session.userId!==flow.userId)return errorRedirect(request,"google_expired");
      const conflict=await sql`SELECT user_id FROM auth_identities WHERE provider='google' AND provider_subject=${subject} LIMIT 1` as Array<{user_id:number|string}>;
      if(conflict[0]&&Number(conflict[0].user_id)!==session.userId)return errorRedirect(request,"google_in_use");
      await sql`INSERT INTO auth_identities(user_id,provider,provider_subject,provider_email,last_login_at) VALUES(${session.userId},'google',${subject},${email},NOW()) ON CONFLICT(user_id,provider) DO UPDATE SET provider_subject=EXCLUDED.provider_subject,provider_email=EXCLUDED.provider_email,last_login_at=NOW()`;
      await sql`UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=${session.userId} AND LOWER(BTRIM(email))=${email}`;
      await recordAuthEvent(session.userId,"google_linked",{email});
      const response=NextResponse.redirect(new URL("/profile?google=linked#security",request.url));response.cookies.delete(GOOGLE_FLOW_COOKIE);return response;
    }

    let rows=await sql`SELECT u.id,u.role,u.active FROM auth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.provider_subject=${subject} LIMIT 1` as Array<{id:number|string;role:string;active:number|string}>;
    if(!rows[0]){
      if(!flow.invite)return errorRedirect(request,"invite_required",returnTo);
      const inviteHash=tokenHash(flow.invite);
      const existing=await sql`SELECT id FROM users WHERE LOWER(BTRIM(email))=${email} LIMIT 1` as Array<{id:number|string}>;
      if(existing[0])return errorRedirect(request,"google_link_required",returnTo);
      rows=await sql`WITH valid AS (
        SELECT id,role FROM auth_invites WHERE token_hash=${inviteHash} AND LOWER(BTRIM(email))=${email} AND used_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE
      ),created AS (
        INSERT INTO users(email,display_name,slug,role,active,email_verified_at,created_at,updated_at)
        SELECT ${email},${name},${slug(email)},CASE WHEN role='admin' THEN 'admin' ELSE 'user' END,1,NOW(),NOW(),NOW() FROM valid RETURNING id,role,active
      ),identity AS (
        INSERT INTO auth_identities(user_id,provider,provider_subject,provider_email,last_login_at) SELECT id,'google',${subject},${email},NOW() FROM created
      ),settings AS (
        INSERT INTO user_settings(user_id,timezone,currency,default_role,created_at,updated_at) SELECT id,'Europe/Prague','CZK','PIC',NOW(),NOW() FROM created ON CONFLICT(user_id) DO NOTHING
      ),used AS (
        UPDATE auth_invites SET used_at=NOW(),used_by_user_id=(SELECT id FROM created) WHERE id=(SELECT id FROM valid)
      ) SELECT id,role,active FROM created` as Array<{id:number|string;role:string;active:number|string}>;
      if(!rows[0])return errorRedirect(request,"invite_invalid",returnTo);
    }
    const user=rows[0];if(Number(user.active)!==1)return errorRedirect(request,"account_inactive",returnTo);
    const userId=Number(user.id);await sql`UPDATE auth_identities SET last_login_at=NOW(),provider_email=${email} WHERE provider='google' AND provider_subject=${subject}`;
    await createSession(userId,user.role==="admin"?"admin":"user");await recordAuthEvent(userId,"google_login");
    const response=NextResponse.redirect(new URL(returnTo,request.url));response.cookies.delete(GOOGLE_FLOW_COOKIE);return response;
  }catch(error){console.error("google-auth-failed",error);return errorRedirect(request,"google_failed",returnTo);}
}
