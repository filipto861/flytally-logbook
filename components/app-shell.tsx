import Link from "next/link";
import { logout } from "@/app/login/actions";

const links = [
  ["/dashboard", "Souhrn"],
  ["/flights", "Lety"],
  ["/flights/new", "Přidat let"],
  ["/map", "Mapa"],
  ["/database", "Databáze"],
  ["/export", "Export"],
  ["/profile", "Profil"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div><p className="eyebrow">WOODCOMP · PILOT</p><h2>Logbook</h2></div>
        <nav>{links.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}</nav>
        <form action={logout}><button className="ghost-button">Odhlásit se</button></form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
