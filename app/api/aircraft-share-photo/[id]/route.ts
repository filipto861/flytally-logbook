import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";

const id=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();const shareId=id((await params).id);if(!shareId)return new Response(null,{status:404});
  const rows=await sql`SELECT photo_mime_type,photo_base64 FROM aircraft_profile_shares WHERE id=${shareId} AND include_photo=TRUE AND photo_base64<>'' AND (recipient_user_id=${userId} OR source_user_id=${userId}) LIMIT 1` as Array<{photo_mime_type:string;photo_base64:string}>;
  const row=rows[0];if(!row)return new Response(null,{status:404});
  return new Response(new Uint8Array(Buffer.from(row.photo_base64,"base64")),{headers:{"Content-Type":row.photo_mime_type||"image/jpeg","Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
}
