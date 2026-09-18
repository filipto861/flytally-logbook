import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  const{userId}=await requireUser();
  const rows=await sql`SELECT id,kind,title,body,href FROM user_notifications WHERE user_id=${userId} AND read_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];
  if(!row)return NextResponse.json({notification:null},{headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({notification:{id:Number(row.id)||0,kind:String(row.kind??"notification").slice(0,60),title:String(row.title??"FlyTally").slice(0,160),body:String(row.body??"").slice(0,240),href:String(row.href??"/notifications").startsWith("/")?String(row.href):"/notifications"}},{headers:{"Cache-Control":"no-store"}});
}
