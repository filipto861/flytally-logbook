import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { FLIGHTS_PAGE_SIZE, getFlightsPage } from "@/lib/data/flights";

export const metadata = { title: "Lety | Letový zápisník" };

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireUser();
  const requested = Number((await searchParams).page ?? "1");
  const result = await getFlightsPage(session.userId, Number.isFinite(requested) ? requested : 1);
  const pages = Math.max(1, Math.ceil(result.total / FLIGHTS_PAGE_SIZE));
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>Lety</h1><p className="muted">{result.total} záznamů</p></div><Link className="primary-link" href="/flights/new">Přidat let</Link></header>
      <section className="table-panel">
        <div className="table-scroll"><table><thead><tr><th>Datum</th><th>Letadlo</th><th>Trasa</th><th>BLOCK</th><th>Funkce</th><th>Přistání</th></tr></thead><tbody>
          {result.rows.map((flight) => <tr key={flight.id}><td>{flight.date}</td><td><strong>{flight.registration || "—"}</strong><small>{flight.aircraft_type || flight.evidence || ""}</small></td><td>{flight.departure || "—"} → {flight.arrival || "—"}</td><td>{flight.off_block || "—"}–{flight.on_block || "—"}</td><td>{flight.role || "—"}</td><td>{flight.starts}</td></tr>)}
        </tbody></table></div>
        <div className="pagination"><Link aria-disabled={result.page <= 1} href={`/flights?page=${Math.max(1, result.page - 1)}`}>Předchozí</Link><span>{result.page} / {pages}</span><Link aria-disabled={result.page >= pages} href={`/flights?page=${Math.min(pages, result.page + 1)}`}>Další</Link></div>
      </section>
    </>
  );
}
