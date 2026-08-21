import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight } from "../actions";
import { importKmlFlight } from "../actions";
import { KmlImportForm } from "@/components/kml-import-form";
import { getRecentRoutes } from "@/lib/data/flights";

export default async function NewFlightPage() {
  const { userId } = await requireUser();
  const [aircraft,routes] = await Promise.all([getAircraftOptions(userId),getRecentRoutes(userId)]);
  return <><header className="page-header"><div><p className="eyebrow">LETOVÝ DENÍK</p><h1>Nový let</h1><p className="muted">KML import s GPS trackem nebo ruční zápis</p></div></header><div className="new-flight-modes"><details className="panel" open><summary><span>01</span><div><strong>KML import</strong><small>Automaticky načte trasu, datum, časy, vzdálenost a výšku</small></div></summary><KmlImportForm action={importKmlFlight} aircraft={aircraft}/></details><details className="panel"><summary><span>02</span><div><strong>Ruční zápis</strong><small>Kompletní zadání letových údajů bez GPS souboru</small></div></summary><FlightForm action={createFlight} aircraft={aircraft} routes={routes}/></details></div></>;
}
