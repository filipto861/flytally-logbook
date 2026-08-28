import { NextRequest,NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { getRecencyStateForUser,recencyAlertsFromState,recencySnapshotFromState } from "@/lib/recency-service";
import { notifyUserOnce } from "@/lib/notifications";
import { ensureV1353Schema } from "@/lib/v1353-schema";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

export async function GET(request:NextRequest){
  const configured=process.env.CRON_SECRET?.trim(),authorization=request.headers.get("authorization")??"",vercelCron=(request.headers.get("user-agent")??"").toLowerCase().startsWith("vercel-cron/");
  if(configured?authorization!==`Bearer ${configured}`:!vercelCron)return NextResponse.json({error:"Unauthorized"},{status:401});
  await ensureV1353Schema();
  const users=await sql`SELECT s.user_id,s.preferences_json FROM user_settings s JOIN users u ON u.id=s.user_id WHERE COALESCE(u.active,1)=1 ORDER BY s.user_id LIMIT 500` as Array<Record<string,unknown>>;
  let processed=0,notifications=0,failed=0;
  for(const row of users){const userId=Number(row.user_id);if(!Number.isSafeInteger(userId)||userId<=0)continue;try{const preferences=parsePilotPreferences(row.preferences_json),state=await getRecencyStateForUser(userId,preferences),snapshot=recencySnapshotFromState(state),nextPreferences={...state.preferences,recency_snapshot:snapshot};await sql`UPDATE user_settings SET preferences_json=${JSON.stringify(nextPreferences)},updated_at=NOW() WHERE user_id=${userId}`;for(const alert of recencyAlertsFromState(state)){await notifyUserOnce(userId,{kind:"recency_warning",title:alert.title,body:alert.body,href:"/credentials",dedupeKey:alert.dedupeKey});notifications++}processed++}catch(error){failed++;console.error("recency cron user failed",userId,error)}}
  return NextResponse.json({ok:failed===0,processed,notifications,failed});
}
