import type { Viewport } from "next";
import { cache } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { getPendingActionCount } from "@/lib/pending-actions";
import { getIntelligentLogbookAttention } from "@/lib/intelligent-logbook-service";
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
  const[actionCount,attentionItems]=await Promise.all([getPendingActionCount(session.userId),getIntelligentLogbookAttention(session.userId)]);
  return <AppShell role={session.role} actionCount={actionCount} attentionCount={attentionItems.length} appearance={appearance}>{children}</AppShell>;
}
