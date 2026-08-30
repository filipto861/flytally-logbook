import type { Viewport } from "next";
import { cache } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { unreadNotificationCount } from "@/lib/notifications";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { appearanceFromPreferences } from "@/lib/ui-preferences";

const getShellContext=cache(async()=>{
  const session=await requireUser();
  const settings=await sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Array<Record<string,unknown>>;
  const appearance=appearanceFromPreferences(parsePilotPreferences(settings[0]?.preferences_json));
  return{session,appearance};
});

export async function generateViewport():Promise<Viewport>{
  const{appearance}=await getShellContext();
  return{
    width:"device-width",
    initialScale:1,
    viewportFit:"cover",
    colorScheme:appearance==="system"?"light dark":appearance,
    themeColor:appearance==="system"?[
      {media:"(prefers-color-scheme: dark)",color:"#071018"},
      {media:"(prefers-color-scheme: light)",color:"#f4f7fb"},
    ]:appearance==="light"?"#f4f7fb":"#071018",
  };
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const{session,appearance}=await getShellContext();
  await ensureRuntimeSchema();
  const unreadNotifications=await unreadNotificationCount(session.userId);
  return <AppShell role={session.role} unreadNotifications={unreadNotifications} appearance={appearance}>{children}</AppShell>;
}
