import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-grid">
      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
