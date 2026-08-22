import { sql } from "@/lib/db";
import { createStoredBackup } from "@/lib/backup-center";

export const dynamic="force-dynamic";
export const maxDuration=300;

export async function GET(request:Request){
  const configured=process.env.CRON_SECRET?.trim(),authorization=request.headers.get("authorization")||"",vercelCron=(request.headers.get("user-agent")||"").toLowerCase().startsWith("vercel-cron/");
  if(configured?authorization!==`Bearer ${configured}`:!vercelCron)return Response.json({error:"Unauthorized"},{status:401});
  const users=await sql`SELECT id FROM users WHERE active=1 ORDER BY id LIMIT 500` as Array<{id:number|string}>;let created=0,failed=0;
  for(const user of users)try{if(await createStoredBackup(Number(user.id),"automatic"))created++}catch(error){failed++;console.error("scheduled-user-backup-failed",{userId:Number(user.id),error})}
  return Response.json({ok:failed===0,users:users.length,created,failed,completedAt:new Date().toISOString()},{status:failed?207:200});
}
