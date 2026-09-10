import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createTrainingIdentityAssertion } from "@/lib/auth/training-identity";

function localPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function trainingOrigin(): URL {
  const configured = process.env.TRAINING_APP_URL?.trim();
  if (!configured) throw new Error("TRAINING_APP_URL is not configured.");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("TRAINING_APP_URL must use HTTPS in production.");
  return url;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  let targetBase: URL;
  try { targetBase = trainingOrigin(); } catch {
    return NextResponse.json({ error: "training_identity_not_configured" }, { status: 503 });
  }

  const assertion = createTrainingIdentityAssertion(String(session.userId), session.role);
  const target = new URL("/api/auth/flytally/callback", targetBase);
  target.searchParams.set("assertion", assertion);
  target.searchParams.set("next", localPath(new URL(request.url).searchParams.get("next")));
  return NextResponse.redirect(target);
}
