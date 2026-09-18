import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getPushPreferences,pushDeviceCount,pushPublicKey } from "@/lib/push-notifications";
import { ensurePushSchema } from "@/lib/push-schema";

export const dynamic="force-dynamic";

export async function GET(){
  const{userId}=await requireUser();
  await ensurePushSchema();
  const[preferences,devices]=await Promise.all([getPushPreferences(userId),pushDeviceCount(userId)]);
  return NextResponse.json({configured:true,publicKey:pushPublicKey(),preferences,devices},{headers:{"Cache-Control":"no-store"}});
}
