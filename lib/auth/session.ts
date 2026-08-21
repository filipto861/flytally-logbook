import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "logbook_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type Session = { userId: number; role: "admin" | "user"; exp: number };

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): Session | null {
  try {
    const [payload, signature] = value.split(".", 2);
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!Number.isSafeInteger(parsed.userId) || parsed.userId <= 0) return null;
    if (parsed.role !== "admin" && parsed.role !== "user") return null;
    if (!Number.isSafeInteger(parsed.exp) || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSession(userId: number, role: "admin" | "user") {
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ userId, role, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? decode(value) : null;
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}
