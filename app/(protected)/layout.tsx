import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { ensureV1353Schema } from "@/lib/v1353-schema";
import { unreadNotificationCount } from "@/lib/notifications";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { appearanceFromPreferences } from "@/lib/ui-preferences";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  await ensureV132Schema();
  await ensureV1353Schema();
  const[unreadNotifications,settings]=await Promise.all([
    unreadNotificationCount(session.userId),
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const appearance=appearanceFromPreferences(parsePilotPreferences(settings[0]?.preferences_json));
  return <AppShell role={session.role} unreadNotifications={unreadNotifications} appearance={appearance}>{children}</AppShell>;
}
