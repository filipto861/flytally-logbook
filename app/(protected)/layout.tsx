import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  return <AppShell role={session.role}>{children}</AppShell>;
}
