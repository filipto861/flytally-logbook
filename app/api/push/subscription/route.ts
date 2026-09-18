import { NextRequest,NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { removePushSubscription,savePushSubscription } from "@/lib/push-notifications";
import { ensurePushSchema } from "@/lib/push-schema";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { parseRecencyNotificationDays } from "@/lib/recency-service";

type SubscriptionBody={endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
const text=(value:unknown)=>String(value??"").trim();

async function ensureDefaultComplianceWindow(userId:number){
  const rows=await sql`SELECT preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const preferences=parsePilotPreferences(rows[0]?.preferences_json);
  if(parseRecencyNotificationDays(preferences.recency_notification_days)>0)return;
  await sql`UPDATE user_settings SET preferences_json=${JSON.stringify({...preferences,recency_notification_days:30})},updated_at=NOW() WHERE user_id=${userId}`;
}

export async function POST(request:NextRequest){
  const session=await requireUser();
  await ensurePushSchema();
  let body:SubscriptionBody={};
  try{body=await request.json() as SubscriptionBody}catch{return NextResponse.json({error:"Invalid subscription."},{status:400})}
  const endpoint=text(body.endpoint),p256dh=text(body.keys?.p256dh),auth=text(body.keys?.auth);
  if(!endpoint)return NextResponse.json({error:"Push endpoint is required."},{status:400});
  try{
    await savePushSubscription({userId:session.userId,sessionId:session.sessionId,endpoint,p256dh,auth,userAgent:request.headers.get("user-agent")??""});
    await Promise.all([
      sql`INSERT INTO push_preferences(user_id,enabled,compliance,activity,security,updated_at) VALUES(${session.userId},TRUE,TRUE,TRUE,TRUE,NOW()) ON CONFLICT(user_id) DO NOTHING`,
      ensureDefaultComplianceWindow(session.userId),
    ]);
    return NextResponse.json({ok:true});
  }catch(error){
    console.error("push-subscription-save-failed",error);
    return NextResponse.json({error:"This browser push service is not supported."},{status:400});
  }
}

export async function DELETE(request:NextRequest){
  const{userId}=await requireUser();
  await ensurePushSchema();
  let body:SubscriptionBody={};
  try{body=await request.json() as SubscriptionBody}catch{}
  const endpoint=text(body.endpoint);
  if(endpoint)await removePushSubscription(userId,endpoint);
  return NextResponse.json({ok:true});
}
