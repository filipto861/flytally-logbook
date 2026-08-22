import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight } from "../actions";
import { detectTrackAirports,importKmlFlight } from "../actions";
import { KmlImportForm } from "@/components/kml-import-form";
import { getManualEntryDefaults, getRecentRoutes } from "@/lib/data/flights";
import { saveAircraft } from "@/app/(protected)/database/actions";

export default async function NewFlightPage() {
  const { userId } = await requireUser();
  const [aircraft,routes,defaults] = await Promise.all([getAircraftOptions(userId),getRecentRoutes(userId),getManualEntryDefaults(userId)]);
  return <><header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>New flight</h1></div></header><div className="new-flight-modes"><details className="panel" open><summary><span>01</span><div><strong>Import GPS track</strong></div></summary><KmlImportForm action={importKmlFlight} airportAction={detectTrackAirports} aircraft={aircraft}/></details><details className="panel"><summary><span>02</span><div><strong>Manual entry</strong></div></summary><FlightForm action={createFlight} aircraft={aircraft} routes={routes} initial={defaults}/></details><details className="panel compact-create"><summary><span>＋</span><div><strong>Add aircraft</strong></div></summary><form action={saveAircraft} className="inline-editor"><input name="registration" placeholder="Registration" required/><input name="aircraft_type" placeholder="Aircraft type"/><input name="icao_type" placeholder="ICAO type"/><select name="aircraft_class" defaultValue="ULL"><option>ULL</option><option>SEP</option><option>TMG</option><option>MEP</option><option>SET</option><option>OTHER</option><option>GLIDER</option></select><select name="evidence" defaultValue="ULL"><option>ULL</option><option>EASA</option></select><select name="default_role" defaultValue="PIC"><option>PIC</option><option>DUAL</option><option value="INSTRUKTOR">INSTRUCTOR</option><option>SAFETY PILOT</option></select><select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select><button className="primary-button">Save aircraft</button></form></details></div></>;
}
