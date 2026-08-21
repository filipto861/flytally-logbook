import Link from "next/link";
import { MonthlyChart } from "@/components/monthly-chart";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";

export const metadata={title:"Souhrn | Letový zápisník"};
const periods=[['all','Vše'],['year','Tento rok'],['12m','Posledních 12 měsíců'],['previous','Předchozí rok']] as const;
function CategoryCard({title,data,accent}:{title:string;data:{minutes:number;landings:number;flights:number};accent?:boolean}){return <article className={`metric category-card${accent?' accent-card':''}`}><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} letů</small><small>{data.landings} přistání</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string}>}){
  const session=await requireUser(); const selected=(await searchParams).period??"all"; const data=await getDashboardData(session.userId,selected);
  return <>
    <header className="page-header"><div><p className="eyebrow">PŘEHLED</p><h1>Ahoj, {data.displayName}</h1><p className="muted">Období: {data.rangeLabel} · {data.total.flights} zobrazených letů</p></div><Link className="primary-link" href="/flights/new">＋ Přidat let</Link></header>
    <div className="period-control">{periods.map(([key,label])=><Link key={key} className={selected===key||(!periods.some(([p])=>p===selected)&&key==='all')?'active':''} href={`/dashboard?period=${key}`}>{label}</Link>)}</div>
    <section className="dashboard-primary">
      <article className="hero-metric"><span>CELKOVÝ ČAS</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} letů · {data.total.landings} přistání</p></article>
      <CategoryCard title="ULL" data={data.ull}/><CategoryCard title="EASA" data={data.easa}/>
      <CategoryCard title="PIC ULL" data={data.picUll} accent/><CategoryCard title="PIC EASA" data={data.picEasa} accent/>
    </section>
    <section className="quickline">
      <Link href={data.lastFlight?`/flights/${data.lastFlight.id}`:'/flights'}><span>Poslední let</span><strong>{data.lastFlight?`${data.lastFlight.date} · ${data.lastFlight.registration}`:'—'}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:'Bez záznamu'}</small></Link>
      <div><span>Letadla</span><strong>{data.uniqueAircraft}</strong><small>unikátních registrací</small></div>
      <div><span>Letiště</span><strong>{data.uniqueAirports}</strong><small>navštívených míst</small></div>
      <Link href="/map"><span>GPS tracky</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} uložených tracků</small></Link>
    </section>
    <MonthlyChart data={data.monthly}/>
    <details className="panel details-panel"><summary>Podrobné statistiky</summary>
      <div className="detail-stats">
        <div className="mini-metrics"><div><span>Čas ve vzduchu</span><b>{formatDuration(data.airMinutes)}</b></div><div><span>PIC celkem</span><b>{formatDuration(data.picMinutes)}</b></div><div><span>DUAL</span><b>{formatDuration(data.dualMinutes)}</b></div><div><span>Safety pilot</span><b>{formatDuration(data.safetyMinutes)}</b></div><div><span>Náklady</span><b>{Math.round(data.cost).toLocaleString('cs-CZ')} Kč</b></div></div>
        <div className="stats-columns"><section><h3>Roční přehled</h3><table><thead><tr><th>Rok</th><th>Lety</th><th>Čas</th><th>Přistání</th></tr></thead><tbody>{data.yearly.map(r=><tr key={r.year}><td>{r.year}</td><td>{r.flights}</td><td>{formatDuration(r.minutes)}</td><td>{r.landings}</td></tr>)}</tbody></table></section><section><h3>Nejčastější letadla</h3><table><thead><tr><th>Registrace</th><th>Lety</th><th>Čas</th></tr></thead><tbody>{data.topAircraft.map(r=><tr key={r.registration}><td>{r.registration}</td><td>{r.flights}</td><td>{formatDuration(r.minutes)}</td></tr>)}</tbody></table></section><section><h3>Nejčastější trasy</h3><table><thead><tr><th>Trasa</th><th>Lety</th><th>Čas</th></tr></thead><tbody>{data.topRoutes.map(r=><tr key={r.route}><td>{r.route}</td><td>{r.flights}</td><td>{formatDuration(r.minutes)}</td></tr>)}</tbody></table></section></div>
      </div>
    </details>
  </>;
}
