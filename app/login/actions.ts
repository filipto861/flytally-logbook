"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { verifyLegacyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Vyplňte e-mail a heslo." };

  const rows = await sql`
    SELECT u.id, u.role, c.password_hash
    FROM users u
    JOIN user_credentials c ON c.user_id = u.id
    WHERE u.active = 1 AND LOWER(BTRIM(u.email)) = ${email}
    LIMIT 1
  ` as Array<{ id: number | string; role: string; password_hash: string }>;
  const user = rows[0];
  if (!user || !(await verifyLegacyPassword(password, user.password_hash))) {
    // Deliberately use one generic message to avoid account enumeration.
    return { error: "Neplatný e-mail nebo heslo." };
  }

  const userId = Number(user.id);
  await sql`UPDATE user_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ${userId}`;
  await createSession(userId, user.role === "admin" ? "admin" : "user");
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
