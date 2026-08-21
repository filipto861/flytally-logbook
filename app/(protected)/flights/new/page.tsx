import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight } from "../actions";

export default async function NewFlightPage() {
  const { userId } = await requireUser();
  const aircraft = await getAircraftOptions(userId);
  return <><header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>Nový let</h1></div></header><section className="panel"><FlightForm action={createFlight} aircraft={aircraft} /></section></>;
}
