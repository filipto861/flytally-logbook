"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
export async function markNotificationRead(form:FormData){const{userId}=await requireUser();const id=Number(form.get("id"));if(id>0)await sql`UPDATE user_notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=${id} AND user_id=${userId}`;revalidatePath("/notifications")}
export async function markAllNotificationsRead(){const{userId}=await requireUser();await sql`UPDATE user_notifications SET read_at=NOW() WHERE user_id=${userId} AND read_at IS NULL`;revalidatePath("/notifications")}
