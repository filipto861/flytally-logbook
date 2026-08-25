"use client";

import { useState } from "react";
import { BackupCenter } from "@/components/backup-center";
import { BackupRestore } from "@/components/backup-restore";
import { FlightTrash } from "@/components/flight-trash";
import { LOGBOOK_PRINT_SCOPES } from "@/lib/logbook-print";
import type { StoredBackup } from "@/lib/backup-center";
import type { DeletedFlight } from "@/lib/flight-trash";
import type { RestoreState,TrashRestoreState } from "@/app/(protected)/export/actions";

type Section="export"|"backups"|"restore"|"trash";
type RestoreAction=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
type TrashAction=(state:TrashRestoreState,form:FormData)=>Promise<TrashRestoreState>;

export function DataHub({backups,deletedFlights,createAction,restoreStoredAction,restoreFileAction,restoreTrashAction}:{
  backups:StoredBackup[];
  deletedFlights:DeletedFlight[];
  createAction:()=>Promise<void>;
  restoreStoredAction:RestoreAction;
  restoreFileAction:RestoreAction;
  restoreTrashAction:TrashAction;
}){
  const [section,setSection]=useState<Section>("export");
  return <section className="data-hub">
    <nav className="data-hub-nav" aria-label="Data tools" role="tablist">
      <button type="button" role="tab" id="data-tab-export" aria-controls="data-panel-export" className={section==="export"?"active":""} aria-selected={section==="export"} onClick={()=>setSection("export")}><span>Print & export</span></button>
      <button type="button" role="tab" id="data-tab-backups" aria-controls="data-panel-backups" className={section==="backups"?"active":""} aria-selected={section==="backups"} onClick={()=>setSection("backups")}><span>Backups</span><b>{backups.length}</b></button>
      <button type="button" role="tab" id="data-tab-restore" aria-controls="data-panel-restore" className={section==="restore"?"active":""} aria-selected={section==="restore"} onClick={()=>setSection("restore")}><span>Restore file</span></button>
      <button type="button" role="tab" id="data-tab-trash" aria-controls="data-panel-trash" className={section==="trash"?"active":""} aria-selected={section==="trash"} onClick={()=>setSection("trash")}><span>Deleted flights</span>{deletedFlights.length?<b>{deletedFlights.length}</b>:null}</button>
    </nav>

    <div className="data-hub-content">
      {section==="export"?<div className="export-hub-workspace" role="tabpanel" id="data-panel-export" aria-labelledby="data-tab-export"><header className="workspace-heading"><p className="eyebrow">PRINT & EXPORT</p><h2>Choose one output</h2><p className="muted">Use the printable logbook for an official record. Excel and CSV are for your own data processing.</p></header>
        <section className="panel export-workspace" aria-label="Printable pilot logbook">
          <header><div><p className="eyebrow">PILOT LOGBOOK</p><h2>Printable logbook</h2><p className="muted">This is the single place for official print filters. Holder identity is taken automatically from Profile → Settings → Licences.</p></div></header>
          <form className="export-filter" action="/print" method="get">
            <label>Logbook content<select name="scope" defaultValue="all">{LOGBOOK_PRINT_SCOPES.map(scope=><option key={scope.value} value={scope.value}>{scope.label}</option>)}</select><small>Complete includes all selected records in one consistent logbook format.</small></label>
            <label>Auxiliary roles<select name="auxiliary" defaultValue="exclude"><option value="exclude">Exclude Safety Pilot / PAX / Observer</option><option value="include">Include for reference</option></select></label>
            <div className="export-format-actions"><button className="primary-button">Open printable logbook</button></div>
          </form>
          <p className="muted">EASA / ULL licence number, holder address and validity are maintained with the licence itself in Settings.</p>
        </section>

        <section className="panel export-workspace" aria-label="Export flight records">
          <header><div><p className="eyebrow">DATA EXPORT</p><h2>Flight records</h2><p className="muted">Create filtered Excel or CSV data without changing the official printable-logbook configuration.</p></div></header>
          <form className="export-filter" action="/api/export" method="get">
            <label>From<input type="date" name="from"/></label>
            <label>To<input type="date" name="to"/></label>
            <label>Logbook<select name="evidence"><option value="">All</option><option>ULL</option><option>EASA</option></select></label>
            <label>Registration<input name="registration" placeholder="OK-..."/></label>
            <label>Auxiliary roles<select name="auxiliary" defaultValue="exclude"><option value="exclude">Exclude Safety Pilot / PAX / Observer</option><option value="include">Include for reference</option></select></label>
            <div className="export-format-actions"><button className="primary-button" name="format" value="xls">Excel</button><button name="format" value="csv">CSV</button></div>
          </form>
        </section>

        <section className="panel export-workspace" aria-label="Complete account backup"><header><div><p className="eyebrow">BACKUP EXPORT</p><h2>Complete JSON backup</h2><p className="muted">Unfiltered portable account backup. Safety Pilot and all other records are always retained.</p></div></header><div className="data-hub-links"><a className="secondary-link" href="/api/export?format=json"><span>Complete JSON backup</span><b>Download</b></a></div></section>
      </div>:null}
      {section==="backups"?<div role="tabpanel" id="data-panel-backups" aria-labelledby="data-tab-backups"><header className="workspace-heading"><p className="eyebrow">DATA SAFETY</p><h2>Backups</h2><p className="muted">Automatic and manual recovery points for this account.</p></header><BackupCenter backups={backups} createAction={createAction} restoreAction={restoreStoredAction}/></div>:null}
      {section==="restore"?<div className="restore-workspace" role="tabpanel" id="data-panel-restore" aria-labelledby="data-tab-restore"><header className="workspace-heading"><p className="eyebrow">DATA SAFETY</p><h2>Restore from a file</h2><p className="muted">Select one FlyTally JSON backup. It will be validated automatically before you can restore anything.</p></header><BackupRestore action={restoreFileAction}/></div>:null}
      {section==="trash"?<div role="tabpanel" id="data-panel-trash" aria-labelledby="data-tab-trash"><header className="workspace-heading"><p className="eyebrow">RECOVERY</p><h2>Deleted flights</h2><p className="muted">Restore flights that were removed from the logbook.</p></header><FlightTrash flights={deletedFlights} restoreAction={restoreTrashAction}/></div>:null}
    </div>
  </section>;
}
