import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";

const id=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();const aircraftId=id((await params).id);if(!aircraftId)return new Response(null,{status:404});
  const rows=await sql`SELECT p.mime_type,p.image_base64,p.updated_at FROM aircraft_photos p JOIN aircraft a ON a.id=p.aircraft_id WHERE p.aircraft_id=${aircraftId} AND p.user_id=${userId} AND a.user_id=${userId} LIMIT 1` as Array<{mime_type:string;image_base64:string;updated_at:string}>;
  const row=rows[0];if(!row)return new Response(null,{status:404});
  return new Response(new Uint8Array(Buffer.from(row.image_base64,"base64")),{headers:{"Content-Type":row.mime_type||"image/jpeg","Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
}
