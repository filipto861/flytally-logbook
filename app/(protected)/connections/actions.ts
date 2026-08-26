"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";

const email=(value:unknown)=>String(value??"").trim().toLowerCase().slice(0,254);
const id=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const relationships=new Set(["pilot","requester_instructor","recipient_instructor"]);

export type PilotSearchState={
  error?:string;
  result?:{id:number;email:string;name:string;homeAirport:string;connected:boolean};
};

export async function searchPilot(_:PilotSearchState,form:FormData):Promise<PilotSearchState>{
  const session=await requireUser(),query=email(form.get("email"));
  if(!query.includes("@"))return{error:"Enter the pilot's complete email address."};
  const rows=await sql`SELECT u.id,u.display_name,COALESCE(s.home_airport,'') home_airport,
    EXISTS(SELECT 1 FROM pilot_connections c WHERE LEAST(c.requester_user_id,c.recipient_user_id)=LEAST(${session.userId},u.id) AND GREATEST(c.requester_user_id,c.recipient_user_id)=GREATEST(${session.userId},u.id)) connected
    FROM users u LEFT JOIN user_settings s ON s.user_id=u.id
    WHERE u.active=1 AND u.id<>${session.userId} AND LOWER(BTRIM(u.email))=${query} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0];
  if(!row)return{error:"No active FlyTally pilot was found with that exact email."};
  return{result:{id:Number(row.id),email:query,name:String(row.display_name||"Pilot"),homeAirport:String(row.home_airport||""),connected:Boolean(row.connected)}};
}

export type ConnectionRequestState={error?:string;sent?:boolean};
export async function requestConnection(_:ConnectionRequestState,form:FormData):Promise<ConnectionRequestState>{
  const session=await requireUser(),target=id(form.get("target_user_id")),targetEmail=email(form.get("target_email")),relationship=String(form.get("relationship")??"");
  if(!target||target===session.userId||!targetEmail.includes("@")||!relationships.has(relationship))return{error:"This connection request is not valid."};
  const rows=await sql`INSERT INTO pilot_connections(requester_user_id,recipient_user_id,relationship,status,requester_label,recipient_label)
    SELECT ${session.userId},u.id,${relationship},'pending',${relationship==="requester_instructor"?"instructor":"pilot"},${relationship==="recipient_instructor"?"instructor":"pilot"} FROM users u
    WHERE u.id=${target} AND u.active=1 AND u.id<>${session.userId} AND LOWER(BTRIM(u.email))=${targetEmail}
    ON CONFLICT DO NOTHING RETURNING id` as Array<{id:number|string}>;
  if(!rows[0])return{error:"A connection or pending request already exists with this pilot."};
  await notifyUser(target,{kind:"connection_request",title:"New connection request",body:"A pilot wants to connect with you.",href:"/connections",dedupeKey:`connection:${rows[0].id}`});
  revalidatePath("/connections");
  return{sent:true};
}

export async function acceptConnection(form:FormData){
  const session=await requireUser(),connection=id(form.get("connection_id"));if(!connection)return;
  const rows=await sql`UPDATE pilot_connections SET status='accepted',accepted_at=NOW(),updated_at=NOW() WHERE id=${connection} AND recipient_user_id=${session.userId} AND status='pending' RETURNING requester_user_id` as Array<{requester_user_id:number|string}>;
  if(rows[0])await notifyUser(Number(rows[0].requester_user_id),{kind:"connection_accepted",title:"Connection accepted",body:"Your connection request was accepted.",href:"/connections",dedupeKey:`connection-accepted:${connection}`});
  revalidatePath("/connections");
}

export async function declineConnection(form:FormData){
  const session=await requireUser(),connection=id(form.get("connection_id"));if(!connection)return;
  await sql`UPDATE pilot_connections SET status='declined',updated_at=NOW() WHERE id=${connection} AND recipient_user_id=${session.userId} AND status='pending'`;
  revalidatePath("/connections");
}

export async function cancelConnection(form:FormData){
  const session=await requireUser(),connection=id(form.get("connection_id"));if(!connection)return;
  await sql`UPDATE pilot_connections SET status='cancelled',revoked_at=NOW(),updated_at=NOW() WHERE id=${connection} AND requester_user_id=${session.userId} AND status='pending'`;
  revalidatePath("/connections");
}

export async function removeConnection(form:FormData){
  const session=await requireUser(),connection=id(form.get("connection_id"));if(!connection)return;
  await sql`UPDATE pilot_connections SET status='cancelled',revoked_at=NOW(),updated_at=NOW() WHERE id=${connection} AND status='accepted' AND (requester_user_id=${session.userId} OR recipient_user_id=${session.userId})`;
  revalidatePath("/connections");
}

export async function updateConnection(form:FormData){
  const session=await requireUser(),connection=id(form.get("connection_id")),label=String(form.get("relationship_label")??"pilot").trim().toLowerCase();if(!connection||!["pilot","instructor","student","examiner"].includes(label))return;
  const share=form.get("share_logbook")==="yes";
  await sql`UPDATE pilot_connections SET
    requester_label=CASE WHEN requester_user_id=${session.userId} THEN ${label} ELSE requester_label END,
    recipient_label=CASE WHEN recipient_user_id=${session.userId} THEN ${label} ELSE recipient_label END,
    requester_shares_logbook=CASE WHEN requester_user_id=${session.userId} THEN ${share} ELSE requester_shares_logbook END,
    recipient_shares_logbook=CASE WHEN recipient_user_id=${session.userId} THEN ${share} ELSE recipient_shares_logbook END,
    updated_at=NOW() WHERE id=${connection} AND status='accepted' AND (requester_user_id=${session.userId} OR recipient_user_id=${session.userId})`;
  await sql`INSERT INTO connection_audit_log(actor_user_id,subject_user_id,entity_type,entity_id,event_type,details) SELECT ${session.userId},CASE WHEN requester_user_id=${session.userId} THEN recipient_user_id ELSE requester_user_id END,'connection',id,'permissions_updated',${JSON.stringify({label,shareLogbook:share})}::jsonb FROM pilot_connections WHERE id=${connection}`;
  revalidatePath("/connections");
}
