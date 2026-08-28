"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { declineSharedFlight } from "@/app/(protected)/flights/shared-actions";

const id=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const refresh=()=>{revalidatePath("/notifications");revalidatePath("/connections")};

export async function markNotificationRead(form:FormData){const{userId}=await requireUser();const notification=id(form.get("id"));if(notification)await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=${notification} AND user_id=${userId}`;refresh()}
export async function markAllNotificationsRead(){const{userId}=await requireUser();await sql`UPDATE user_notifications SET read_at=NOW() WHERE user_id=${userId} AND read_at IS NULL`;refresh()}
export async function deleteNotification(form:FormData){const{userId}=await requireUser();const notification=id(form.get("id"));if(notification)await sql`DELETE FROM user_notifications WHERE id=${notification} AND user_id=${userId}`;refresh()}
export async function clearReadNotifications(){const{userId}=await requireUser();await sql`DELETE FROM user_notifications WHERE user_id=${userId} AND read_at IS NOT NULL`;refresh()}

export async function declineFlightInvitationFromNotification(form:FormData){
  const{userId}=await requireUser(),notification=id(form.get("id"));if(!notification)return;
  const notifications=await sql`SELECT href FROM user_notifications WHERE id=${notification} AND user_id=${userId} AND kind IN ('flight_request','flight_invite') LIMIT 1` as Array<{href:string}>;
  const match=String(notifications[0]?.href??"").match(/^\/connections\/shared\/(\d+)$/),participation=id(match?.[1]);if(!participation)return;
  await declineSharedFlight(participation);
  await sql`DELETE FROM user_notifications WHERE id=${notification} AND user_id=${userId}`;
  refresh();
}
