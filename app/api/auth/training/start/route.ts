import { NextResponse } from "next/server";

import { safeLocalReturnTo } from "@/lib/auth/return-to";
import { getSession } from "@/lib/auth/session";
import { createTrainingIdentityAssertion } from "@/lib/auth/training-identity";

function trainingOrigin(): URL {
  const configured = process.env.TRAINING_APP_URL?.trim();
  if (!configured) throw new Error("TRAINING_APP_URL is not configured.");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("TRAINING_APP_URL must use HTTPS in production.");
  return url;
}

export async function GET(request: Request) {
  const source = new URL(request.url);
  const session = await getSession();
  if (!session) {
    const login = new URL("/login", source);
    login.searchParams.set("returnTo", `${source.pathname}${source.search}`);
    const response = NextResponse.redirect(login);
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  }

  let targetBase: URL;
  try { targetBase = trainingOrigin(); } catch {
    return NextResponse.json({ error: "training_identity_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const assertion = await createTrainingIdentityAssertion(String(session.userId), session.role);
  const target = new URL("/api/auth/flytally/callback", targetBase);
  target.searchParams.set("assertion", assertion);
  target.searchParams.set("next", safeLocalReturnTo(source.searchParams.get("next"), "/"));
  const response = NextResponse.redirect(target);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
