import { Sidebar } from "@/components/sidebar";

export function AppShell({ children,role }: { children: React.ReactNode;role:"admin"|"user" }) {
  return (
    <div className="app-grid">
      <Sidebar role={role} />
      <main className="content">{children}</main>
    </div>
  );
}
