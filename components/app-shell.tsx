import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";

export function AppShell({ children,role,unreadNotifications=0 }: { children: React.ReactNode;role:"admin"|"user";unreadNotifications?:number }) {
  return (
    <div className="app-grid">
      <Sidebar role={role} unreadNotifications={unreadNotifications}/>
      <main className="content">{children}</main>
      <PwaClient/>
    </div>
  );
}
