import Link from "next/link";
import { MonthlyChart } from "@/components/monthly-chart";
import { DashboardDetails } from "@/components/dashboard-details";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { dashboardLayoutFromPreferences,type DashboardWidgetId } from "@/lib/dashboard-widgets";

export const metadata={title:"Dashboard | FlyTally"};
const periods=[['all','All time'],['year','This year'],['12m','Last 12 months'],['previous','Previous year']] as const;
function CategoryCard({title,data,accent,widgetId}:{title:string;data:{minutes:number;landings:number;flights:number};accent?:boolean;widgetId:DashboardWidgetId}){return <article data-dashboard-widget={widgetId} className={`metric category-card${accent?' accent-card':''}`}><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} flights</small><small>{data.landings} landings</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string}>}){
  const session=await requireUser(),selected=(await searchParams).period??"all";
  const[data,settings]=await Promise.all([
    getDashboardData(session.userId,selected),
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const layout=dashboardLayoutFromPreferences(parsePilotPreferences(settings[0]?.preferences_json)),enabled=new Set(layout.filter(item=>item.enabled).map(item=>item.id));
  const show=(id:DashboardWidgetId)=>enabled.has(id);
  return <>
    <header className="page-header"><div><p className="eyebrow">LOGBOOK OVERVIEW</p><h1>Flight overview</h1><p className="muted page-lead">{data.displayName} · flying time, activity and costs.</p></div><Link className="primary-link" href="/flights/new">＋ Add flight</Link></header>
    <div className="period-control">{periods.map(([key,label])=><Link key={key} className={selected===key||(!periods.some(([p])=>p===selected)&&key==='all')?'active':''} href={`/dashboard?period=${key}`}>{label}</Link>)}</div>
    <section className="dashboard-primary" data-dashboard-group="primary">
      {show("total-time")?<article data-dashboard-widget="total-time" className="hero-metric"><span>Total time</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} flights · {data.total.landings} landings</p>{data.safetyMinutes>0?<small className="dashboard-total-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time · dashboard only</small>:null}</article>:null}
      {show("ull-time")?<CategoryCard title="ULL" data={data.ull} widgetId="ull-time"/>:null}{show("easa-time")?<CategoryCard title="EASA" data={data.easa} widgetId="easa-time"/>:null}
      {show("pic-ull")?<CategoryCard title="PIC ULL" data={data.picUll} accent widgetId="pic-ull"/>:null}{show("pic-easa")?<CategoryCard title="PIC EASA" data={data.picEasa} accent widgetId="pic-easa"/>:null}
    </section>
    <section className="quickline" data-dashboard-group="quick">
      {show("last-flight")?<Link data-dashboard-widget="last-flight" href={data.lastFlight?`/flights/${data.lastFlight.id}`:'/flights'}><span>Last flight</span><strong>{data.lastFlight?`${data.lastFlight.date} · ${data.lastFlight.registration}`:'—'}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:'No record'}</small></Link>:null}
      {show("cost")?<div data-dashboard-widget="cost" className="quickline-cost"><span>Cost</span><strong>{Math.round(data.cost).toLocaleString("en-GB")} CZK</strong></div>:null}
      {show("aircraft")?<div data-dashboard-widget="aircraft"><span>Aircraft</span><strong>{data.uniqueAircraft}</strong></div>:null}
      {show("airports")?<div data-dashboard-widget="airports"><span>Airports</span><strong>{data.uniqueAirports}</strong></div>:null}
      {show("gps-tracks")?<Link data-dashboard-widget="gps-tracks" href="/map"><span>GPS tracks</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} tracks</small></Link>:null}
    </section>
    {show("monthly-activity")?<div data-dashboard-widget="monthly-activity"><MonthlyChart data={data.monthly} totalFlights={data.total.flights} invalidDates={data.invalidDateFlights}/></div>:null}
    {show("statistics")?<div data-dashboard-widget="statistics"><DashboardDetails data={data}/></div>:null}
  </>;
}
