import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";

export function AppShell({ children,role }: { children: React.ReactNode;role:"admin"|"user" }) {
  return (
    <div className="app-grid">
      <Sidebar role={role} />
      <main className="content">{children}</main>
      <PwaClient/>
    </div>
  );
}
