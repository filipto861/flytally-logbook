import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPilotInsightsData } from "@/lib/data/pilot-insights";
import { getProfessionalExperienceForUser } from "@/lib/professional-experience-service";
import { ProfessionalPilotWorkspace } from "@/components/professional-pilot-workspace";
import { formatInsightDuration,paceComparison,sharePercent } from "@/lib/pilot-insights";
import { PilotInsightsChart } from "@/components/pilot-insights-chart";
import { directionalRouteHref,routePairHref } from "@/lib/route-filter";

export const metadata={title:"Statistics | FlyTally"};
const periods=[["all","All time"],["year","This year"],["12m","Last 12 months"],["previous","Previous year"]] as const;
const sections=[["overview","Overview"],["experience","Experience"],["aircraft","Aircraft"],["places","Airports & routes"],["career","Career"]] as const;
const categories=[["","All"],["AEROPLANE","Aeroplane"],["ULL","ULL"],["SAILPLANE","Sailplane"],["HELICOPTER","Helicopter"],["BALLOON","Balloon"]] as const;
const categoryLabels:Record<string,string>={AEROPLANE:"Aeroplane",ULL:"ULL",SAILPLANE:"Sailplane",HELICOPTER:"Helicopter",BALLOON:"Balloon",OTHER:"Other"};
const sectionKeys=new Set<string>(sections.map(([key])=>key)),categoryKeys=new Set<string>(categories.map(([key])=>key));
const statisticsHref=(period:string,section:string,category:string)=>{const query=new URLSearchParams({period,section});if(category)query.set("category",category);return `/statistics?${query.toString()}`};
const scopedFlightHref=(href:string,category:string)=>category?`${href}${href.includes("?")?"&":"?"}category=${encodeURIComponent(category)}`:href;
const roleLabel=(value:string)=>value==="INSTRUKTOR"?"INSTRUCTOR":value||"Unspecified";

export default async function StatisticsPage({searchParams}:{searchParams:Promise<{period?:string;section?:string;category?:string}>}){
  const session=await requireUser(),params=await searchParams,requestedPeriod=params.period??"all",period=periods.some(([key])=>key===requestedPeriod)?requestedPeriod:"all",section=sectionKeys.has(params.section??"")?params.section??"overview":"overview",requestedCategory=String(params.category??"").toUpperCase(),category=categoryKeys.has(requestedCategory)?requestedCategory:"";
  const[data,professional]=await Promise.all([getPilotInsightsData(session.userId,period,category,section),section==="career"?getProfessionalExperienceForUser(session.userId,category):Promise.resolve(null)]),s=data.summary,loggedMinutes=s.minutes,pace=paceComparison(data.current12m.minutes,data.previous12m.minutes),picShare=sharePercent(s.picMinutes,loggedMinutes),nightShare=sharePercent(s.nightMinutes,loggedMinutes),ifrShare=sharePercent(s.ifrMinutes,loggedMinutes),scopeLabel=category?categoryLabels[category]||category:"All categories";
  const paceLabel=pace.direction==="new"?"New activity vs prior 12m":pace.direction==="none"?"No rolling-year activity":pace.direction==="flat"?"Stable vs prior 12m":`${pace.percent&&pace.percent>0?"+":""}${pace.percent}% vs prior 12m`;
  return <div className="ui-page-stack">
    <header className="page-header"><div><p className="eyebrow">STATISTICS</p><h1>Your flying over time</h1><p className="muted page-lead">Category-aware trends and breakdowns from your logbook. Sailplane and balloon totals use AIR flight time; powered categories use BLOCK time. No regulatory status is inferred here.</p></div><Link className="secondary-link" href="/dashboard">Back to dashboard</Link></header>
    <nav className="period-control" aria-label="Statistics category">{categories.map(([key,label])=><Link key={key||"ALL"} className={category===key?"active":""} href={statisticsHref(period,section,key)}>{label}</Link>)}</nav>
    {section!=="career"?<div className="period-control" aria-label="Statistics period">{periods.map(([key,label])=><Link key={key} className={period===key?"active":""} href={statisticsHref(key,section,category)}>{label}</Link>)}</div>:null}
    <div className="period-control" aria-label="Statistics section">{sections.map(([key,label])=><Link key={key} className={section===key?"active":""} href={statisticsHref(period,key,category)}>{label}</Link>)}</div>

    {section==="overview"?<>
      <div className="flight-results-heading"><div><p className="eyebrow">CURRENT SCOPE</p><h2>{scopeLabel}</h2></div><p>{data.rangeLabel}</p></div>
      <section className="metric-grid">
        <article className="metric"><span>Logged time</span><strong>{formatInsightDuration(loggedMinutes)}</strong><small>{s.flights} logged flights in {data.rangeLabel.toLowerCase()}</small></article>
        <article className="metric"><span>PIC</span><strong>{formatInsightDuration(s.picMinutes)}</strong><small>{picShare}% of logged time</small></article>
        <article className="metric"><span>Landings</span><strong>{s.dayLandings+s.nightLandings}</strong><small>{s.dayLandings} day · {s.nightLandings} night</small></article>
        <article className="metric"><span>Night</span><strong>{formatInsightDuration(s.nightMinutes)}</strong><small>{nightShare}% of logged time</small></article>
        <article className="metric"><span>IFR</span><strong>{formatInsightDuration(s.ifrMinutes)}</strong><small>{ifrShare}% of logged time</small></article>
        <article className="metric"><span>Aircraft / airports</span><strong>{s.uniqueAircraft} / {s.uniqueAirports}</strong><small>{s.uniqueRoutes} directional routes</small></article>
      </section>

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">ROLLING 12 MONTHS</p><h2>Flying pace</h2><p className="muted">Current rolling 12 months compared with the preceding 12 months for the selected category scope.</p></div></div>
        <div className="mini-metrics"><div><span>Time</span><b>{formatInsightDuration(data.current12m.minutes)}</b><small>{paceLabel}</small></div><div><span>Flights</span><b>{data.current12m.flights}</b><small>Previous {data.previous12m.flights}</small></div><div><span>PIC</span><b>{formatInsightDuration(data.current12m.picMinutes)}</b><small>{sharePercent(data.current12m.picMinutes,data.current12m.minutes)}% of rolling time</small></div><div><span>Active months</span><b>{data.current12m.activeMonths} / 12</b><small>Previous {data.previous12m.activeMonths} / 12</small></div></div>
      </section>

      <PilotInsightsChart data={data.monthly}/>
    </>:null}

    {section==="career"?<section className="panel">
      <div className="section-heading"><div><p className="eyebrow">LONG-TERM OVERVIEW</p><h2>Career snapshot</h2><p className="muted">All-time history within {scopeLabel.toLowerCase()}. Period filters do not apply to Career.</p></div></div>
      <div className="mini-metrics"><div><span>First recorded flight</span><b>{data.career.firstDate||"—"}</b></div><div><span>Latest recorded flight</span><b>{data.career.lastDate||"—"}</b></div><div><span>Active years</span><b>{data.career.activeYears}</b></div><div><span>Career logged time</span><b>{formatInsightDuration(data.career.minutes)}</b></div><div><span>Career flights</span><b>{data.career.flights}</b></div><div><span>Busiest year</span><b>{data.career.busiestYear||"—"}</b><small>{data.career.busiestYear?`${formatInsightDuration(data.career.busiestYearMinutes)} · ${data.career.busiestYearFlights} flights`:"No data"}</small></div></div>
    </section>:null}
    {section==="career"&&professional?.visible?<ProfessionalPilotWorkspace data={professional}/>:null}

    {section==="experience"?<>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">EXPERIENCE COMPOSITION</p><h2>Role and operating time</h2><p className="muted">Breakdown uses recorded flight roles. Safety Pilot, passenger and observer records stay outside logged-time composition.</p></div></div>
        <div className="mini-metrics"><div><span>PIC</span><b>{formatInsightDuration(s.picMinutes)}</b></div><div><span>Co-pilot</span><b>{formatInsightDuration(s.copilotMinutes)}</b></div><div><span>DUAL</span><b>{formatInsightDuration(s.dualMinutes)}</b></div><div><span>Instructor</span><b>{formatInsightDuration(s.instructorMinutes)}</b></div><div><span>Night</span><b>{formatInsightDuration(s.nightMinutes)}</b></div><div><span>IFR</span><b>{formatInsightDuration(s.ifrMinutes)}</b></div><div><span>Safety pilot</span><b>{formatInsightDuration(s.safetyMinutes)}</b><small>Informational only</small></div></div>
      </section>
      <section className="panel"><div className="section-heading"><div><h2>Regulatory category experience</h2><p className="muted">Uses the stored regulatory snapshot when present and the conservative legacy resolver otherwise.</p></div></div><StatTable empty={!data.categories.length} headings={["Category","Flights","Logged time","PIC","PIC share","Last flown"]}>{data.categories.map(row=><tr key={row.category}><td><strong>{categoryLabels[row.category]||row.category}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{formatInsightDuration(row.picMinutes)}</td><td>{sharePercent(row.picMinutes,row.minutes)}%</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><h2>Flight role distribution</h2></div></div><StatTable empty={!data.roles.length} headings={["Role","Flights","Logged time","Share"]}>{data.roles.map(row=><tr key={row.role}><td><strong>{roleLabel(row.role)}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{sharePercent(row.minutes,loggedMinutes)}%</td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><h2>Aircraft class experience</h2></div></div><StatTable empty={!data.aircraftClasses.length} headings={["Aircraft class","Flights","Logged time","PIC","PIC share","Last flown"]}>{data.aircraftClasses.map(row=><tr key={row.aircraftClass}><td><strong>{row.aircraftClass}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{formatInsightDuration(row.picMinutes)}</td><td>{sharePercent(row.picMinutes,row.minutes)}%</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
    </>:null}

    {section==="aircraft"?<>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">AIRCRAFT EXPERIENCE</p><h2>Types</h2><p className="muted">Aircraft type is taken from the flight snapshot stored in the logbook.</p></div></div><StatTable empty={!data.aircraftTypes.length} headings={["Aircraft type","Registrations","Flights","Logged time","PIC","Last flown"]}>{data.aircraftTypes.map(row=><tr key={row.aircraftType}><td><strong>{row.aircraftType}</strong></td><td>{row.registrations}</td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{formatInsightDuration(row.picMinutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><h2>Registrations</h2></div></div><StatTable empty={!data.registrations.length} headings={["Registration","Flights","Logged time","Share","Cost","Last flown"]}>{data.registrations.map(row=><tr key={row.registration}><td><strong>{row.registration}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{sharePercent(row.minutes,loggedMinutes)}%</td><td>{Math.round(row.cost).toLocaleString("en-GB")} CZK</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
    </>:null}

    {section==="places"?<>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">AIRPORT ANALYTICS</p><h2>{s.uniqueAirports} visited airports</h2><p className="muted">Local flights count a single airport visit while preserving both departure and arrival activity.</p></div></div><StatTable empty={!data.airports.length} headings={["Airport","Visits","Departures","Arrivals","First visit","Last visit",""]}>{data.airports.map(row=><tr key={row.airport}><td><strong>{row.airport}</strong></td><td>{row.visits}</td><td>{row.departures}</td><td>{row.arrivals}</td><td>{row.firstDate||"—"}</td><td>{row.lastDate||"—"}</td><td><Link className="row-link" href={scopedFlightHref(`/flights?airport=${encodeURIComponent(row.airport)}`,category)}>Flights</Link></td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">ROUTE ANALYTICS</p><h2>{s.uniqueRoutes} directional routes</h2><p className="muted">A → B and B → A remain separate so directional experience is not hidden.</p></div></div><StatTable empty={!data.routes.length} headings={["Route","Flights","Logged time","First flown","Last flown",""]}>{data.routes.map(row=><tr key={row.route}><td><strong>{row.departure} → {row.arrival}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{row.firstDate||"—"}</td><td>{row.lastDate||"—"}</td><td><span className="dashboard-route-actions"><Link className="row-link" href={scopedFlightHref(directionalRouteHref(row.departure,row.arrival),category)}>Flights</Link><Link className="row-link secondary" href={scopedFlightHref(routePairHref(row.departure,row.arrival),category)}>Both directions</Link></span></td></tr>)}</StatTable></section>
    </>:null}
  </div>;
}

function StatTable({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">No data for this period.</p>;
  return <div className="table-scroll"><table className="numeric-table"><thead><tr>{headings.map((value,index)=><th key={`${value}-${index}`}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
