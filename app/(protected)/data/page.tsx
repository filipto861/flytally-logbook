import { requireUser } from "@/lib/auth/require-user";
import { DataHub } from "@/components/data-hub";
import { createManualBackup,restoreDeletedFlight,restorePortableBackup,restoreStoredBackup } from "../export/actions";
import { ensureDailyBackup,listStoredBackups } from "@/lib/backup-center";
import { listDeletedFlights } from "@/lib/flight-trash";

export const metadata={title:"Print & data | FlyTally"};

export default async function DataPage(){
  const {userId}=await requireUser();const [,backups,deletedFlights]=await Promise.all([ensureDailyBackup(userId),listStoredBackups(userId),listDeletedFlights(userId)]);
  return <>
    <header className="page-header"><div><p className="eyebrow">LOGBOOK OUTPUT & SAFETY</p><h1>Print & data</h1><p className="muted">Print the logbook, export records or recover account data.</p></div></header>
    <DataHub backups={backups} deletedFlights={deletedFlights} createAction={createManualBackup} restoreStoredAction={restoreStoredBackup} restoreFileAction={restorePortableBackup} restoreTrashAction={restoreDeletedFlight}/>
  </>;
}
