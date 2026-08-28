import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";
import { ThemeManager } from "@/components/theme-manager";
import type { AppearancePreference } from "@/lib/ui-preferences";

export function AppShell({ children,role,unreadNotifications=0,appearance="system" }: { children: React.ReactNode;role:"admin"|"user";unreadNotifications?:number;appearance?:AppearancePreference }) {
  return (
    <div className="app-grid">
      <ThemeManager preference={appearance}/>
      <Sidebar role={role} unreadNotifications={unreadNotifications}/>
      <main className="content">{children}</main>
      <PwaClient/>
    </div>
  );
}
