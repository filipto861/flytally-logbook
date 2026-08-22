import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { DataHub } from "@/components/data-hub";
import { createManualBackup,restoreDeletedFlight,restorePortableBackup,restoreStoredBackup } from "./actions";
import { ensureDailyBackup,listStoredBackups } from "@/lib/backup-center";
import { listDeletedFlights } from "@/lib/flight-trash";

export const metadata={title:"Export | FlyTally"};

export default async function ExportPage(){
  const {userId}=await requireUser();await ensureDailyBackup(userId);const [d,backups,deletedFlights]=await Promise.all([getDashboardData(userId,"all"),listStoredBackups(userId),listDeletedFlights(userId)]);
  return <>
    <header className="page-header"><div><p className="eyebrow">DATA</p><h1>Data Hub</h1></div></header>
    <section className="export-summary"><div><span>Flights</span><strong>{d.total.flights}</strong></div><div><span>BLOCK</span><strong>{formatDuration(d.total.minutes)}</strong></div><div><span>Landings</span><strong>{d.total.landings}</strong></div><div><span>GPS</span><strong>{d.gpsKm.toFixed(0)} km</strong></div></section>
    <DataHub backups={backups} deletedFlights={deletedFlights} createAction={createManualBackup} restoreStoredAction={restoreStoredBackup} restoreFileAction={restorePortableBackup} restoreTrashAction={restoreDeletedFlight}/>
  </>;
}
