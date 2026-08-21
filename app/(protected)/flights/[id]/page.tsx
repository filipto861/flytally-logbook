import { notFound } from "next/navigation";
import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { getFlight } from "@/lib/data/flights";
import { deleteFlight, updateFlight } from "../actions";

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser(); const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [flight, aircraft] = await Promise.all([getFlight(userId, id), getAircraftOptions(userId)]);
  if (!flight) notFound(); const update = updateFlight.bind(null, id); const remove = deleteFlight.bind(null, id);
  return <><header className="page-header"><div><p className="eyebrow">DETAIL LETU</p><h1>{flight.registration} · {flight.date}</h1></div><form action={remove}><button className="danger-button">Smazat let</button></form></header><section className="panel"><FlightForm action={update} aircraft={aircraft} initial={flight} /></section></>;
}
