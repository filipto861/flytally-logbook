import { FlightForm } from "@/components/flight-form";
import { IntelligentFlightEntryPanel } from "@/components/intelligent-flight-entry-panel";
import { requireUser } from "@/lib/auth/require-user";
import { getAircraftOptions } from "@/lib/data/aircraft";
import { createFlight,detectTrackAirports,importKmlFlight } from "../actions";
import { KmlImportForm } from "@/components/kml-import-form";
import { getManualEntryDefaults } from "@/lib/data/flights";
import { FlightEntryWorkspace } from "@/components/flight-entry-workspace";
import { saveAircraftWithResult } from "@/app/(protected)/database/actions";
import { sql } from "@/lib/db";
import { getIntelligentEntryContext } from "@/lib/intelligent-logbook-service";
import { getAcceptedPicConnections } from "@/lib/flight-connected-crew";
import { getUserSaveableCalendarDefault } from "@/lib/data/user-calendar";

export default async function NewFlightPage({searchParams}:{searchParams:Promise<{mode?:string;added?:string;departure?:string}>}) {
  const {userId}=await requireUser(),params=await searchParams,initialMode=params.mode==="gps"?"gps":"manual";
  const [aircraft,defaults,calendarDefault,instructorRows,picConnections,intelligentContext]=await Promise.all([
    getAircraftOptions(userId),
    getManualEntryDefaults(userId),
    getUserSaveableCalendarDefault(userId),
    sql`SELECT DISTINCT u.display_name FROM pilot_connections c JOIN users u ON u.id=CASE WHEN c.requester_user_id=${userId} THEN c.recipient_user_id ELSE c.requester_user_id END WHERE c.status='accepted' AND ((c.requester_user_id=${userId} AND c.requester_label='instructor') OR (c.recipient_user_id=${userId} AND c.recipient_label='instructor')) ORDER BY u.display_name` as Promise<Array<Record<string,unknown>>>,
    getAcceptedPicConnections(userId),
    getIntelligentEntryContext(userId),
  ]);
  const instructors=instructorRows.map(row=>({name:String(row.display_name??"").trim()})).filter(item=>item.name),manualInitial={...defaults,departure:params.departure?params.departure.trim().toUpperCase():defaults.departure},manualFormId="new-flight-manual-form";
  return <div className="ui-page-stack"><header className="page-header"><div><p className="eyebrow">LOGBOOK</p><h1>New flight</h1></div></header>{params.added==="1"?<div className="saved-next-flight" role="status"><strong>Flight saved.</strong><span>Ready for the next entry.</span></div>:null}<FlightEntryWorkspace initialMode={initialMode} gps={<KmlImportForm action={importKmlFlight} airportAction={detectTrackAirports} aircraft={aircraft} picConnections={picConnections}/>} manual={<><FlightForm formId={manualFormId} action={createFlight} aircraft={aircraft} initial={manualInitial} calendarDefault={calendarDefault} instructors={instructors} picConnections={picConnections}/><IntelligentFlightEntryPanel context={intelligentContext} formId={manualFormId}/></>} aircraftAction={saveAircraftWithResult} aircraftCount={aircraft.length}/></div>;
}
