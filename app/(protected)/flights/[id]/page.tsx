import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlight, getFlightNavigation } from "@/lib/data/flights";
import { getFlightAudit } from "@/lib/data/flight-audit";
import Link from "next/link";
import { deleteFlight, setFlightLock, updateFlight } from "../actions";
import { getFlightTracks } from "@/lib/data/tracks";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import { TrackManager } from "@/components/track-manager";
import { attachKmlTrack, applyGpsTimes, deleteTrack, redetectFlightAirports } from "../actions";
import { formatDuration } from "@/lib/data/dashboard";
import { AirportDetectionControl } from "@/components/airport-detection-control";
import { billingLabel } from "@/lib/billing";
import { FlightAuditPanel } from "@/components/flight-audit-panel";
import { DeleteFlightButton } from "@/components/delete-flight-button";

type Context={q?:string;evidence?:string;role?:string;registration?:string;aircraftClass?:string;airport?:string;route?:string;routePair?:string;gps?:string;year?:string;sort?:string;from?:string;to?:string};
const contextQuery=(context:Context)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(context))if(value)query.set(key,value);return query.toString()};
export default async function FlightDetailPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<Context> }) {
  const { userId } = await requireUser(); const id = Number((await params).id),context=await searchParams,query=contextQuery(context),suffix=query?`?${query}`:"";
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft, tracks,navigation,audit] = await Promise.all([getFlight(userId, id), getAircraftOptions(userId), getFlightTracks(userId, id),getFlightNavigation(userId,id,context),getFlightAudit(userId,id)]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  const attach=attachKmlTrack.bind(null,id),apply=applyGpsTimes.bind(null,id),dropTrack=deleteTrack.bind(null,id),detect=redetectFlightAirports.bind(null,id),toggleLock=setFlightLock.bind(null,id),locked=Boolean(flight.locked_at);
  return <><header className="page-header"><div><p className="eyebrow">FLIGHT {navigation.position}/{navigation.total}</p><h1>{flight.registration} · {flight.date} {locked?<span className="flight-lock-badge">LOCKED</span>:null}</h1><p className="muted">{flight.departure} → {flight.arrival} · {flight.role} · {flight.evidence}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights${suffix}`}>Back to flights</Link>{navigation.previousId?<Link className="secondary-link" href={`/flights/${navigation.previousId}${suffix}`}>← Previous</Link>:null}{navigation.nextId?<Link className="secondary-link" href={`/flights/${navigation.nextId}${suffix}`}>Next →</Link>:null}{!locked?<DeleteFlightButton action={remove}/>:null}</div></header><section className="flight-summary detail-summary"><div><span>BLOCK</span><strong>{formatDuration(flight.block_minutes)}</strong><small>{flight.off_block}–{flight.on_block}</small></div><div><span>AIR</span><strong>{formatDuration(flight.air_minutes)}</strong><small>{flight.takeoff}–{flight.landing}</small></div><div><span>Flight cost</span><strong>{flight.price_per_hour?`${Math.round(flight.calculated_price).toLocaleString("en-GB")} CZK`:"—"}</strong><small>{flight.price_per_hour?`${Number(flight.price_per_hour).toLocaleString("en-GB")} CZK/h · ${billingLabel(flight.billing_basis)}`:"Hourly rate missing"}</small></div><div><span>Landings</span><strong>{flight.starts}</strong><small>{flight.task||'flight'}</small></div><div><span>GPS</span><strong>{flight.gps_km.toFixed(1)} km</strong><small>{flight.track_count} tracks</small></div></section><section className={`panel flight-lock-panel ${locked?"locked":""}`}><div><p className="eyebrow">RECORD PROTECTION</p><h2>{locked?"Flight is locked":"Flight is editable"}</h2><p>{locked?"Flight details, airport detection and GPS changes are protected. Unlocking is recorded in the change history.":"Lock the flight after checking its route, times, aircraft and cost."}</p></div><form action={toggleLock}><input type="hidden" name="lock" value={locked?"no":"yes"}/><button className={locked?"secondary-link":"primary-button"}>{locked?"Unlock flight":"Lock checked flight"}</button></form></section>{tracks.length?<>{!locked?<AirportDetectionControl action={detect} departure={flight.departure} arrival={flight.arrival}/>:null}<FlightTrackPlayer tracks={tracks}/></>:<section className="panel no-track"><p className="eyebrow">GPS</p><h2>No GPS track</h2></section>}{!locked?<TrackManager flightId={id} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/>:null}{!locked?<details className="panel edit-flight" open><summary>Flight details</summary><FlightForm key={`${flight.id}:${flight.registration}:${flight.departure}:${flight.arrival}`} action={update} aircraft={aircraft} initial={flight}/></details>:<section className="panel locked-flight-note"><strong>Editing is disabled while this flight is locked.</strong><p>Unlock it above if a correction is required. Both actions will remain in the audit trail.</p></section>}<FlightAuditPanel events={audit}/></>;
}
