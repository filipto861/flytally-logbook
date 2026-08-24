import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { PwaClient } from "@/components/pwa-client";

export function AppShell({ children,role,userId }: { children: React.ReactNode;role:"admin"|"user";userId:number }) {
  return (
    <div className="app-grid">
      <Sidebar role={role} />
      <main className="content">{children}</main>
      <Suspense fallback={null}><PwaClient userId={userId}/></Suspense>
    </div>
  );
}
