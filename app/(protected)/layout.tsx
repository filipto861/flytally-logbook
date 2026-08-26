import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { unreadNotificationCount } from "@/lib/notifications";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  const unreadNotifications=await unreadNotificationCount(session.userId);
  return <AppShell role={session.role} unreadNotifications={unreadNotifications}>{children}</AppShell>;
}
