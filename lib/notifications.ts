import "server-only";
import { sql } from "@/lib/db";

type NotificationInput={kind:string;title:string;body?:string;href?:string;dedupeKey:string};
export async function notifyUser(userId:number,input:NotificationInput){
  if(!Number.isSafeInteger(userId)||userId<=0)return;
  await sql`INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key) VALUES(${userId},${input.kind.slice(0,60)},${input.title.slice(0,160)},${String(input.body??"").slice(0,500)},${String(input.href??"").slice(0,500)},${input.dedupeKey.slice(0,200)}) ON CONFLICT(user_id,dedupe_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,href=EXCLUDED.href,created_at=NOW(),read_at=NULL`;
}
export async function notifyUserOnce(userId:number,input:NotificationInput){
  if(!Number.isSafeInteger(userId)||userId<=0)return;
  await sql`INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key) VALUES(${userId},${input.kind.slice(0,60)},${input.title.slice(0,160)},${String(input.body??"").slice(0,500)},${String(input.href??"").slice(0,500)},${input.dedupeKey.slice(0,200)}) ON CONFLICT(user_id,dedupe_key) DO NOTHING`;
}
export async function unreadNotificationCount(userId:number){
  const rows=await sql`SELECT COUNT(*)::int count FROM user_notifications WHERE user_id=${userId} AND read_at IS NULL` as Array<{count:number|string}>;
  return Number(rows[0]?.count)||0;
}
