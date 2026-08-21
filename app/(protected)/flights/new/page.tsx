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
  return <><header className="page-header"><div><p className="eyebrow">LETOVÝ DENÍK</p><h1>Nový let</h1><p className="muted">Import GPS tracku s povinnou kontrolou nebo ruční zápis</p></div></header><div className="new-flight-modes"><details className="panel" open><summary><span>01</span><div><strong>Import GPS tracku</strong><small>Navrhne rozdělení, letiště a časy; každý let se uloží až po vaší kontrole</small></div></summary><KmlImportForm action={importKmlFlight} airportAction={detectTrackAirports} aircraft={aircraft}/></details><details className="panel"><summary><span>02</span><div><strong>Ruční zápis</strong><small>Navazuje na poslední let a použije výchozí hodnoty profilu</small></div></summary><FlightForm action={createFlight} aircraft={aircraft} routes={routes} initial={defaults}/></details><details className="panel compact-create"><summary><span>＋</span><div><strong>Rychle přidat letadlo</strong><small>Stejně jako v původní aplikaci bez odcházení z formuláře</small></div></summary><form action={saveAircraft} className="inline-editor"><input name="registration" placeholder="Registrace" required/><input name="aircraft_type" placeholder="Typ letadla"/><input name="icao_type" placeholder="ICAO typ"/><select name="aircraft_class" defaultValue="ULL"><option>ULL</option><option>SEP</option><option>TMG</option><option>MEP</option><option>SET</option><option>OTHER</option><option>GLIDER</option></select><select name="evidence" defaultValue="ULL"><option>ULL</option><option>EASA</option></select><select name="default_role" defaultValue="PIC"><option>PIC</option><option>DUAL</option><option>INSTRUKTOR</option><option>SAFETY PILOT</option></select><select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select><button className="primary-button">Uložit letadlo</button></form></details></div></>;
}
