import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlightDetailFast as getFlight,getFlightNavigationFast as getFlightNavigation } from "@/lib/data/flights-fast";
import Link from "next/link";
import { deleteFlight,setFlightLock,updateFlight,attachKmlTrack,applyGpsTimes,deleteTrack,redetectFlightAirports } from "../actions";
import { getFlightTracks } from "@/lib/data/tracks";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import { TrackManager } from "@/components/track-manager";
import { formatDuration } from "@/lib/data/dashboard";
import { AirportDetectionControl } from "@/components/airport-detection-control";
import { billingLabel } from "@/lib/billing";
import { DeleteFlightButton } from "@/components/delete-flight-button";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { blockingComplianceIssues,fcl050FlightCompliance } from "@/lib/fcl050-compliance";
import { certifyFlight,startCertifiedCorrection } from "../certification-actions";
import { measureServerTask } from "@/lib/performance";
import { FlightDetailWorkspace } from "@/components/flight-detail-workspace";

type Context={q?:string;evidence?:string;role?:string;registration?:string;aircraftClass?:string;airport?:string;route?:string;routePair?:string;gps?:string;year?:string;sort?:string;from?:string;to?:string;tab?:string};
const contextQuery=(context:Context)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(context))if(value&&key!=="tab")query.set(key,value);return query.toString()};

export default async function FlightDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Context>}){
  const {userId}=await requireUser();const id=Number((await params).id),context=await searchParams,query=contextQuery(context),suffix=query?`?${query}`:"";
  if(!Number.isSafeInteger(id)||id<=0)notFound();
  await ensureDatabaseOptimizations();
  const [flight,aircraft,tracks,navigation]=await Promise.all([
    getFlight(userId,id),
    getAircraftOptions(userId),
    measureServerTask("flight-gps-tracks",()=>getFlightTracks(userId,id),750),
    getFlightNavigation(userId,id,context),
  ]);
  if(!flight)notFound();
  const raw=flight as unknown as Record<string,unknown>,pilotName=String(raw.pilot_name??"");
  const update=updateFlight.bind(null,id),remove=deleteFlight.bind(null,id);
  const certified=Boolean(flight.certified_at),recordRevision=Math.max(1,Number(flight.record_revision||1)),correctionReason=String(flight.correction_reason??"").trim(),correctionDraft=!certified&&recordRevision>1&&Boolean(correctionReason),certify=certifyFlight.bind(null,id),correct=startCertifiedCorrection.bind(null,id);
  const hasCertifiedHistory=certified||recordRevision>1||Boolean(correctionReason);
  const attach=attachKmlTrack.bind(null,id),apply=applyGpsTimes.bind(null,id),dropTrack=deleteTrack.bind(null,id),detect=redetectFlightAirports.bind(null,id),toggleLock=setFlightLock.bind(null,id),locked=Boolean(flight.locked_at)||certified;
  const compliance=fcl050FlightCompliance(raw,pilotName),blockers=blockingComplianceIssues(compliance),easa=String(flight.evidence??"").trim().toUpperCase()==="EASA";
  const badge=certified?<span className="flight-lock-badge">CERTIFIED R{recordRevision}</span>:correctionDraft?<span className="flight-lock-badge">CORRECTION R{recordRevision}</span>:locked?<span className="flight-lock-badge">LOCKED</span>:null;
  const displayDate=/^\d{4}-\d{2}-\d{2}$/.test(flight.date)?new Date(`${flight.date}T00:00:00`).toLocaleDateString("en-GB"):flight.date;
  const overview=<>
    <section className="flight-summary detail-summary"><div><span>BLOCK</span><strong>{formatDuration(flight.block_minutes)}</strong><small>{flight.off_block}–{flight.on_block}</small></div><div><span>AIR</span><strong>{formatDuration(flight.air_minutes)}</strong><small>{flight.takeoff}–{flight.landing}</small></div><div><span>Flight cost</span><strong>{flight.price_per_hour?`${Math.round(flight.calculated_price).toLocaleString("en-GB")} CZK`:"—"}</strong><small>{flight.price_per_hour?`${Number(flight.price_per_hour).toLocaleString("en-GB")} CZK/h · ${billingLabel(flight.billing_basis)}`:"Hourly rate missing"}</small></div><div><span>Landings</span><strong>{flight.starts}</strong><small>{flight.task||"flight"}</small></div><div><span>GPS</span><strong>{flight.gps_km.toFixed(1)} km</strong><small>{flight.track_count} tracks</small></div></section>
    <section className={`panel flight-lock-panel ${locked?"locked":""}`}><div><p className="eyebrow">RECORD STATUS</p><h2>{certified?`Certified revision ${recordRevision}`:correctionDraft?`Correction revision ${recordRevision}`:locked?"Locked":"Ready for review"}</h2><p className="muted">{certified?"This revision is protected. Use Correct flight only when a recorded value is wrong.":correctionDraft?correctionReason:locked?"Unlock the record to edit it.":"Review Logbook data, then certify the final record."}</p>{easa&&blockers.length?<div className="compliance-warnings"><strong>{blockers.length===1?"1 issue must be fixed before certification":`${blockers.length} issues must be fixed before certification`}</strong>{blockers.map(item=><p className="form-error" key={item.code}>{item.message}</p>)}<small>Open the Logbook data tab to correct the highlighted information.</small></div>:null}</div>
      {certified?<div className="record-protection-actions"><details className="certified-correction"><summary className="secondary-button">Correct flight</summary><form action={correct} className="stack-form"><label>Reason for correction<textarea name="reason" minLength={8} maxLength={1000} rows={3} required placeholder="Example: Incorrect number of landings entered."/></label><p className="muted">The current revision stays archived. A new editable revision {recordRevision+1} will be created.</p><button className="primary-button">Open correction R{recordRevision+1}</button></form></details></div>:<div className="record-protection-actions"><form action={toggleLock}><input type="hidden" name="lock" value={locked?"no":"yes"}/><button className="secondary-link">{locked?"Unlock record":"Lock without certification"}</button></form><form action={certify}><input type="hidden" name="confirm" value="certify"/><button className="primary-button" disabled={easa&&blockers.length>0} title={easa&&blockers.length?"Resolve the listed issues before certification.":undefined}>{correctionDraft?`Certify revision ${recordRevision}`:"Certify flight"}</button></form></div>}
    </section>
    {!locked&&!hasCertifiedHistory?<details className="panel danger-zone"><summary>More actions</summary><div><p className="muted">Deleted flights remain recoverable in Print & data → Trash.</p><DeleteFlightButton action={remove}/></div></details>:null}
  </>;
  const gps=<>{tracks.length?<>{!locked?<AirportDetectionControl action={detect} departure={flight.departure} arrival={flight.arrival}/>:null}<FlightTrackPlayer tracks={tracks}/></>:<section className="panel no-track"><p className="eyebrow">GPS</p><h2>No GPS track</h2><p className="muted">This flight has no attached GPS data.</p></section>}{!locked?<TrackManager flightId={id} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/>:null}</>;
  const logbook=!locked?<section className="panel logbook-edit-panel"><header><div><p className="eyebrow">LOGBOOK DATA</p><h2>Edit flight record</h2><p className="muted">Changes are saved only when you press Save flight at the end of the form.</p></div></header><FlightForm key={`${flight.id}:${flight.registration}:${flight.departure}:${flight.arrival}:${recordRevision}`} action={update} aircraft={aircraft} initial={flight}/></section>:<section className="panel locked-flight-note"><strong>{certified?"Editing is disabled for this certified revision.":"Editing is disabled while this flight is locked."}</strong><p>{certified?"Use Correct flight on the Overview tab if a value must be changed.":"Unlock the record on the Overview tab to edit it."}</p></section>;
  return <>
    <header className="page-header"><div><p className="eyebrow">FLIGHT {navigation.position}/{navigation.total}</p><h1>{flight.registration} · {displayDate} {badge}</h1><p className="muted">{flight.departure} → {flight.arrival} · {flight.role} · {flight.evidence}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights${suffix}`}>Back to flights</Link>{navigation.previousId?<Link className="secondary-link" href={`/flights/${navigation.previousId}${suffix}`}>← Previous</Link>:null}{navigation.nextId?<Link className="secondary-link" href={`/flights/${navigation.nextId}${suffix}`}>Next →</Link>:null}{hasCertifiedHistory?<Link className="secondary-link" href={`/flights/${id}/audit`}>Audit report</Link>:null}</div></header>
    <FlightDetailWorkspace overview={overview} gps={gps} logbook={logbook} gpsCount={tracks.length} initialTab={context.tab==="logbook"?"logbook":context.tab==="gps"?"gps":"overview"}/>
  </>;
}
