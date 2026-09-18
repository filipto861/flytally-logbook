"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";

const id=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};
const text=(value:unknown)=>String(value??"").trim();
export type AircraftPhotoState={ok:boolean;message:string};

function refreshAircraft(){revalidatePath("/database");revalidatePath("/flights/new")}

export async function saveAircraftPhoto(_:AircraftPhotoState,form:FormData):Promise<AircraftPhotoState>{
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();
  const aircraftId=id(form.get("aircraft_id")),mime=text(form.get("photo_mime_type")),base64=text(form.get("photo_base64"));
  if(!aircraftId||mime!=="image/jpeg"||!base64)return{ok:false,message:"Choose a photo first."};
  if(base64.length>620000||!/^[A-Za-z0-9+/=]+$/.test(base64))return{ok:false,message:"The processed cover photo is too large or invalid."};
  const owned=await sql`SELECT 1 ok FROM aircraft WHERE id=${aircraftId} AND user_id=${userId} LIMIT 1` as Array<{ok:number}>;
  if(!owned[0])return{ok:false,message:"Aircraft not found."};
  await sql`INSERT INTO aircraft_photos(aircraft_id,user_id,mime_type,image_base64,updated_at) VALUES(${aircraftId},${userId},${mime},${base64},NOW()) ON CONFLICT(aircraft_id) DO UPDATE SET user_id=EXCLUDED.user_id,mime_type=EXCLUDED.mime_type,image_base64=EXCLUDED.image_base64,updated_at=NOW()`;
  refreshAircraft();
  return{ok:true,message:"Aircraft photo saved."};
}

export async function removeAircraftPhoto(form:FormData){
  const{userId}=await requireUser();await ensureV300AircraftSharingSchema();const aircraftId=id(form.get("aircraft_id"));if(!aircraftId)return;
  await sql`DELETE FROM aircraft_photos WHERE aircraft_id=${aircraftId} AND user_id=${userId}`;
  refreshAircraft();
}
