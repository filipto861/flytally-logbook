import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV132Schema } from "@/lib/v132-schema";
import { unreadNotificationCount } from "@/lib/notifications";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  await ensureV132Schema();
  const unreadNotifications=await unreadNotificationCount(session.userId);
  return <AppShell role={session.role} unreadNotifications={unreadNotifications}>{children}</AppShell>;
}
