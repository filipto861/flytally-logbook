import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight } from "../actions";
import { detectTrackAirports,importKmlFlight } from "../actions";
import { KmlImportForm } from "@/components/kml-import-form";
import { getManualEntryDefaults, getRecentRoutes } from "@/lib/data/flights";
import { FlightEntryWorkspace } from "@/components/flight-entry-workspace";
import { saveAircraft } from "@/app/(protected)/database/actions";

export default async function NewFlightPage({searchParams}:{searchParams:Promise<{mode?:string;added?:string}>}) {
  const { userId } = await requireUser(),params=await searchParams,manualOpen=params.mode==="manual"||params.added==="1";
  const [aircraft,routes,defaults] = await Promise.all([getAircraftOptions(userId),getRecentRoutes(userId),getManualEntryDefaults(userId)]);
  const aircraftForm=<form action={saveAircraft} className="aircraft-dialog-form"><label>Registration<input name="registration" placeholder="OK-ABC" autoCapitalize="characters" required/></label><label>Make<input name="aircraft_make" placeholder="BRM Aero"/></label><label>Model<input name="aircraft_model" placeholder="Bristell B23"/></label><label>Variant<input name="aircraft_variant" placeholder="Optional"/></label><label>Display type<input name="aircraft_type" placeholder="Bristell B23"/></label><label>ICAO type<input name="icao_type" placeholder="BR23" autoCapitalize="characters"/></label><label>Class<select name="aircraft_class" defaultValue="ULL"><option>ULL</option><option>SEP</option><option>TMG</option><option>MEP</option><option>SET</option><option>OTHER</option><option>GLIDER</option></select></label><label>Logbook<select name="evidence" defaultValue="ULL"><option>ULL</option><option>EASA</option></select></label><label>Default role<select name="default_role" defaultValue="PIC"><option>PIC</option><option>SOLO</option><option>DUAL</option><option>SPIC</option><option>PICUS</option><option>INSTRUCTOR</option><option>EXAMINER</option><option>SAFETY PILOT</option><option>CO-PILOT</option><option>CRUISE-RELIEF CO-PILOT</option></select></label><label>Billing<select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select></label><div className="form-actions wide"><button className="primary-button">Save aircraft</button></div></form>;
  return <><header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>New flight</h1><p className="muted">Choose one way to add the flight. Nothing is saved until you confirm the completed record.</p></div></header><FlightEntryWorkspace initialMode={manualOpen?"manual":"gps"} gps={<KmlImportForm action={importKmlFlight} airportAction={detectTrackAirports} aircraft={aircraft}/>} manual={<FlightForm action={createFlight} aircraft={aircraft} routes={routes} initial={defaults}/>} aircraft={aircraftForm}/></>;
}
