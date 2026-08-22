import { getSession } from "@/lib/auth/session";
import { loadStoredBackup } from "@/lib/backup-center";

export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return new Response("Unauthorized",{status:401});const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<=0)return new Response("Invalid backup",{status:400});
  try{const {json,backup}=await loadStoredBackup(session.userId,id),stamp=String(backup.exported_at||new Date().toISOString()).slice(0,10);return new Response(json,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename=flytally-stored-backup-${stamp}-${id}.json`,"cache-control":"private, no-store"}})}catch(error){return new Response(error instanceof Error?error.message:"Backup not found",{status:404})}
}
