import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session=await requireUser();
  return <AppShell role={session.role}>{children}</AppShell>;
}
