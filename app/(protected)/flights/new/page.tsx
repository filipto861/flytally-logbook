import { FlightForm } from "@/components/flight-form";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight } from "../actions";
import { detectTrackAirports,importKmlFlight } from "../actions";
import { KmlImportForm } from "@/components/kml-import-form";
import { getManualEntryDefaults, getRecentRoutes } from "@/lib/data/flights";
import { saveAircraft } from "@/app/(protected)/database/actions";

export default async function NewFlightPage({searchParams}:{searchParams:Promise<{mode?:string;added?:string}>}) {
  const { userId } = await requireUser(),params=await searchParams,manualOpen=params.mode==="manual"||params.added==="1";
  const [aircraft,routes,defaults] = await Promise.all([getAircraftOptions(userId),getRecentRoutes(userId),getManualEntryDefaults(userId)]);
  return <><header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>New flight</h1></div></header><div className="new-flight-modes"><details className="panel" open={!manualOpen}><summary><span>01</span><div><strong>Import GPS track</strong></div></summary><KmlImportForm action={importKmlFlight} airportAction={detectTrackAirports} aircraft={aircraft}/></details><details className="panel" open={manualOpen}><summary><span>02</span><div><strong>Manual entry</strong></div></summary><FlightForm action={createFlight} aircraft={aircraft} routes={routes} initial={defaults} draftScope={String(userId)}/></details><details className="panel compact-create"><summary><span>＋</span><div><strong>Add aircraft</strong></div></summary><form action={saveAircraft} className="inline-editor"><input name="registration" placeholder="Registration" required/><input name="aircraft_make" placeholder="Make"/><input name="aircraft_model" placeholder="Model"/><input name="aircraft_variant" placeholder="Variant"/><input name="aircraft_type" placeholder="Display type"/><input name="icao_type" placeholder="ICAO type"/><select name="aircraft_class" defaultValue="ULL"><option>ULL</option><option>SEP</option><option>TMG</option><option>MEP</option><option>SET</option><option>OTHER</option><option>GLIDER</option></select><select name="evidence" defaultValue="ULL"><option>ULL</option><option>EASA</option></select><select name="default_role" defaultValue="PIC"><option>PIC</option><option>SOLO</option><option>DUAL</option><option>SPIC</option><option>PICUS</option><option>INSTRUCTOR</option><option>EXAMINER</option><option>SAFETY PILOT</option><option>CO-PILOT</option><option>CRUISE-RELIEF CO-PILOT</option></select><select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select><button className="primary-button">Save aircraft</button></form></details></div></>;
}
