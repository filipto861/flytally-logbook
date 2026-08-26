"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { hashPassword,passwordNeedsRehash,verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { isLoginLimited,loginContext,recordAuthEvent,recordLoginAttempt } from "@/lib/auth/security";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  await ensureDatabaseOptimizations();
  const context=await loginContext(email);
  if(await isLoginLimited(context.emailHash,context.ipHash))return{error:"Sign-in is temporarily unavailable. Please wait 15 minutes and try again."};

  const rows = await sql`
    SELECT u.id, u.role, c.password_hash
    FROM users u
    JOIN user_credentials c ON c.user_id = u.id
    WHERE u.active = 1 AND LOWER(BTRIM(u.email)) = ${email}
    LIMIT 1
  ` as Array<{ id: number | string; role: string; password_hash: string }>;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    // Deliberately use one generic message to avoid account enumeration.
    await recordLoginAttempt(context.emailHash,context.ipHash,false);
    return { error: "Invalid email or password." };
  }

  const userId = Number(user.id);
  const upgraded=passwordNeedsRehash(user.password_hash)?await hashPassword(password):null;
  if(upgraded)await sql`UPDATE user_credentials SET password_hash=${upgraded},last_login_at=NOW(),updated_at=NOW() WHERE user_id=${userId}`;
  else await sql`UPDATE user_credentials SET last_login_at=NOW() WHERE user_id=${userId}`;
  await recordLoginAttempt(context.emailHash,context.ipHash,true);
  await createSession(userId, user.role === "admin" ? "admin" : "user");
  await recordAuthEvent(userId,"password_login");
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
