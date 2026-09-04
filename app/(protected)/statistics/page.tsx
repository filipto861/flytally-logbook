import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPilotInsightsData } from "@/lib/data/pilot-insights";
import { formatInsightDuration,paceComparison,sharePercent } from "@/lib/pilot-insights";
import { PilotInsightsChart } from "@/components/pilot-insights-chart";
import { directionalRouteHref,routePairHref } from "@/lib/route-filter";

export const metadata={title:"Statistics & Pilot Insights | FlyTally"};
const periods=[["all","All time"],["year","This year"],["12m","Last 12 months"],["previous","Previous year"]] as const;
const sections=[["overview","Overview"],["experience","Experience"],["aircraft","Aircraft"],["places","Airports & routes"]] as const;
const sectionKeys=new Set<string>(sections.map(([key])=>key));
const periodHref=(period:string,section:string)=>`/statistics?period=${encodeURIComponent(period)}&section=${encodeURIComponent(section)}`;
const sectionHref=(period:string,section:string)=>`/statistics?period=${encodeURIComponent(period)}&section=${encodeURIComponent(section)}`;
const roleLabel=(value:string)=>value==="INSTRUKTOR"?"INSTRUCTOR":value||"Unspecified";

export default async function StatisticsPage({searchParams}:{searchParams:Promise<{period?:string;section?:string}>}){
  const session=await requireUser(),params=await searchParams,requestedPeriod=params.period??"all",period=periods.some(([key])=>key===requestedPeriod)?requestedPeriod:"all",section=sectionKeys.has(params.section??"")?params.section??"overview":"overview";
  const data=await getPilotInsightsData(session.userId,period),d=data.dashboard,loggedMinutes=Math.max(0,d.total.minutes-d.safetyMinutes),pace=paceComparison(data.current12m.minutes,data.previous12m.minutes),picShare=sharePercent(d.picMinutes,loggedMinutes),nightShare=sharePercent(d.nightMinutes,loggedMinutes),ifrShare=sharePercent(d.ifrMinutes,loggedMinutes),topAircraft=d.topAircraft[0],topType=data.aircraftTypes[0],busiestYear=d.yearly.reduce((best,row)=>!best||row.minutes>best.minutes?row:best,null as null|typeof d.yearly[number]);
  const paceLabel=pace.direction==="new"?"New activity vs prior 12m":pace.direction==="none"?"No rolling-year activity":pace.direction==="flat"?"Stable vs prior 12m":`${pace.percent&&pace.percent>0?"+":""}${pace.percent}% vs prior 12m`;
  return <>
    <header className="page-header"><div><p className="eyebrow">STATISTICS & PILOT INSIGHTS</p><h1>Pilot experience</h1><p className="muted page-lead">Long-term trends and breakdowns from your own logbook records. No regulatory status is inferred here.</p></div><Link className="secondary-link" href="/dashboard">Dashboard</Link></header>
    <div className="period-control">{periods.map(([key,label])=><Link key={key} className={period===key?"active":""} href={periodHref(key,section)}>{label}</Link>)}</div>
    <div className="period-control" aria-label="Statistics section">{sections.map(([key,label])=><Link key={key} className={section===key?"active":""} href={sectionHref(period,key)}>{label}</Link>)}</div>

    {section==="overview"?<>
      <section className="metric-grid">
        <article className="metric"><span>Logged time</span><strong>{formatInsightDuration(loggedMinutes)}</strong><small>{d.total.flights} flights in {data.rangeLabel.toLowerCase()}</small></article>
        <article className="metric"><span>PIC</span><strong>{formatInsightDuration(d.picMinutes)}</strong><small>{picShare}% of logged time</small></article>
        <article className="metric"><span>Landings</span><strong>{d.dayLandings+d.nightLandings}</strong><small>{d.dayLandings} day · {d.nightLandings} night</small></article>
        <article className="metric"><span>Night</span><strong>{formatInsightDuration(d.nightMinutes)}</strong><small>{nightShare}% of logged time</small></article>
        <article className="metric"><span>IFR</span><strong>{formatInsightDuration(d.ifrMinutes)}</strong><small>{ifrShare}% of logged time</small></article>
        <article className="metric"><span>Aircraft / airports</span><strong>{d.uniqueAircraft} / {d.uniqueAirports}</strong><small>{d.uniqueRoutes} directional routes</small></article>
      </section>

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">ROLLING 12 MONTHS</p><h2>Flying pace</h2><p className="muted">Current rolling 12 months compared with the preceding 12 months.</p></div></div>
        <div className="mini-metrics"><div><span>Time</span><b>{formatInsightDuration(data.current12m.minutes)}</b><small>{paceLabel}</small></div><div><span>Flights</span><b>{data.current12m.flights}</b><small>Previous {data.previous12m.flights}</small></div><div><span>PIC</span><b>{formatInsightDuration(data.current12m.picMinutes)}</b><small>{sharePercent(data.current12m.picMinutes,data.current12m.minutes)}% of rolling time</small></div><div><span>Active months</span><b>{data.current12m.activeMonths} / 12</b><small>Previous {data.previous12m.activeMonths} / 12</small></div></div>
      </section>

      <PilotInsightsChart data={data.monthly}/>

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">LONG-TERM OVERVIEW</p><h2>Career snapshot</h2></div></div>
        <div className="mini-metrics"><div><span>First recorded flight</span><b>{data.career.firstDate||"—"}</b></div><div><span>Latest recorded flight</span><b>{data.career.lastDate||"—"}</b></div><div><span>Active years</span><b>{data.career.activeYears}</b></div><div><span>Career logged time</span><b>{formatInsightDuration(data.career.minutes)}</b></div><div><span>Most-flown aircraft</span><b>{topAircraft?.registration||"—"}</b><small>{topAircraft?formatInsightDuration(topAircraft.minutes):"No data"}</small></div><div><span>Most-flown type</span><b>{topType?.aircraftType||"—"}</b><small>{topType?`${topType.registrations} registrations`:"No data"}</small></div><div><span>Busiest year</span><b>{busiestYear?.year||"—"}</b><small>{busiestYear?`${formatInsightDuration(busiestYear.minutes)} · ${busiestYear.flights} flights`:"No data"}</small></div></div>
      </section>
    </>:null}

    {section==="experience"?<>
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">EXPERIENCE COMPOSITION</p><h2>Role and operating time</h2><p className="muted">Breakdown uses recorded flight roles. Safety Pilot, passenger and observer records stay outside logged-time composition.</p></div></div>
        <div className="mini-metrics"><div><span>PIC</span><b>{formatInsightDuration(d.picMinutes)}</b></div><div><span>Co-pilot</span><b>{formatInsightDuration(d.copilotMinutes)}</b></div><div><span>DUAL</span><b>{formatInsightDuration(d.dualMinutes)}</b></div><div><span>Instructor</span><b>{formatInsightDuration(d.instructorMinutes)}</b></div><div><span>Night</span><b>{formatInsightDuration(d.nightMinutes)}</b></div><div><span>IFR</span><b>{formatInsightDuration(d.ifrMinutes)}</b></div><div><span>Safety pilot</span><b>{formatInsightDuration(d.safetyMinutes)}</b><small>Informational only</small></div></div>
      </section>
      <section className="panel"><div className="section-heading"><div><h2>Flight role distribution</h2></div></div><StatTable empty={!data.roles.length} headings={["Role","Flights","Block time","Share"]}>{data.roles.map(row=><tr key={row.role}><td><strong>{roleLabel(row.role)}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{sharePercent(row.minutes,loggedMinutes)}%</td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><h2>Class / category experience</h2></div></div><StatTable empty={!data.aircraftClasses.length} headings={["Class / category","Flights","Time","PIC","PIC share","Last flown"]}>{data.aircraftClasses.map(row=><tr key={row.aircraftClass}><td><strong>{row.aircraftClass}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{formatInsightDuration(row.picMinutes)}</td><td>{sharePercent(row.picMinutes,row.minutes)}%</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
    </>:null}

    {section==="aircraft"?<>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">AIRCRAFT EXPERIENCE</p><h2>Types</h2><p className="muted">Aircraft type is taken from the flight snapshot stored in the logbook.</p></div></div><StatTable empty={!data.aircraftTypes.length} headings={["Aircraft type","Registrations","Flights","Time","PIC","Last flown"]}>{data.aircraftTypes.map(row=><tr key={row.aircraftType}><td><strong>{row.aircraftType}</strong></td><td>{row.registrations}</td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{formatInsightDuration(row.picMinutes)}</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><h2>Registrations</h2></div></div><StatTable empty={!d.topAircraft.length} headings={["Registration","Flights","Time","Share","Cost","Last flown"]}>{d.topAircraft.map(row=><tr key={row.registration}><td><strong>{row.registration}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{sharePercent(row.minutes,loggedMinutes)}%</td><td>{Math.round(row.cost).toLocaleString("en-GB")} CZK</td><td>{row.lastDate||"—"}</td></tr>)}</StatTable></section>
    </>:null}

    {section==="places"?<>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">AIRPORT ANALYTICS</p><h2>{d.uniqueAirports} visited airports</h2><p className="muted">Local flights count a single airport visit while preserving both departure and arrival activity.</p></div></div><StatTable empty={!d.topAirports.length} headings={["Airport","Visits","Departures","Arrivals","First visit","Last visit",""]}>{d.topAirports.map(row=><tr key={row.airport}><td><strong>{row.airport}</strong></td><td>{row.visits}</td><td>{row.departures}</td><td>{row.arrivals}</td><td>{row.firstDate||"—"}</td><td>{row.lastDate||"—"}</td><td><Link className="row-link" href={`/flights?airport=${encodeURIComponent(row.airport)}`}>Flights</Link></td></tr>)}</StatTable></section>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">ROUTE ANALYTICS</p><h2>{d.uniqueRoutes} directional routes</h2><p className="muted">A → B and B → A remain separate so directional experience is not hidden.</p></div></div><StatTable empty={!d.topRoutes.length} headings={["Route","Flights","Time","First flown","Last flown",""]}>{d.topRoutes.map(row=><tr key={row.route}><td><strong>{row.departure} → {row.arrival}</strong></td><td>{row.flights}</td><td>{formatInsightDuration(row.minutes)}</td><td>{row.firstDate||"—"}</td><td>{row.lastDate||"—"}</td><td><span className="dashboard-route-actions"><Link className="row-link" href={directionalRouteHref(row.departure,row.arrival)}>Flights</Link><Link className="row-link secondary" href={routePairHref(row.departure,row.arrival)}>Both directions</Link></span></td></tr>)}</StatTable></section>
    </>:null}
  </>;
}

function StatTable({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">No data for this period.</p>;
  return <div className="table-scroll"><table><thead><tr>{headings.map((value,index)=><th key={`${value}-${index}`}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
