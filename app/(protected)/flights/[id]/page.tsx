import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlight } from "@/lib/data/flights";
import { deleteFlight, updateFlight } from "../actions";
import { getFlightTracks } from "@/lib/data/tracks";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import { TrackManager } from "@/components/track-manager";
import { attachKmlTrack, applyGpsTimes, deleteTrack } from "../actions";
import { formatDuration } from "@/lib/data/dashboard";

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser(); const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft, tracks] = await Promise.all([getFlight(userId, id), getAircraftOptions(userId), getFlightTracks(userId, id)]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  const attach=attachKmlTrack.bind(null,id),apply=applyGpsTimes.bind(null,id),dropTrack=deleteTrack.bind(null,id);
  return <><header className="page-header"><div><p className="eyebrow">DETAIL LETU</p><h1>{flight.registration} · {flight.date}</h1><p className="muted">{flight.departure} → {flight.arrival} · {flight.role} · {flight.evidence}</p></div><form action={remove}><button className="danger-button">Smazat let</button></form></header><section className="flight-summary detail-summary"><div><span>BLOCK</span><strong>{formatDuration(flight.block_minutes)}</strong><small>{flight.off_block}–{flight.on_block}</small></div><div><span>AIR</span><strong>{formatDuration(flight.air_minutes)}</strong><small>{flight.takeoff}–{flight.landing}</small></div><div><span>Přistání</span><strong>{flight.starts}</strong><small>{flight.task||'let'}</small></div><div><span>GPS</span><strong>{flight.gps_km.toFixed(1)} km</strong><small>{flight.track_count} tracků</small></div></section>{tracks.length?<FlightTrackPlayer tracks={tracks}/>:<section className="panel no-track"><p className="eyebrow">GPS</p><h2>K tomuto letu není uložený track</h2><p className="muted">Níže lze KML přidat bez vytváření nového letu.</p></section>}<TrackManager flightId={id} tracks={tracks} attachAction={attach} applyAction={apply} deleteAction={dropTrack}/><details className="panel edit-flight" open><summary>Údaje letu a editace</summary><FlightForm action={update} aircraft={aircraft} initial={flight}/></details></>;
}
