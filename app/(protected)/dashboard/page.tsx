import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardEditor } from "@/components/dashboard-editor";
import { DashboardEditorial } from "@/components/dashboard-editorial";
import type { DashboardLicenceSummary,DashboardQualificationSummary,DashboardDocumentSummary } from "@/lib/dashboard-credential-overview";
import { getDashboardPassengerFlights } from "@/lib/data/dashboard-passenger-recency";
import { activePassengerClasses,passengerRecencyOverview } from "@/lib/dashboard-passenger-overview";
import { buildDashboardPace } from "@/lib/dashboard-pace";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardOverviewData } from "@/lib/data/dashboard";
import { getDashboardPaceData } from "@/lib/data/dashboard-pace";
import { sql } from "@/lib/db";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { dashboardLayoutFromPreferences,dashboardOverviewLayout,defaultDashboardOverviewLayout,type DashboardWidgetId } from "@/lib/dashboard-widgets";
import { parseRecencySnapshot } from "@/lib/recency-service";
import { getIntelligentLogbookAttention } from "@/lib/intelligent-logbook-service";
import { getPendingActionCount } from "@/lib/pending-actions";
import { formatDateOnly } from "@/lib/display-format";

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
const isLegacyPeriod=(value:string)=>periods.some(([key])=>key===value);
function CategoryCard({title,data}:{title:string;data:{minutes:number;landings:number;flights:number}}){return <article className="metric category-card"><span>{title}</span><strong>{formatDuration(data.minutes)}</strong><div><small>{data.flights} flights</small><small>{data.landings} landings</small></div></article>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<{period?:string;detail?:string;view?:string}>}){
  const params=await searchParams,requestedPeriod=params.period??"all",legacyPeriod=isLegacyPeriod(requestedPeriod)?requestedPeriod:"all",detail=params.detail??"";
  if(isLegacyDetail(detail)){
    const target=legacyDashboardDetails[detail];
    if(target.section==="flights")redirect("/flights");
    redirect(`/statistics?period=${encodeURIComponent(legacyPeriod)}&section=${target.section}`);
  }
  if(!detail&&params.period&&isLegacyPeriod(requestedPeriod))redirect(`/statistics?period=${encodeURIComponent(legacyPeriod)}&section=overview`);

  // Editorial is the default. Keep the Classic route explicitly addressable only as a safe rollback,
  // without exposing a view switch or mutating any saved dashboard_widgets preferences.
  const classic=params.view==="classic";
  const session=await requireUser(),asOf=new Date();
  // Credential records are a bounded, user-scoped read for V11 only. Classic does not query them.
  const licenceRowsPromise:Promise<Array<Record<string,unknown>>>=classic?Promise.resolve([]):sql`SELECT id,licence_type,validity_mode,valid_until::text AS valid_until,recency_until::text AS recency_until FROM pilot_licences WHERE user_id=${session.userId} AND active=TRUE ORDER BY licence_type,id`;
  const qualificationRowsPromise:Promise<Array<Record<string,unknown>>>=classic?Promise.resolve([]):sql`SELECT q.id,q.qualification_type,q.validity_mode,q.valid_until::text AS valid_until,q.recency_until::text AS recency_until,l.licence_type,q.qualification_family,q.regulatory_category,q.qualification_scope,q.privilege_role,q.classification_source
    FROM pilot_qualifications q JOIN pilot_licences l ON l.id=q.licence_id AND l.user_id=q.user_id
    WHERE q.user_id=${session.userId} AND q.active=TRUE AND l.active=TRUE AND COALESCE(q.record_kind,'')<>'aircraft_training'
    ORDER BY q.qualification_type,q.id`;
  const documentRowsPromise:Promise<Array<Record<string,unknown>>>=classic?Promise.resolve([]):sql`SELECT id,category,label,expiry_date::text AS expiry_date FROM user_expiries
    WHERE user_id=${session.userId} AND active=1 AND UPPER(TRIM(category))<>'LICENCE'
    ORDER BY expiry_date,label,id`;
  const[data,settings,attentionItems,actionCount,paceSource,licenceRows,qualificationRows,documentRows]=await Promise.all([
    getDashboardOverviewData(session.userId,"all"),
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${session.userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
    getIntelligentLogbookAttention(session.userId),
    getPendingActionCount(session.userId),
    !classic?getDashboardPaceData(session.userId,asOf):Promise.resolve(null),
    licenceRowsPromise,
    qualificationRowsPromise,
    documentRowsPromise,
  ]);
  const preferences=parsePilotPreferences(settings[0]?.preferences_json),savedLayout=dashboardLayoutFromPreferences(preferences),hasSavedLayout=Array.isArray(preferences.dashboard_widgets)&&preferences.dashboard_widgets.length>0,layout=hasSavedLayout?dashboardOverviewLayout(savedLayout):defaultDashboardOverviewLayout(),recencySnapshot=parseRecencySnapshot(preferences.recency_snapshot);
  // Default path is the bounded Editorial read. Missing pace evidence fails closed as Unavailable;
  // never silently switch to Classic or synthesize zero activity from missing data.
  if(!classic){
    const licences:DashboardLicenceSummary[]=licenceRows.map(row=>({
      id:Number(row.id),licenceType:String(row.licence_type??"").trim(),validityMode:String(row.validity_mode??"").trim().toLowerCase(),
      validUntil:String(row.valid_until??"").slice(0,10),recencyUntil:String(row.recency_until??"").slice(0,10),
    }));
    const qualifications:DashboardQualificationSummary[]=qualificationRows.map(row=>({
      id:Number(row.id),qualificationType:String(row.qualification_type??"").trim(),licenceType:String(row.licence_type??"").trim(),
      validityMode:String(row.validity_mode??"").trim().toLowerCase(),
      validUntil:String(row.valid_until??"").slice(0,10),recencyUntil:String(row.recency_until??"").slice(0,10),
    }));
    // The Records editor saves Medical in user_expiries as category "Document" with a Medical label.
    // Keep the source set intact and partition once by category/label for the four Dashboard groups.
    const documents:DashboardDocumentSummary[]=documentRows.map(row=>({
      id:Number(row.id),category:String(row.category??"").trim(),
      label:String(row.label??"").trim(),expiryDate:String(row.expiry_date??"").slice(0,10),
    }));
    const passengerClasses=activePassengerClasses(licences,qualificationRows);
    const passengerFlights=passengerClasses.length?await getDashboardPassengerFlights(session.userId,asOf.toISOString().slice(0,10)):[];
    const passengerRecency=passengerRecencyOverview({flights:passengerFlights,classes:passengerClasses,qualifications:qualificationRows,asOf:asOf.toISOString().slice(0,10)});
    const pace=buildDashboardPace(paceSource?.months??null,asOf,paceSource?.invalidWindowDates);
    return <div className="ui-page-stack"><DashboardEditorial data={data} recencySnapshot={recencySnapshot} attentionCount={attentionItems.length} actionCount={actionCount} pace={pace} licences={licences} qualifications={qualifications} documents={documents} passengerRecency={passengerRecency} asOf={asOf.toISOString().slice(0,10)}/></div>;
  }
  const renderWidget=(id:DashboardWidgetId)=>{
    if(id==="total-time")return <article className="hero-metric"><span>Flying time</span><strong>{formatDuration(data.total.minutes)}</strong><p>{data.total.flights} flights · {data.total.landings} landings</p>{data.safetyMinutes>0?<small className="dashboard-total-note">Includes {formatDuration(data.safetyMinutes)} safety pilot time · dashboard only</small>:null}</article>;
    if(id==="ull-time")return <CategoryCard title="ULL" data={data.ull}/>;
    if(id==="easa-time")return <CategoryCard title="EASA" data={data.easa}/>;
    if(id==="last-flight")return <Link className="panel dashboard-quick-card" href={data.lastFlight?`/flights/${data.lastFlight.id}`:"/flights"}><span>Last flight</span><strong>{data.lastFlight?`${formatDateOnly(data.lastFlight.date)} · ${data.lastFlight.registration}`:"—"}</strong><small>{data.lastFlight?`${data.lastFlight.departure} → ${data.lastFlight.arrival}`:"No flight recorded yet"}</small></Link>;
    if(id==="gps-tracks")return <Link className="panel dashboard-quick-card" href="/map"><span>GPS tracks</span><strong>{data.gpsKm.toFixed(0)} km</strong><small>{data.tracks} tracks · open map</small></Link>;
    return null;
  };
  const visibleLayout=layout.filter(item=>item.enabled);
  return <div className="ui-page-stack">
    <header className="page-header"><div><p className="eyebrow">DASHBOARD</p><h1>At a glance</h1><p className="muted page-lead">{data.displayName} · Your all-time flying totals. Historical periods, trends and detailed breakdowns are in Statistics.</p></div><div className="d1v11-legacy-actions"><Link className="primary-link" href="/flights/new">＋ Add flight</Link></div></header>
    <div className="dashboard-home-layout">
      <div className="dashboard-main-column">
        <section className="dashboard-layout-grid" aria-label="Dashboard overview">
          {visibleLayout.map(item=><div key={item.id} data-dashboard-widget={item.id} data-dashboard-size={item.size} className={`dashboard-widget dashboard-size-${item.size}`}>{renderWidget(item.id)}</div>)}
        </section>

        {recencySnapshot?<Link href="/credentials" className={`dashboard-recency-status dashboard-recency-${recencySnapshot.status}`}><span>Recency</span><strong>{recencySnapshot.label}</strong>{recencySnapshot.nextDate?<small>Next date {formatDateOnly(recencySnapshot.nextDate)}</small>:<small>Open details</small>}</Link>:null}
      </div>
      <section className="panel dashboard-quick-actions-panel">
        <div className="section-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Where next?</h2><p className="muted">Everyday actions stay here. Historical analysis stays in Statistics.</p></div></div>
        <div className="mini-metrics">
          <div><span>Logbook</span><b><Link className="row-link" href="/flights/new">Add flight →</Link></b><small>Record a new flight</small></div>
          {actionCount>0?<div><span>Pending</span><b><Link className="row-link" href="/actions">Actions →</Link></b><small>{actionCount} {actionCount===1?"decision is":"decisions are"} waiting for you</small></div>:null}
          {attentionItems.length?<div><span>Data quality</span><b><Link className="row-link" href="/flights/needs-attention">Needs attention →</Link></b><small>{attentionItems.length} {attentionItems.length===1?"flight requires":"flights require"} review</small></div>:null}
          <div><span>Analysis</span><b><Link className="row-link" href="/statistics?period=all&section=overview">Statistics →</Link></b><small>Periods, trends, experience, aircraft and routes</small></div>
          <div><span>Records</span><b><Link className="row-link" href="/data">Print & data →</Link></b><small>Print, export and backup tools</small></div>
        </div>
      </section>
    </div>

    <DashboardEditor layout={layout}/>
  </div>;
}
