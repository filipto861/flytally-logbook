import { NextRequest,NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getPushPreferences,savePushPreferences } from "@/lib/push-notifications";

const bool=(value:unknown,fallback:boolean)=>typeof value==="boolean"?value:fallback;

export async function POST(request:NextRequest){
  const{userId}=await requireUser();
  const current=await getPushPreferences(userId);
  let body:Record<string,unknown>={};
  try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:"Invalid preferences."},{status:400})}
  const next={enabled:bool(body.enabled,current.enabled),compliance:bool(body.compliance,current.compliance),activity:bool(body.activity,current.activity),security:bool(body.security,current.security)};
  await savePushPreferences(userId,next);
  return NextResponse.json({ok:true,preferences:next});
}
