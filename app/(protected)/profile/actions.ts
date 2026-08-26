"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { hashPassword,verifyPassword } from "@/lib/auth/password";
import { revokeOtherSessions,revokeSession } from "@/lib/auth/session";
import { recordAuthEvent } from "@/lib/auth/security";
import { sql } from "@/lib/db";
import { licenceProfileMap,parsePilotPreferences,type PilotPreferences } from "@/lib/logbook-print";

const s=(f:FormData,k:string)=>String(f.get(k)??"").trim();
async function currentSettings(userId:number){const rows=await sql`SELECT timezone,currency,home_airport,default_role,preferences_json FROM user_settings WHERE user_id=${userId}` as Array<Record<string,unknown>>;const row=rows[0]??{};return{row,preferences:parsePilotPreferences(row.preferences_json)}}
const pick=(f:FormData,key:string,fallback:unknown)=>f.has(key)?s(f,key):String(fallback??"").trim();
const licenceScope=(value:string)=>["EASA","ULL","OTHER"].includes(value.toUpperCase())?value.toUpperCase():"EASA";

async function writePreferences(userId:number,row:Record<string,unknown>,preferences:PilotPreferences){
  const timezone=String(row.timezone||"Europe/Prague"),currency=String(row.currency||"CZK"),homeAirport=String(row.home_airport||"").toUpperCase(),defaultRole=String(row.default_role||"PIC");
  await sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at) VALUES(${userId},${timezone},${currency},${homeAirport},${defaultRole},${JSON.stringify(preferences)},NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`;
}
const refresh=()=>{revalidatePath("/profile");revalidatePath("/print");revalidatePath("/data");};
const validityMode=(f:FormData)=>{const mode=s(f,"validity_mode");return mode==="unlimited"||mode==="recency"?mode:"date"};

export async function saveProfile(f:FormData){const {userId}=await requireUser();const name=s(f,"display_name");if(!name)return;await sql`UPDATE users SET display_name=${name},updated_at=NOW() WHERE id=${userId}`;refresh();}

export async function saveSettings(f:FormData){
  const {userId}=await requireUser(),current=await currentSettings(userId),existing=current.preferences,row=current.row;
  const preferences=JSON.stringify({...existing,default_evidence:pick(f,"default_evidence",existing.default_evidence)||"ULL"});
  const timezone=pick(f,"timezone",row.timezone)||"Europe/Prague",currency=pick(f,"currency",row.currency)||"CZK",homeAirport=pick(f,"home_airport",row.home_airport).toUpperCase(),defaultRole=pick(f,"default_role",row.default_role)||"PIC";
  await sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at) VALUES(${userId},${timezone},${currency},${homeAirport},${defaultRole},${preferences},NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET timezone=EXCLUDED.timezone,currency=EXCLUDED.currency,home_airport=EXCLUDED.home_airport,default_role=EXCLUDED.default_role,preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`;
  refresh();
}

export async function saveAccountSettings(f:FormData){
  const {userId}=await requireUser(),current=await currentSettings(userId),existing=current.preferences,row=current.row;
  const name=s(f,"display_name");if(!name)return;
  const preferences=JSON.stringify({...existing,default_evidence:pick(f,"default_evidence",existing.default_evidence)||"ULL"});
  const timezone=pick(f,"timezone",row.timezone)||"Europe/Prague",currency=pick(f,"currency",row.currency)||"CZK",homeAirport=pick(f,"home_airport",row.home_airport).toUpperCase(),defaultRole=pick(f,"default_role",row.default_role)||"PIC";
  await sql.transaction([
    sql`UPDATE users SET display_name=${name},updated_at=NOW() WHERE id=${userId}`,
    sql`INSERT INTO user_settings(user_id,timezone,currency,home_airport,default_role,preferences_json,created_at,updated_at) VALUES(${userId},${timezone},${currency},${homeAirport},${defaultRole},${preferences},NOW(),NOW()) ON CONFLICT(user_id) DO UPDATE SET timezone=EXCLUDED.timezone,currency=EXCLUDED.currency,home_airport=EXCLUDED.home_airport,default_role=EXCLUDED.default_role,preferences_json=EXCLUDED.preferences_json,updated_at=NOW()`,
  ]);refresh();revalidatePath("/dashboard");
}

export async function addLicence(f:FormData){
  const {userId}=await requireUser(),label=s(f,"label"),date=s(f,"expiry_date"),number=s(f,"licence_number").slice(0,100),address=s(f,"holder_address").slice(0,500),scope=licenceScope(s(f,"logbook_scope"));
  if(!label||!date||!number)return;
  const inserted=await sql`INSERT INTO user_expiries(user_id,category,label,expiry_date,warning_days,note,active,created_at,updated_at) VALUES(${userId},'Licence',${label},${date},${Number(s(f,"warning_days"))||30},${s(f,"note")},1,NOW(),NOW()) RETURNING id` as Array<{id:number|string}>;
  const id=String(inserted[0]?.id??"");if(!id)return;
  const current=await currentSettings(userId),profiles={...licenceProfileMap(current.preferences),[id]:{scope,number,address}};
  await writePreferences(userId,current.row,{...current.preferences,licence_profiles:profiles});refresh();
}

export async function saveLicence(f:FormData){
  const {userId}=await requireUser(),id=Number(s(f,"id")),label=s(f,"label"),date=s(f,"expiry_date"),number=s(f,"licence_number").slice(0,100),address=s(f,"holder_address").slice(0,500),scope=licenceScope(s(f,"logbook_scope"));
  if(!id||!label||!date||!number)return;
  await sql`UPDATE user_expiries SET category='Licence',label=${label},expiry_date=${date},warning_days=${Number(s(f,"warning_days"))||30},note=${s(f,"note")},updated_at=NOW() WHERE id=${id} AND user_id=${userId}`;
  const current=await currentSettings(userId),profiles={...licenceProfileMap(current.preferences),[String(id)]:{scope,number,address}};
  await writePreferences(userId,current.row,{...current.preferences,licence_profiles:profiles});refresh();
}

export async function addExpiry(f:FormData){const {userId}=await requireUser();const label=s(f,"label"),date=s(f,"expiry_date");if(!label||!date)return;const category=s(f,"category")==="Licence"?"Document":s(f,"category")||"Document";await sql`INSERT INTO user_expiries(user_id,category,label,expiry_date,warning_days,note,active,created_at,updated_at) VALUES(${userId},${category},${label},${date},${Number(s(f,"warning_days"))||30},${s(f,"note")},1,NOW(),NOW())`;revalidatePath("/profile");}
export async function toggleExpiry(f:FormData){const {userId}=await requireUser();await sql`UPDATE user_expiries SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${Number(s(f,"id"))} AND user_id=${userId}`;refresh();}
export async function deleteExpiry(f:FormData){const {userId}=await requireUser(),id=Number(s(f,"id"));if(!id)return;const current=await currentSettings(userId),profiles={...licenceProfileMap(current.preferences)};delete profiles[String(id)];await sql`DELETE FROM user_expiries WHERE id=${id} AND user_id=${userId}`;await writePreferences(userId,current.row,{...current.preferences,licence_profiles:profiles});refresh();}
export async function addPilotLicence(f:FormData){const{userId}=await requireUser(),type=s(f,"licence_type").toUpperCase().slice(0,60),number=s(f,"licence_number").slice(0,100),mode=validityMode(f);if(!type||!number)return;await sql`INSERT INTO pilot_licences(user_id,licence_type,licence_number,authority,country,validity_mode,valid_until,recency_until) VALUES(${userId},${type},${number},${s(f,"authority").slice(0,100)},${s(f,"country").toUpperCase().slice(0,3)},${mode},${mode==="date"?s(f,"valid_until")||null:null},${mode==="recency"?s(f,"recency_until")||null:null}) ON CONFLICT(user_id,licence_type,licence_number) DO UPDATE SET authority=EXCLUDED.authority,country=EXCLUDED.country,validity_mode=EXCLUDED.validity_mode,valid_until=EXCLUDED.valid_until,recency_until=EXCLUDED.recency_until,active=TRUE,updated_at=NOW()`;refresh()}
export async function addQualification(f:FormData){const{userId}=await requireUser(),licenceId=Number(s(f,"licence_id")),type=s(f,"qualification_type").toUpperCase().slice(0,60),mode=validityMode(f);if(!licenceId||!type)return;await sql`INSERT INTO pilot_qualifications(licence_id,user_id,qualification_type,certificate_reference,validity_mode,valid_until,recency_until) SELECT id,${userId},${type},${s(f,"certificate_reference").slice(0,100)},${mode},${mode==="date"?s(f,"valid_until")||null:null},${mode==="recency"?s(f,"recency_until")||null:null} FROM pilot_licences WHERE id=${licenceId} AND user_id=${userId} ON CONFLICT(licence_id,qualification_type,certificate_reference) DO UPDATE SET validity_mode=EXCLUDED.validity_mode,valid_until=EXCLUDED.valid_until,recency_until=EXCLUDED.recency_until,active=TRUE,updated_at=NOW()`;refresh()}
export async function archivePilotCredential(f:FormData){const{userId}=await requireUser(),id=Number(s(f,"id")),kind=s(f,"kind");if(!id)return;if(kind==="licence")await sql`UPDATE pilot_licences SET active=FALSE,updated_at=NOW() WHERE id=${id} AND user_id=${userId}`;else await sql`UPDATE pilot_qualifications SET active=FALSE,updated_at=NOW() WHERE id=${id} AND user_id=${userId}`;refresh()}
export async function changePassword(f:FormData){const session=await requireUser();const current=s(f,"current_password"),next=s(f,"new_password"),confirm=s(f,"confirm_password");if(next.length<12||next.length>128||next!==confirm)return;const rows=await sql`SELECT password_hash FROM user_credentials WHERE user_id=${session.userId}` as Array<{password_hash:string}>;if(!rows[0]||!await verifyPassword(current,rows[0].password_hash))return;const hash=await hashPassword(next);await sql`UPDATE user_credentials SET password_hash=${hash},updated_at=NOW() WHERE user_id=${session.userId}`;await revokeOtherSessions(session.userId,session.sessionId);await recordAuthEvent(session.userId,"password_changed");revalidatePath("/profile");}
export async function revokeDevice(f:FormData){const session=await requireUser(),id=s(f,"session_id");if(!id||id===session.sessionId)return;await revokeSession(session.userId,id);await recordAuthEvent(session.userId,"session_revoked");revalidatePath("/profile");}
export async function logoutOtherDevices(){const session=await requireUser();await revokeOtherSessions(session.userId,session.sessionId);await recordAuthEvent(session.userId,"other_sessions_revoked");revalidatePath("/profile");}
export async function disconnectGoogle(){const session=await requireUser();const credentials=await sql`SELECT 1 FROM user_credentials WHERE user_id=${session.userId} LIMIT 1`;if(!credentials[0])return;await sql`DELETE FROM auth_identities WHERE user_id=${session.userId} AND provider='google'`;await recordAuthEvent(session.userId,"google_disconnected");revalidatePath("/profile");}
export async function deleteAccount(f:FormData){const session=await requireUser();if(s(f,"confirm")!=="DELETE MY ACCOUNT")return;const replacement=`deleted-${session.userId}@flytally.invalid`;await sql.transaction([
  sql`UPDATE pilot_connections SET status='cancelled',revoked_at=NOW(),updated_at=NOW() WHERE status IN ('pending','accepted') AND (requester_user_id=${session.userId} OR recipient_user_id=${session.userId})`,
  sql`UPDATE flight_participations SET status='cancelled',cancelled_at=NOW(),responded_at=NOW() WHERE status='pending' AND (source_user_id=${session.userId} OR participant_user_id=${session.userId})`,
  sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=NOW(),decision_note='Account deleted.' WHERE status='pending' AND (student_user_id=${session.userId} OR instructor_user_id=${session.userId})`,
  sql`UPDATE flight_verifications SET status='revoked',revoked_at=NOW(),revocation_reason='Signer account deleted.' WHERE signer_user_id=${session.userId} AND status='signed'`,
  sql`DELETE FROM user_notifications WHERE user_id=${session.userId}`,
  sql`DELETE FROM auth_identities WHERE user_id=${session.userId}`,
  sql`DELETE FROM user_credentials WHERE user_id=${session.userId}`,
  sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${session.userId}`,
  sql`UPDATE users SET active=0,email=${replacement},display_name='Deleted pilot',deleted_at=NOW(),updated_at=NOW() WHERE id=${session.userId}`,
]);redirect("/login")}
