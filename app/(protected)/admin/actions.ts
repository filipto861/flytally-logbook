"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";

async function admin(){const session=await requireUser();if(session.role!=="admin")throw new Error("Přístup odepřen.");return session}
export async function toggleUser(form:FormData){const session=await admin(),id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0||id===session.userId)return;await sql`UPDATE users SET active=CASE WHEN active=1 THEN 0 ELSE 1 END,updated_at=NOW() WHERE id=${id}`;revalidatePath("/admin")}
export async function changeRole(form:FormData){const session=await admin(),id=Number(form.get("id")),role=String(form.get("role"))==="admin"?"admin":"user";if(!Number.isSafeInteger(id)||id<=0||id===session.userId)return;await sql`UPDATE users SET role=${role},updated_at=NOW() WHERE id=${id}`;revalidatePath("/admin")}
