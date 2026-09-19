import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getDatabaseDataV164 as getDatabaseData } from "@/lib/data/database-v164";
import { canonicalizeFlightAirportCodes,deleteRate,saveAircraftWithResult,saveAirport,saveRate,toggleAircraft,toggleAirport } from "./actions";
import { DataQualityPanel } from "@/components/data-quality-panel";
import { searchAirportCatalog } from "@/lib/airport-catalog";
import { AircraftManager } from "@/components/aircraft-manager";
import { DatabaseWorkspaceNavigation,type DatabaseWorkspaceView } from "@/components/database-workspace-navigation";
import { sql } from "@/lib/db";
import { saveAircraftPhoto,removeAircraftPhoto } from "./aircraft-photo-actions";
import { shareAircraftProfile } from "../connections/aircraft-share-actions";
import { PendingActionButton } from "@/components/pending-action-button";

export const metadata={title:"Aircraft & airports | FlyTally"};

const t=(value:unknown)=>String(value??"");
type Params={view?:string;airportSearch?:string;airportPage?:string;imported?:string};
const resolveView=(value:unknown):DatabaseWorkspaceView=>value==="airports"||value==="health"?value:"aircraft";
const airportHref=(query:string,page:number)=>`/database?${new URLSearchParams({view:"airports",airportSearch:query,airportPage:String(page)})}`;

export default async function DatabasePage({searchParams}:{searchParams:Promise<Params>}){
  const{userId}=await requireUser(),params=await searchParams,view=resolveView(params.view),airportSearch=String(params.airportSearch||"").trim();
  const[data,connections]=await Promise.all([getDatabaseData(userId),view==="aircraft"?sql`SELECT u.id,u.display_name,COALESCE(s.home_airport,'') home_airport FROM pilot_connections c JOIN users u ON u.id=CASE WHEN c.requester_user_id=${userId} THEN c.recipient_user_id ELSE c.requester_user_id END LEFT JOIN user_settings s ON s.user_id=u.id WHERE c.status='accepted' AND (c.requester_user_id=${userId} OR c.recipient_user_id=${userId}) ORDER BY u.display_name` as Promise<Array<Record<string,unknown>>>:Promise.resolve([] as Array<Record<string,unknown>>)]);
  const catalog=view==="airports"&&airportSearch?searchAirportCatalog(airportSearch,Number(params.airportPage||1),50):null;
  const activeAircraft=data.aircraft.filter(item=>Boolean(Number(item.active))).length,inactiveAircraft=data.aircraft.length-activeAircraft;
  const airportTotal=Number(data.airportStats.total||0),customAirportCount=data.airports.length;

  return <div className="ui-page-stack">
    <header className="page-header"><div><p className="eyebrow">LOGBOOK DATA</p><h1>Aircraft & airports</h1><p className="muted page-lead">{view==="aircraft"?"Aircraft you fly and the defaults used when logging a flight.":view==="airports"?"Your own locations plus the built-in airport reference catalogue.":"Technical checks and maintenance tools for stored logbook data."}</p></div></header>
    <DatabaseWorkspaceNavigation active={view} issueCount={data.issues.length}/>

    {view==="aircraft"?<main className="u31-workspace">
      {params.imported?<p className="form-success aircraft-import-success" role="status">{params.imported} was added to your aircraft. You can edit every imported value independently.</p>:null}
      <section className="u31-workspace-heading"><div><p className="eyebrow">AIRCRAFT</p><h2>Your aircraft</h2><p className="muted">Pick an aircraft to manage its profile or rates. Technical defaults stay inside the aircraft editor instead of filling this page.</p></div><div className="u31-counts"><span><b>{activeAircraft}</b> active</span>{inactiveAircraft?<span><b>{inactiveAircraft}</b> inactive</span>:null}</div></section>
      <AircraftManager aircraft={data.aircraft} rates={data.rates} connections={connections} saveAction={saveAircraftWithResult} toggleAction={toggleAircraft} saveRateAction={saveRate} deleteRateAction={deleteRate} savePhotoAction={saveAircraftPhoto} removePhotoAction={removeAircraftPhoto} shareAction={shareAircraftProfile}/>
    </main>:null}

    {view==="airports"?<main className="u31-workspace">
      <section className="u31-workspace-heading"><div><p className="eyebrow">AIRPORTS</p><h2>Airport records</h2><p className="muted">Add only locations missing from FlyTally. Use the reference catalogue to check a code or airport without loading the whole catalogue into the everyday workspace.</p></div><div className="u31-counts"><span><b>{customAirportCount}</b> custom</span><span><b>{airportTotal.toLocaleString("en-GB")}</b> reference</span></div></section>

      <section className="panel u31-airport-panel">
        <div className="u31-panel-heading"><div><p className="eyebrow">YOUR LOCATIONS</p><h2>Custom airports</h2><p className="muted">For private strips, heliports or other locations not available in the built-in catalogue.</p></div></div>
        <form action={saveAirport} className="u31-airport-editor">
          <label>Code<input name="ident" placeholder="ICAO / code" required/></label>
          <label>Name<input name="name" placeholder="Airport or location name"/></label>
          <label>City<input name="municipality" placeholder="City"/></label>
          <label>Country<input name="iso_country" placeholder="CZ"/></label>
          <label>Latitude<input name="latitude_deg" type="number" step="any" placeholder="50.1234"/></label>
          <label>Longitude<input name="longitude_deg" type="number" step="any" placeholder="14.1234"/></label>
          <PendingActionButton className="primary-button" pendingLabel="Saving…">Add / update</PendingActionButton>
        </form>
        {data.airports.length?<div className="table-scroll"><table><thead><tr><th>Code</th><th>Name</th><th>City</th><th>Country</th><th>Coordinates</th><th>Status</th></tr></thead><tbody>{data.airports.map(item=><tr key={t(item.id)}><td><strong>{t(item.ident)}</strong></td><td>{t(item.name)||"—"}</td><td>{t(item.municipality)||"—"}</td><td>{t(item.iso_country)||"—"}</td><td>{t(item.latitude_deg)}, {t(item.longitude_deg)}</td><td><form action={toggleAirport}><input type="hidden" name="id" value={t(item.id)}/><PendingActionButton className={Number(item.active)?"status-on":"status-off"} pendingLabel="Updating…">{Number(item.active)?"Active":"Inactive"}</PendingActionButton></form></td></tr>)}</tbody></table></div>:<div className="u31-empty-state"><strong>No custom airports</strong><span>You only need one when a location is not available in FlyTally's reference catalogue.</span></div>}
      </section>

      <section className="panel u31-airport-panel">
        <div className="u31-panel-heading"><div><p className="eyebrow">REFERENCE</p><h2>Airport catalogue</h2><p className="muted">Search when you need to verify a code, airport name, city or country.</p></div></div>
        <form method="get" className="airport-search u31-airport-search"><input type="hidden" name="view" value="airports"/><label>Search<input name="airportSearch" defaultValue={airportSearch} placeholder="LKPR, Letnany, Prague, CZ"/></label><button className="primary-button">Search</button>{airportSearch?<Link className="secondary-link" href="/database?view=airports">Clear</Link>:null}</form>
        {catalog?<><div className="table-scroll"><table><thead><tr><th>ID / ICAO</th><th>Name</th><th>City</th><th>Country / region</th><th>Type</th><th>Coordinates</th></tr></thead><tbody>{catalog.rows.map(airport=><tr key={airport.ident}><td><strong>{airport.ident}</strong></td><td>{airport.name||"—"}</td><td>{airport.municipality||"—"}</td><td>{airport.country||"—"}<small>{airport.region}</small></td><td>{airport.type.replaceAll("_"," ")}</td><td>{airport.lat.toFixed(6)}, {airport.lon.toFixed(6)}</td></tr>)}{!catalog.rows.length?<tr><td colSpan={6} className="empty-state">No airports found.</td></tr>:null}</tbody></table></div><div className="pagination"><span>{catalog.total.toLocaleString("en-GB")} matches</span><Link aria-disabled={catalog.page<=1} href={airportHref(airportSearch,catalog.page-1)}>← Previous</Link><strong>{catalog.page} / {catalog.pages}</strong><Link aria-disabled={catalog.page>=catalog.pages} href={airportHref(airportSearch,catalog.page+1)}>Next →</Link></div></>:<div className="u31-empty-state compact"><strong>Search the catalogue when needed</strong><span>The full worldwide catalogue stays out of the default page until you ask for results.</span></div>}
      </section>
    </main>:null}

    {view==="health"?<main className="u31-workspace">
      <section className="u31-workspace-heading"><div><p className="eyebrow">DATA HEALTH</p><h2>{data.issues.length?data.issues.length===1?"1 item needs review":`${data.issues.length} items need review`:"No technical issues detected"}</h2><p className="muted">Diagnostics and historical maintenance live here so they do not interrupt normal aircraft or airport management.</p></div><span className={data.issues.length?"status-warning":"status-on"}>{data.issues.length?"REVIEW":"CLEAR"}</span></section>
      <DataQualityPanel issues={data.issues} airportStats={data.airportStats}/>

      {data.codeMigrations.length?<details className="panel airport-code-migration"><summary><span><strong>Standardize historical airport codes</strong><small>Review older codes before updating eligible historical flights.</small></span><b>{data.codeMigrations.length}</b></summary><div className="table-scroll"><table><thead><tr><th>Current</th><th>New</th><th>Airport</th><th>Departures</th><th>Arrivals</th></tr></thead><tbody>{data.codeMigrations.map(item=><tr key={item.from}><td><code>{item.from}</code></td><td><strong>{item.to}</strong></td><td>{item.name||"—"}</td><td>{item.departures}</td><td>{item.arrivals}</td></tr>)}</tbody></table></div><form action={canonicalizeFlightAirportCodes} className="migration-confirm"><input type="hidden" name="confirm" value="canonicalize-airports"/><PendingActionButton className="primary-button" pendingLabel="Updating…">Update eligible historical flight codes</PendingActionButton></form></details>:null}

      <details className="panel u31-advanced-health"><summary><span><strong>Advanced counts</strong><small>Duplicates, rates, routes and GPS structure.</small></span></summary><div className="metric-grid compact-metrics"><article className="metric"><span>Total flights</span><strong>{t(data.quality.total)}</strong></article><article className="metric"><span>Possible duplicates</span><strong>{t(data.quality.duplicate_flights)}</strong></article><article className="metric"><span>Flights without rate</span><strong>{t(data.quality.missing_price)}</strong></article><article className="metric"><span>Historical rates</span><strong>{t(data.quality.historical_rates)}</strong><small>{t(data.quality.future_rates)} future</small></article><article className="metric"><span>Invalid rates</span><strong>{Number(data.quality.invalid_rate_dates||0)+Number(data.quality.invalid_rates||0)}</strong></article><article className="metric"><span>Incomplete routes</span><strong>{t(data.quality.missing_route)}</strong></article><article className="metric"><span>Invalid BLOCK</span><strong>{t(data.quality.invalid_block_time)}</strong></article><article className="metric"><span>Empty GPS tracks</span><strong>{t(data.quality.empty_tracks)}</strong></article></div></details>
    </main>:null}
  </div>;
}
