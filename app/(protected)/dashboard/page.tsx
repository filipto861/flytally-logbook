import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardEditor } from "@/components/dashboard-editor";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { dashboardOverviewLayoutFromPreferences,type DashboardWidgetId } from "@/lib/dashboard-widgets";
import { parseRecencySnapshot } from "@/lib/recency-service";

export const metadata={title:"Dashboard | FlyTally"};
const periods=[["all","All time"],["year","This year"],["12m","Last 12 months"],["previous","Previous year"]] as const;

const legacyDashboardDetails={
  years:{label:"Yearly statistics",section:"overview"},
  aircraft:{label:"Aircraft & costs · Average cost / h",section:"aircraft"},
  airports:{label:"Visited airports",section:"places"},
  routes:{label:"Flown routes",section:"places"},
  recent:{label:"Recent flights",section:"flights"},
} as const;

type LegacyDashboardDetail=keyof typeof legacyDashboardDetails;
const isLegacyDetail=(value:string):value is LegacyDashboardDetail=>Object.prototype.hasOwnProperty.call(legacyDashboardDetails,value);
function CategoryCard({title,data}:{title:string;data:{minutes:number;landings:number;flights:number}}){return <article className="metric category-card"><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} flights</small><small>{data.landings} landings</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string;detail?:string}>}){
  const params=await searchParams,requestedPeriod=params.period??"all",selected=periods.some(([key])=>key===requestedPeriod)?requestedPeriod:"all",detail=params.detail??"";
  if(isLegacyDetail(detail)){
    const target=legacyDashboardDetails[detail];
    if(target.section==="flights")redirect("/flights");
    redirect(`/statistics?period=${encodeURIComponent(selected)}&section=${target.section}`);
  }

  const session=await requireUser();
  const[data,settings]=await Promise.all([
    getDashboardData(session.userId,selected),
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const preferences=parsePilotPreferences(settings[0]?.preferences_json),layout=dashboardOverviewLayoutFromPreferences(preferences),recencySnapshot=parseRecencySnapshot(preferences.recency_snapshot);
  const renderWidget=(id:DashboardWidgetId)=>{
    if(id==="total-time")return <article className="hero-metric"><span>Flying time</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} flights · {data.total.landings} landings</p>{data.safetyMinutes>0?<small className="dashboard-total-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time · dashboard only</small>:null}</article>;
    if(id==="ull-time")return <CategoryCard title="ULL" data={data.ull}/>;
    if(id==="easa-time")return <CategoryCard title="EASA" data={data.easa}/>;
    if(id==="last-flight")return <Link className="panel dashboard-quick-card" href={data.lastFlight?`/flights/${data.lastFlight.id}`:"/flights"}><span>Last flight</span><strong>{data.lastFlight?`${data.lastFlight.date} · ${data.lastFlight.registration}`:"—"}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:"No flight recorded yet"}</small></Link>;
    if(id==="gps-tracks")return <Link className="panel dashboard-quick-card" href="/map"><span>GPS tracks</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} tracks · open map</small></Link>;
    return null;
  };
  const visibleLayout=layout.filter(item=>item.enabled);
  return <>
    <header className="page-header"><div><p className="eyebrow">DASHBOARD</p><h1>At a glance</h1><p className="muted page-lead">{data.displayName} · your flying summary and the next places to go. Trends and detailed breakdowns live in Statistics.</p></div><Link className="primary-link" href="/flights/new">＋ Add flight</Link></header>
    <div className="period-control" aria-label="Dashboard period">{periods.map(([key,label])=><Link key={key} className={selected===key?"active":""} href={`/dashboard?period=${key}`}>{label}</Link>)}</div>
    <section className="dashboard-layout-grid" aria-label="Dashboard overview">
      {visibleLayout.map(item=><div key={item.id} data-dashboard-widget={item.id} data-dashboard-size={item.size} className={`dashboard-widget dashboard-size-${item.size}`}>{renderWidget(item.id)}</div>)}
    </section>

    {recencySnapshot?<Link href="/credentials" className={`dashboard-recency-status dashboard-recency-${recencySnapshot.status}`}><span>Recency</span><strong>{recencySnapshot.label}</strong>{recencySnapshot.nextDate?<small>Next date {recencySnapshot.nextDate}</small>:<small>Open details</small>}</Link>:null}

    <section className="panel">
      <div className="section-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Where next?</h2><p className="muted">Everyday actions stay here. Historical analysis stays in Statistics.</p></div></div>
      <div className="mini-metrics">
        <div><span>Logbook</span><b><Link className="row-link" href="/flights/new">Add flight →</Link></b><small>Record a new flight</small></div>
        <div><span>Data quality</span><b><Link className="row-link" href="/flights/needs-attention">Needs attention →</Link></b><small>Review warnings and incomplete records</small></div>
        <div><span>Analysis</span><b><Link className="row-link" href={`/statistics?period=${encodeURIComponent(selected)}&section=overview`}>Statistics →</Link></b><small>Trends, experience, aircraft and routes</small></div>
        <div><span>Records</span><b><Link className="row-link" href="/data">Print & data →</Link></b><small>Print, export and backup tools</small></div>
      </div>
    </section>

    <DashboardEditor layout={layout}/>
  </>;
}
