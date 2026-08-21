import { requireUser } from "@/lib/auth/require-user";
import { formatDuration, getDashboardData } from "@/lib/data/dashboard";

export const metadata = { title: "Souhrn | Letový zápisník" };

export default async function DashboardPage() {
  const session = await requireUser();
  const data = await getDashboardData(session.userId);
  const cards = [
    ["Celkový čas", formatDuration(data.totalMinutes), "BLOCK"],
    ["PIC", formatDuration(data.picMinutes), "velitelský čas"],
    ["ULL", formatDuration(data.ullMinutes), "evidence"],
    ["EASA", formatDuration(data.easaMinutes), "evidence"],
    ["Přistání", String(data.landings), "celkem"],
    ["Lety", String(data.flights), "záznamů"],
  ];
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">PŘEHLED</p><h1>Ahoj, {data.displayName}</h1></div></header>
      <section className="metric-grid">
        {cards.map(([label, value, detail]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
      </section>
      <section className="panel"><h2>Nová Vercel verze</h2><p className="muted">Dashboard načítá všechny základní součty jediným databázovým dotazem. Další části budou přidávány postupně bez změny stávajících dat.</p></section>
    </>
  );
}
