import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlight, getFlightNavigation } from "@/lib/data/flights";
import Link from "next/link";
import { deleteFlight, updateFlight } from "../actions";
import { getFlightTracks } from "@/lib/data/tracks";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import { TrackManager } from "@/components/track-manager";
import { attachKmlTrack, applyGpsTimes, deleteTrack, redetectFlightAirports } from "../actions";
import { formatDuration } from "@/lib/data/dashboard";
import { AirportDetectionControl } from "@/components/airport-detection-control";
import { billingLabel } from "@/lib/billing";

type Context={q?:string;evidence?:string;role?:string;registration?:string;aircraftClass?:string;airport?:string;route?:string;routePair?:string;gps?:string;year?:string;sort?:string;from?:string;to?:string};
const contextQuery=(context:Context)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(context))if(value)query.set(key,value);return query.toString()};
export default async function FlightDetailPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<Context> }) {
  const { userId } = await requireUser(); const id = Number((await params).id),context=await searchParams,query=contextQuery(context),suffix=query?`?${query}`:"";
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft, tracks,navigation] = await Promise.all([getFlight(userId, id), getAircraftOptions(userId), getFlightTracks(userId, id),getFlightNavigation(userId,id,context)]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  const attach=attachKmlTrack.bind(null,id),apply=applyGpsTimes.bind(null,id),dropTrack=deleteTrack.bind(null,id),detect=redetectFlightAirports.bind(null,id);
  return <><header className="page-header"><div><p className="eyebrow">DETAIL LETU · {navigation.position}/{navigation.total}</p><h1>{flight.registration} · {flight.date}</h1><p className="muted">{flight.departure} → {flight.arrival} · {flight.role} · {flight.evidence}</p></div><div className="detail-navigation"><Link className="secondary-link" href={`/flights${suffix}`}>Zpět na seznam</Link>{navigation.previousId?<Link className="secondary-link" href={`/flights/${navigation.previousId}${suffix}`}>← Předchozí</Link>:null}{navigation.nextId?<Link className="secondary-link" href={`/flights/${navigation.nextId}${suffix}`}>Další →</Link>:null}<form action={remove}><button className="danger-button">Smazat let</button></form></div></header><section className="flight-summary detail-summary"><div><span>BLOCK</span><strong>{formatDuration(flight.block_minutes)}</strong><small>{flight.off_block}–{flight.on_block}</small></div><div><span>AIR</span><strong>{formatDuration(flight.air_minutes)}</strong><small>{flight.takeoff}–{flight.landing}</small></div><div><span>Cena letu</span><strong>{flight.price_per_hour?`${Math.round(flight.calculated_price).toLocaleString("cs-CZ")} Kč`:"—"}</strong><small>{flight.price_per_hour?`${Number(flight.price_per_hour).toLocaleString("cs-CZ")} Kč/h · ${billingLabel(flight.billing_basis)}`:"Chybí hodinová sazba"}</small></div><div><span>Přistání</span><strong>{flight.starts}</strong><small>{flight.task||'let'}</small></div><div><span>GPS</span><strong>{flight.gps_km.toFixed(1)} km</strong><small>{flight.track_count} tracků</small></div></section>{tracks.length?<><AirportDetectionControl action={detect} departure={flight.departure} arrival={flight.arrival}/><FlightTrackPlayer tracks={tracks}/></>:<section className="panel no-track"><p className="eyebrow">GPS</p><h2>K tomuto letu není uložený track</h2><p className="muted">Níže lze GPS track přidat bez vytváření nového letu.</p></section>}<TrackManager flightId={id} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/><details className="panel edit-flight" open><summary>Údaje letu a editace</summary><FlightForm key={`${flight.id}:${flight.registration}:${flight.departure}:${flight.arrival}`} action={update} aircraft={aircraft} initial={flight}/></details></>;
}
