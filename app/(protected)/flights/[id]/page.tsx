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
import { sql } from "@/lib/db";
import { certifyFlight } from "../certification-actions";

type Context={q?:string;evidence?:string;role?:string;registration?:string;aircraftClass?:string;airport?:string;route?:string;routePair?:string;gps?:string;year?:string;sort?:string;from?:string;to?:string};
const contextQuery=(context:Context)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(context))if(value)query.set(key,value);return query.toString()};
export default async function FlightDetailPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<Context> }) {
  const { userId } = await requireUser(); const id = Number((await params).id),context=await searchParams,query=contextQuery(context),suffix=query?`?${query}`:"";
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft, tracks,navigation,audit,certRows] = await Promise.all([
    getFlight(userId, id), getAircraftOptions(userId), getFlightTracks(userId, id),getFlightNavigation(userId,id,context),getFlightAudit(userId,id),
    sql`SELECT certified_at,certification_hash,certification_version,aircraft_make,aircraft_model,aircraft_variant FROM flights WHERE id=${id} AND user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>
  ]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  const certification=certRows[0]??{},certified=Boolean(certification.certified_at),certificationHash=String(certification.certification_hash??""),certify=certifyFlight.bind(null,id);
  const attach=attachKmlTrack.bind(null,id),apply=applyGpsTimes.bind(null,id),dropTrack=deleteTrack.bind(null,id),detect=redetectFlightAirports.bind(null,id),toggleLock=setFlightLock.bind(null,id),locked=Boolean(flight.locked_at)||certified;
  const structuredType=[String(certification.aircraft_make??"").trim(),String(certification.aircraft_model??"").trim()||flight.aircraft_type,String(certification.aircraft_variant??"").trim()].filter(Boolean).join(" ");
  return <><header className="page-header"><div><p className="eyebrow">FLIGHT {navigation.position}/{navigation.total}</p><h1>{flight.registration} · {flight.date} {certified?<span className="flight-lock-badge">CERTIFIED</span>:locked?<span className="flight-lock-badge">LOCKED</span>:null}</h1><p className="muted">{flight.departure} → {flight.arrival} · {flight.role} · {flight.evidence}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights${suffix}`}>Back to flights</Link>{navigation.previousId?<Link className="secondary-link" href={`/flights/${navigation.previousId}${suffix}`}>← Previous</Link>:null}{navigation.nextId?<Link className="secondary-link" href={`/flights/${navigation.nextId}${suffix}`}>Next →</Link>:null}{!locked?<DeleteFlightButton action={remove}/>:null}</div></header><section className="flight-summary detail-summary"><div><span>BLOCK</span><strong>{formatDuration(flight.block_minutes)}</strong><small>{flight.off_block}–{flight.on_block}</small></div><div><span>AIR</span><strong>{formatDuration(flight.air_minutes)}</strong><small>{flight.takeoff}–{flight.landing}</small></div><div><span>Flight cost</span><strong>{flight.price_per_hour?`${Math.round(flight.calculated_price).toLocaleString("en-GB")} CZK`:"—"}</strong><small>{flight.price_per_hour?`${Number(flight.price_per_hour).toLocaleString("en-GB")} CZK/h · ${billingLabel(flight.billing_basis)}`:"Hourly rate missing"}</small></div><div><span>Landings</span><strong>{flight.starts}</strong><small>{flight.task||'flight'}</small></div><div><span>GPS</span><strong>{flight.gps_km.toFixed(1)} km</strong><small>{flight.track_count} tracks</small></div></section>
  <section className={`panel flight-lock-panel ${locked?"locked":""}`}><div><p className="eyebrow">RECORD PROTECTION</p><h2>{certified?"Pilot-certified record":locked?"Flight is locked":"Flight is editable"}</h2><p>{certified?`This flight is frozen as a certified electronic logbook record${structuredType?` · ${structuredType}`:""}. Corrections must be made through a traceable correction workflow rather than silently editing the certified entry.`:locked?"Flight details, airport detection and GPS changes are protected. You can certify the checked record or unlock it for a correction.":"Check the route, UTC times, aircraft identity, pilot function and remarks before certifying the record."}</p>{certified&&certificationHash?<small>SHA-256 integrity fingerprint: {certificationHash}</small>:null}</div>{certified?null:<div className="record-protection-actions"><form action={toggleLock}><input type="hidden" name="lock" value={locked?"no":"yes"}/><button className={locked?"secondary-link":"secondary-button"}>{locked?"Unlock flight":"Lock checked flight"}</button></form><form action={certify}><input type="hidden" name="confirm" value="certify"/><button className="primary-button">Certify & freeze record</button></form></div>}</section>
  {tracks.length?<>{!locked?<AirportDetectionControl action={detect} departure={flight.departure} arrival={flight.arrival}/>:null}<FlightTrackPlayer tracks={tracks}/></>:<section className="panel no-track"><p className="eyebrow">GPS</p><h2>No GPS track</h2></section>}{!locked?<TrackManager flightId={id} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/>:null}{!locked?<details className="panel edit-flight" open><summary>Flight details</summary><FlightForm key={`${flight.id}:${flight.registration}:${flight.departure}:${flight.arrival}`} action={update} aircraft={aircraft} initial={flight}/></details>:<section className="panel locked-flight-note"><strong>{certified?"Editing is disabled for a certified record.":"Editing is disabled while this flight is locked."}</strong><p>{certified?"The original certified data and its fingerprint remain available in the audit trail.":"Unlock it above if a correction is required. Both actions will remain in the audit trail."}</p></section>}<FlightAuditPanel events={audit}/></>;
}
