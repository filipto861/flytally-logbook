import { requireUser } from "@/lib/auth/require-user";
import { DataHub } from "@/components/data-hub";
import { DataWorkspaceNavigation,type DataWorkspaceView } from "@/components/data-workspace-navigation";
import { createManualBackup,restoreDeletedFlight,restorePortableBackup,restoreStoredBackup } from "../export/actions";
import { ensureDailyBackup,listStoredBackups } from "@/lib/backup-center";
import { listDeletedFlights } from "@/lib/flight-trash";

export const metadata={title:"Print & data | FlyTally"};

type Params={view?:string};
const resolveView=(value:unknown):DataWorkspaceView=>value==="recovery"||value==="deleted"?value:"export";

export default async function DataPage({searchParams}:{searchParams:Promise<Params>}){
  const{userId}=await requireUser(),params=await searchParams,view=resolveView(params.view);
  let backups=await Promise.resolve([] as Awaited<ReturnType<typeof listStoredBackups>>),deletedFlights=await Promise.resolve([] as Awaited<ReturnType<typeof listDeletedFlights>>);
  if(view==="recovery"){await ensureDailyBackup(userId);backups=await listStoredBackups(userId)}
  if(view==="deleted")deletedFlights=await listDeletedFlights(userId);

  const lead=view==="export"?"Print or export the records you need.":view==="recovery"?"Create, download or restore recoverable copies of your account data.":"Recover flights removed from your personal logbook.";
  return <div className="ui-page-stack">
    <header className="page-header"><div><p className="eyebrow">LOGBOOK OUTPUT & SAFETY</p><h1>Print & data</h1><p className="muted page-lead">{lead}</p></div></header>
    <DataWorkspaceNavigation active={view}/>
    <DataHub view={view} backups={backups} deletedFlights={deletedFlights} createAction={createManualBackup} restoreStoredAction={restoreStoredBackup} restoreFileAction={restorePortableBackup} restoreTrashAction={restoreDeletedFlight}/>
  </div>;
}
