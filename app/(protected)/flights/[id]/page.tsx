import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlight } from "@/lib/data/flights";
import { deleteFlight, updateFlight } from "../actions";
import { getFlightTracks } from "@/lib/data/tracks";
import { TracksMap } from "@/components/tracks-map";

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser(); const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft, tracks] = await Promise.all([getFlight(userId, id), getAircraftOptions(userId), getFlightTracks(userId, id)]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  return <><header className="page-header"><div><p className="eyebrow">DETAIL LETU</p><h1>{flight.registration} · {flight.date}</h1></div><form action={remove}><button className="danger-button">Smazat let</button></form></header>{tracks.length ? <section className="map-panel detail-map"><TracksMap tracks={tracks} height={480} detail /></section> : null}<section className="panel"><FlightForm action={update} aircraft={aircraft} initial={flight} /></section></>;
}
