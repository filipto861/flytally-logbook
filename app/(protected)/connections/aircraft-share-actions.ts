"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { ensureV300AircraftSharingSchema } from "@/lib/v300-aircraft-sharing-schema";
import { parseAircraftShareSnapshot,type AircraftShareRate,type AircraftShareSnapshot } from "@/lib/aircraft-sharing";

const id=(value:unknown)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};
const text=(value:unknown)=>String(value??"").trim();
const yes=(form:FormData,key:string)=>form.get(key)==="yes";
const iso=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const today=()=>new Date().toISOString().slice(0,10);
export type ShareAircraftState={ok:boolean;message:string};

function refreshSharing(){
  revalidatePath("/database");revalidatePath("/connections");revalidatePath("/notifications");revalidatePath("/flights/new");
}

export async function shareAircraftProfile(_:ShareAircraftState,form:FormData):Promise<ShareAircraftState>{
  const session=await requireUser();await ensureV300AircraftSharingSchema();
  const sourceAircraftId=id(form.get("aircraft_id")),recipientUserId=id(form.get("recipient_user_id"));
  if(!sourceAircraftId||!recipientUserId||recipientUserId===session.userId)return{ok:false,message:"Choose a connected pilot."};
  const connection=await sql`SELECT u.display_name FROM users u WHERE u.id=${recipientUserId} AND u.active=1 AND EXISTS(
    SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=${session.userId} AND c.recipient_user_id=u.id) OR (c.recipient_user_id=${session.userId} AND c.requester_user_id=u.id))
  ) LIMIT 1` as Array<{display_name:string}>;
  if(!connection[0])return{ok:false,message:"Aircraft profiles can only be sent to accepted Connections."};

  const rows=await sql`SELECT a.id,a.registration,a.aircraft_type,a.aircraft_make,a.aircraft_model,a.aircraft_variant,a.icao_type,a.aircraft_class,a.regulatory_category,a.balloon_class,a.balloon_group,a.evidence,a.default_role,a.billing_basis,a.note,a.part_fcl_credit_class,a.part_fcl_credit_basis,a.part_fcl_credit_from,a.default_price_per_hour,
    p.mime_type photo_mime_type,p.image_base64 photo_base64
    FROM aircraft a LEFT JOIN aircraft_photos p ON p.aircraft_id=a.id AND p.user_id=a.user_id
    WHERE a.id=${sourceAircraftId} AND a.user_id=${session.userId} LIMIT 1` as Array<Record<string,unknown>>;
  const aircraft=rows[0];if(!aircraft)return{ok:false,message:"Aircraft not found."};

  const includeDefaults=yes(form,"include_defaults"),includeCurrentRate=yes(form,"include_current_rate"),includeRateHistory=yes(form,"include_rate_history"),includeNotes=yes(form,"include_notes"),includePhoto=yes(form,"include_photo")&&Boolean(aircraft.photo_base64);
  const profile={
    registration:text(aircraft.registration).toUpperCase(),aircraftType:text(aircraft.aircraft_type),aircraftMake:text(aircraft.aircraft_make),aircraftModel:text(aircraft.aircraft_model),aircraftVariant:text(aircraft.aircraft_variant),icaoType:text(aircraft.icao_type).toUpperCase(),aircraftClass:text(aircraft.aircraft_class).toUpperCase(),regulatoryCategory:text(aircraft.regulatory_category).toUpperCase(),balloonClass:text(aircraft.balloon_class).toUpperCase(),balloonGroup:text(aircraft.balloon_group).toUpperCase(),evidence:text(aircraft.evidence).toUpperCase(),partFclCreditClass:text(aircraft.part_fcl_credit_class).toUpperCase(),partFclCreditBasis:text(aircraft.part_fcl_credit_basis),partFclCreditFrom:text(aircraft.part_fcl_credit_from).slice(0,10)
  };
  const snapshot:AircraftShareSnapshot={profile};
  if(includeDefaults)snapshot.defaults={defaultRole:text(aircraft.default_role)||"PIC",billingBasis:text(aircraft.billing_basis)||"BLOCK"};

  const rates=(includeCurrentRate||includeRateHistory)?await sql`SELECT aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source FROM rates WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${profile.registration} ORDER BY valid_from DESC NULLS LAST,id DESC LIMIT 250` as Array<Record<string,unknown>>:[];
  const mapped=rates.map(row=>({aircraftType:text(row.aircraft_type),validFrom:text(row.valid_from).slice(0,10),pricePerHour:Number(row.price_per_hour)||0,dryPricePerHour:row.dry_price_per_hour===null||row.dry_price_per_hour===undefined?null:Number(row.dry_price_per_hour)||0,source:text(row.source)} satisfies AircraftShareRate)).filter(rate=>rate.pricePerHour>0&&iso(rate.validFrom));
  if(includeCurrentRate){
    const current=mapped.find(rate=>rate.validFrom<=today());
    const fallback=Number(aircraft.default_price_per_hour)||0;
    if(current)snapshot.currentRate=current;
    else if(fallback>0)snapshot.currentRate={aircraftType:profile.aircraftType,validFrom:today(),pricePerHour:fallback,dryPricePerHour:null,source:"Shared current aircraft rate"};
  }
  if(includeRateHistory&&mapped.length)snapshot.rateHistory=mapped;
  if(includeNotes)snapshot.note=text(aircraft.note).slice(0,5000);

  const sender=await sql`SELECT display_name FROM users WHERE id=${session.userId} LIMIT 1` as Array<{display_name:string}>;
  const result=await sql`INSERT INTO aircraft_profile_shares(source_user_id,recipient_user_id,source_aircraft_id,status,snapshot_data,include_photo,include_defaults,include_current_rate,include_rate_history,include_notes,photo_mime_type,photo_base64,created_at)
    VALUES(${session.userId},${recipientUserId},${sourceAircraftId},'pending',${JSON.stringify(snapshot)}::jsonb,${includePhoto},${includeDefaults},${includeCurrentRate},${includeRateHistory},${includeNotes},${includePhoto?text(aircraft.photo_mime_type):""},${includePhoto?text(aircraft.photo_base64):""},NOW())
    ON CONFLICT(source_aircraft_id,recipient_user_id) WHERE status='pending' DO UPDATE SET snapshot_data=EXCLUDED.snapshot_data,include_photo=EXCLUDED.include_photo,include_defaults=EXCLUDED.include_defaults,include_current_rate=EXCLUDED.include_current_rate,include_rate_history=EXCLUDED.include_rate_history,include_notes=EXCLUDED.include_notes,photo_mime_type=EXCLUDED.photo_mime_type,photo_base64=EXCLUDED.photo_base64,created_at=NOW()
    RETURNING id` as Array<{id:number|string}>;
  const shareId=Number(result[0]?.id);if(!shareId)return{ok:false,message:"Aircraft profile could not be shared."};
  await notifyUser(recipientUserId,{kind:"aircraft_share",title:`Aircraft profile · ${profile.registration}`,body:`${text(sender[0]?.display_name)||"A connected pilot"} shared an aircraft profile with you. Review what you want to add to your logbook.`,href:`/connections/aircraft/${shareId}`,dedupeKey:`aircraft-share:${shareId}`});
  refreshSharing();
  return{ok:true,message:`Aircraft profile sent to ${text(connection[0].display_name)||"your connection"}.`};
}

export async function acceptAircraftProfileShare(shareId:number,form:FormData){
  const session=await requireUser();await ensureV300AircraftSharingSchema();if(!Number.isSafeInteger(shareId)||shareId<=0)redirect("/connections");
  const rows=await sql`SELECT s.*,u.display_name source_name,EXISTS(
    SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=s.source_user_id AND c.recipient_user_id=s.recipient_user_id) OR (c.recipient_user_id=s.source_user_id AND c.requester_user_id=s.recipient_user_id))
  ) connected FROM aircraft_profile_shares s JOIN users u ON u.id=s.source_user_id WHERE s.id=${shareId} AND s.recipient_user_id=${session.userId} AND s.status='pending' LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];if(!row||!row.connected)redirect(`/connections/aircraft/${shareId}?error=unavailable`);
  const snapshot=parseAircraftShareSnapshot(row.snapshot_data),p=snapshot.profile,reg=p.registration;if(!reg)redirect(`/connections/aircraft/${shareId}?error=invalid`);
  const existing=await sql`SELECT id FROM aircraft WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${reg} LIMIT 1` as Array<{id:number|string}>;
  const exists=Boolean(existing[0]),importProfile=!exists||yes(form,"import_profile"),importDefaults=Boolean(row.include_defaults)&&Boolean(snapshot.defaults)&&yes(form,"import_defaults"),importCurrent=Boolean(row.include_current_rate)&&Boolean(snapshot.currentRate)&&yes(form,"import_current_rate"),importHistory=Boolean(row.include_rate_history)&&Boolean(snapshot.rateHistory?.length)&&yes(form,"import_rate_history"),importNotes=Boolean(row.include_notes)&&snapshot.note!==undefined&&yes(form,"import_notes"),importPhoto=Boolean(row.include_photo)&&Boolean(row.photo_base64)&&yes(form,"import_photo");

  const queries=[
    sql`INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,icao_type,aircraft_class,regulatory_category,balloon_class,balloon_group,evidence,default_price_per_hour,default_role,billing_basis,active,part_fcl_credit_class,part_fcl_credit_basis,part_fcl_credit_from,note,created_at,updated_at)
      VALUES(${session.userId},${reg},${p.aircraftType},${p.aircraftMake},${p.aircraftModel},${p.aircraftVariant},${p.icaoType},${p.aircraftClass},${p.regulatoryCategory},${p.balloonClass},${p.balloonGroup},${p.evidence},0,'PIC','BLOCK',1,${p.partFclCreditClass},${p.partFclCreditBasis},${p.partFclCreditFrom},'',NOW(),NOW())
      ON CONFLICT(user_id,registration) DO NOTHING`,
  ];
  if(importProfile)queries.push(sql`UPDATE aircraft SET aircraft_type=${p.aircraftType},aircraft_make=${p.aircraftMake},aircraft_model=${p.aircraftModel},aircraft_variant=${p.aircraftVariant},icao_type=${p.icaoType},aircraft_class=${p.aircraftClass},regulatory_category=${p.regulatoryCategory},balloon_class=${p.balloonClass},balloon_group=${p.balloonGroup},evidence=${p.evidence},part_fcl_credit_class=${p.partFclCreditClass},part_fcl_credit_basis=${p.partFclCreditBasis},part_fcl_credit_from=${p.partFclCreditFrom},active=1,updated_at=NOW() WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${reg}`);
  if(importDefaults&&snapshot.defaults)queries.push(sql`UPDATE aircraft SET default_role=${snapshot.defaults.defaultRole||"PIC"},billing_basis=${snapshot.defaults.billingBasis||"BLOCK"},updated_at=NOW() WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${reg}`);
  if(importNotes)queries.push(sql`UPDATE aircraft SET note=${snapshot.note||""},updated_at=NOW() WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${reg}`);
  if(importPhoto)queries.push(sql`INSERT INTO aircraft_photos(aircraft_id,user_id,mime_type,image_base64,updated_at) SELECT a.id,${session.userId},${text(row.photo_mime_type)||"image/jpeg"},${text(row.photo_base64)},NOW() FROM aircraft a WHERE a.user_id=${session.userId} AND UPPER(TRIM(a.registration))=${reg} ON CONFLICT(aircraft_id) DO UPDATE SET user_id=EXCLUDED.user_id,mime_type=EXCLUDED.mime_type,image_base64=EXCLUDED.image_base64,updated_at=NOW()`);
  const addRate=(rate:AircraftShareRate,source:string)=>{if(rate.pricePerHour<=0||!iso(rate.validFrom))return;queries.push(sql`INSERT INTO rates(user_id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source) VALUES(${session.userId},${reg},${rate.aircraftType||p.aircraftType},${rate.validFrom},${rate.pricePerHour},${rate.dryPricePerHour},${source}) ON CONFLICT(user_id,registration,valid_from) DO UPDATE SET aircraft_type=EXCLUDED.aircraft_type,price_per_hour=EXCLUDED.price_per_hour,dry_price_per_hour=EXCLUDED.dry_price_per_hour,source=EXCLUDED.source`)};
  if(importHistory)for(const rate of snapshot.rateHistory??[])addRate(rate,rate.source||"Shared rate history");
  if(importCurrent&&snapshot.currentRate)addRate(snapshot.currentRate,snapshot.currentRate.source||"Shared current rate");
  queries.push(sql`UPDATE aircraft_profile_shares SET status='accepted',responded_at=NOW(),imported_aircraft_id=(SELECT id FROM aircraft WHERE user_id=${session.userId} AND UPPER(TRIM(registration))=${reg} LIMIT 1) WHERE id=${shareId} AND recipient_user_id=${session.userId} AND status='pending'`);
  await sql.transaction(queries);
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${session.userId} AND href=${`/connections/aircraft/${shareId}`}`;
  await notifyUser(Number(row.source_user_id),{kind:"aircraft_share_accepted",title:`${reg} added to aircraft`,body:`${text(row.source_name)?"Your aircraft profile share was accepted.":"Aircraft profile share accepted."}`,href:"/database",dedupeKey:`aircraft-share-accepted:${shareId}`});
  refreshSharing();revalidatePath("/flights");revalidatePath("/dashboard");
  redirect(`/database?imported=${encodeURIComponent(reg)}`);
}

export async function declineAircraftProfileShare(shareId:number){
  const session=await requireUser();await ensureV300AircraftSharingSchema();if(!Number.isSafeInteger(shareId)||shareId<=0)redirect("/connections");
  const rows=await sql`UPDATE aircraft_profile_shares SET status='declined',responded_at=NOW() WHERE id=${shareId} AND recipient_user_id=${session.userId} AND status='pending' RETURNING source_user_id,snapshot_data` as Array<Record<string,unknown>>;
  await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${session.userId} AND href=${`/connections/aircraft/${shareId}`}`;
  if(rows[0]){const snapshot=parseAircraftShareSnapshot(rows[0].snapshot_data);await notifyUser(Number(rows[0].source_user_id),{kind:"aircraft_share_declined",title:`Aircraft share declined · ${snapshot.profile.registration}`,href:"/connections",dedupeKey:`aircraft-share-declined:${shareId}`})}
  refreshSharing();redirect("/connections");
}

export async function cancelAircraftProfileShare(form:FormData){
  const session=await requireUser();await ensureV300AircraftSharingSchema();const shareId=id(form.get("share_id"));if(!shareId)return;
  const rows=await sql`UPDATE aircraft_profile_shares SET status='cancelled',cancelled_at=NOW() WHERE id=${shareId} AND source_user_id=${session.userId} AND status='pending' RETURNING recipient_user_id` as Array<{recipient_user_id:number|string}>;
  if(rows[0])await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=${Number(rows[0].recipient_user_id)} AND href=${`/connections/aircraft/${shareId}`}`;
  refreshSharing();
}
