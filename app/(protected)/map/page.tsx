import Link from "next/link";
import { TracksMap } from "@/components/tracks-map";
import { requireUser } from "@/lib/auth/require-user";
import { getOverviewTracks } from "@/lib/data/tracks";

const scopes = { rychla: 32, stredni: 100, vse: 500 } as const;

export default async function MapPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { userId } = await requireUser(); const selected = String((await searchParams).scope ?? "rychla");
  const limit = scopes[selected as keyof typeof scopes] ?? scopes.rychla;
  const data = await getOverviewTracks(userId, limit);
  return <><header className="page-header"><div><p className="eyebrow">GPS TRACKY</p><h1>Mapa letů</h1><p className="muted">Vykresleno {data.tracks.length} z {data.total} tracků · {data.totalDistanceKm.toFixed(0)} km celkem</p></div><div className="scope-links"><Link href="/map?scope=rychla">Rychlá</Link><Link href="/map?scope=stredni">Střední</Link><Link href="/map?scope=vse">Vše</Link></div></header>
    {data.tracks.length ? <section className="map-panel"><TracksMap tracks={data.tracks} /></section> : <section className="panel"><p>Nejsou dostupné žádné připravené GPS náhledy.</p></section>}</>;
}
