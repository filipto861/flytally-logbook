import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { unreadNotificationCount } from "@/lib/notifications";

export const dynamic="force-dynamic";

export async function GET(){
  const{userId}=await requireUser();
  const unread=await unreadNotificationCount(userId);
  return NextResponse.json({unread},{headers:{"Cache-Control":"private, no-store"}});
}
