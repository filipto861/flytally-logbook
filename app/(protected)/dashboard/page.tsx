import Link from "next/link";
import { MonthlyChart } from "@/components/monthly-chart";
import { DashboardDetails } from "@/components/dashboard-details";
import { DashboardEditor } from "@/components/dashboard-editor";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { dashboardLayoutFromPreferences,type DashboardWidgetId } from "@/lib/dashboard-widgets";

export const metadata={title:"Dashboard | FlyTally"};
const periods=[['all','All time'],['year','This year'],['12m','Last 12 months'],['previous','Previous year']] as const;
function CategoryCard({title,data,accent}:{title:string;data:{minutes:number;landings:number;flights:number};accent?:boolean}){return <article className={`metric category-card${accent?' accent-card':''}`}><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} flights</small><small>{data.landings} landings</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string}>}){
  const session=await requireUser(),selected=(await searchParams).period??"all";
  const[data,settings]=await Promise.all([
    getDashboardData(session.userId,selected),
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const layout=dashboardLayoutFromPreferences(parsePilotPreferences(settings[0]?.preferences_json));
  const renderWidget=(id:DashboardWidgetId)=>{
    if(id==="total-time")return <article className="hero-metric"><span>Total time</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} flights · {data.total.landings} landings</p>{data.safetyMinutes>0?<small className="dashboard-total-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time · dashboard only</small>:null}</article>;
    if(id==="ull-time")return <CategoryCard title="ULL" data={data.ull}/>;
    if(id==="easa-time")return <CategoryCard title="EASA" data={data.easa}/>;
    if(id==="pic-ull")return <CategoryCard title="PIC ULL" data={data.picUll} accent/>;
    if(id==="pic-easa")return <CategoryCard title="PIC EASA" data={data.picEasa} accent/>;
    if(id==="last-flight")return <Link className="panel dashboard-quick-card" href={data.lastFlight?`/flights/${data.lastFlight.id}`:'/flights'}><span>Last flight</span><strong>{data.lastFlight?`${data.lastFlight.date} · ${data.lastFlight.registration}`:'—'}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:'No record'}</small></Link>;
    if(id==="airports")return <Link className="panel dashboard-quick-card" href="/database"><span>Airports</span><strong>{data.uniqueAirports}</strong><small>visited in this period</small></Link>;
    if(id==="gps-tracks")return <Link className="panel dashboard-quick-card" href="/map"><span>GPS tracks</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} tracks</small></Link>;
    if(id==="aircraft-costs")return <section className="panel dashboard-aircraft-costs"><div className="section-heading"><div><p className="eyebrow">FLEET & COSTS</p><h2>Aircraft & costs</h2></div><Link className="secondary-link" href="/database">Manage aircraft</Link></div><div className="dashboard-aircraft-cost-summary"><div><span>Aircraft flown</span><strong>{data.uniqueAircraft}</strong></div><div><span>Cost in period</span><strong>{Math.round(data.cost).toLocaleString("en-GB")} CZK</strong></div><div><span>Average / flight</span><strong>{data.total.flights?`${Math.round(data.cost/data.total.flights).toLocaleString("en-GB")} CZK`:"—"}</strong></div></div>{data.topAircraft.length?<div className="dashboard-fleet-mini">{data.topAircraft.slice(0,3).map(row=><div key={row.registration}><strong>{row.registration}</strong><span>{row.flights} flights · {formatDuration(row.minutes)}</span><b>{Math.round(row.cost).toLocaleString("en-GB")} CZK</b></div>)}</div>:null}</section>;
    if(id==="monthly-activity")return <MonthlyChart data={data.monthly} totalFlights={data.total.flights} invalidDates={data.invalidDateFlights}/>;
    return <DashboardDetails data={data}/>;
  };
  return <>
    <header className="page-header"><div><p className="eyebrow">LOGBOOK OVERVIEW</p><h1>Flight overview</h1><p className="muted page-lead">{data.displayName} · flying time, activity and costs.</p></div><Link className="primary-link" href="/flights/new">＋ Add flight</Link></header>
    <div className="period-control">{periods.map(([key,label])=><Link key={key} className={selected===key||(!periods.some(([p])=>p===selected)&&key==='all')?'active':''} href={`/dashboard?period=${key}`}>{label}</Link>)}</div>
    <section className="dashboard-layout-grid" aria-label="Dashboard widgets">
      {layout.filter(item=>item.enabled).map(item=><div key={item.id} data-dashboard-widget={item.id} data-dashboard-size={item.size} className={`dashboard-widget dashboard-size-${item.size}`}>{renderWidget(item.id)}</div>)}
    </section>
    <DashboardEditor layout={layout}/>
  </>;
}
