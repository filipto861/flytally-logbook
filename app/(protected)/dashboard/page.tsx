import Link from "next/link";
import { MonthlyChart } from "@/components/monthly-chart";
import { DashboardDetails } from "@/components/dashboard-details";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";

export const metadata={title:"Dashboard | FlyTally"};
const periods=[['all','All time'],['year','This year'],['12m','Last 12 months'],['previous','Previous year']] as const;
function CategoryCard({title,data,accent}:{title:string;data:{minutes:number;landings:number;flights:number};accent?:boolean}){return <article className={`metric category-card${accent?' accent-card':''}`}><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} flights</small><small>{data.landings} landings</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string}>}){
  const session=await requireUser(); const selected=(await searchParams).period??"all"; const data=await getDashboardData(session.userId,selected);
  return <>
    <header className="page-header"><div><p className="eyebrow">LOGBOOK OVERVIEW</p><h1>Flight overview</h1><p className="muted page-lead">{data.displayName} · flying time, activity and costs.</p></div><Link className="primary-link" href="/flights/new">＋ Add flight</Link></header>
    <div className="period-control">{periods.map(([key,label])=><Link key={key} className={selected===key||(!periods.some(([p])=>p===selected)&&key==='all')?'active':''} href={`/dashboard?period=${key}`}>{label}</Link>)}</div>
    <section className="dashboard-primary">
      <article className="hero-metric"><span>Total time</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} flights · {data.total.landings} landings</p>{data.safetyMinutes>0?<small className="dashboard-total-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time · dashboard only</small>:null}</article>
      <CategoryCard title="ULL" data={data.ull}/><CategoryCard title="EASA" data={data.easa}/>
      <CategoryCard title="PIC ULL" data={data.picUll} accent/><CategoryCard title="PIC EASA" data={data.picEasa} accent/>
    </section>
    <section className="quickline">
      <Link href={data.lastFlight?`/flights/${data.lastFlight.id}`:'/flights'}><span>Last flight</span><strong>{data.lastFlight?`${data.lastFlight.date} · ${data.lastFlight.registration}`:'—'}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:'No record'}</small></Link>
      <div className="quickline-cost"><span>Cost</span><strong>{Math.round(data.cost).toLocaleString("en-GB")} CZK</strong></div>
      <div><span>Aircraft</span><strong>{data.uniqueAircraft}</strong></div>
      <div><span>Airports</span><strong>{data.uniqueAirports}</strong></div>
      <Link href="/map"><span>GPS tracks</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} tracks</small></Link>
    </section>
    <MonthlyChart data={data.monthly} totalFlights={data.total.flights} invalidDates={data.invalidDateFlights}/>
    <DashboardDetails data={data}/>
  </>;
}
