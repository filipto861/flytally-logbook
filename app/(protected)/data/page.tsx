import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { DataHub } from "@/components/data-hub";
import { createManualBackup,restoreDeletedFlight,restorePortableBackup,restoreStoredBackup } from "../export/actions";
import { ensureDailyBackup,listStoredBackups } from "@/lib/backup-center";
import { listDeletedFlights } from "@/lib/flight-trash";

export const metadata={title:"Export | FlyTally"};

export default async function DataPage(){
  const {userId}=await requireUser();const [,d,backups,deletedFlights]=await Promise.all([ensureDailyBackup(userId),getDashboardData(userId,"all"),listStoredBackups(userId),listDeletedFlights(userId)]);
  return <>
    <header className="page-header"><div><p className="eyebrow">PROFILE · DATA</p><h1>Export</h1><p className="muted">Printable logbook, data exports, backups and recovery in one workspace.</p></div></header>
    <section className="export-summary"><div><span>Flights</span><strong>{d.total.flights}</strong></div><div><span>BLOCK</span><strong>{formatDuration(d.total.minutes)}</strong></div><div><span>Landings</span><strong>{d.total.landings}</strong></div><div><span>GPS</span><strong>{d.gpsKm.toFixed(0)} km</strong></div></section>
    <DataHub backups={backups} deletedFlights={deletedFlights} createAction={createManualBackup} restoreStoredAction={restoreStoredBackup} restoreFileAction={restorePortableBackup} restoreTrashAction={restoreDeletedFlight}/>
  </>;
}
