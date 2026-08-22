"use client";

import { useState } from "react";
import { BackupCenter } from "@/components/backup-center";
import { BackupRestore } from "@/components/backup-restore";
import { BackupValidator } from "@/components/backup-validator";
import { FlightTrash } from "@/components/flight-trash";
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
    <nav className="data-hub-nav" aria-label="Data tools">
      <button type="button" className={section==="export"?"active":""} aria-pressed={section==="export"} onClick={()=>setSection("export")}><span>Export</span></button>
      <button type="button" className={section==="backups"?"active":""} aria-pressed={section==="backups"} onClick={()=>setSection("backups")}><span>Backups</span><b>{backups.length}</b></button>
      <button type="button" className={section==="restore"?"active":""} aria-pressed={section==="restore"} onClick={()=>setSection("restore")}><span>Restore</span></button>
      <button type="button" className={section==="trash"?"active":""} aria-pressed={section==="trash"} onClick={()=>setSection("trash")}><span>Trash</span>{deletedFlights.length?<b>{deletedFlights.length}</b>:null}</button>
    </nav>

    <div className="data-hub-content">
      {section==="export"?<section className="panel export-workspace" aria-label="Export flight records">
        <header><div><p className="eyebrow">EXPORT</p><h2>Flight records</h2></div></header>
        <form className="export-filter" action="/api/export" method="get">
          <label>From<input type="date" name="from"/></label>
          <label>To<input type="date" name="to"/></label>
          <label>Logbook<select name="evidence"><option value="">All</option><option>ULL</option><option>EASA</option></select></label>
          <label>Registration<input name="registration" placeholder="OK-..."/></label>
          <div className="export-format-actions"><button className="primary-button" name="format" value="xls">Excel</button><button name="format" value="csv">CSV</button></div>
        </form>
        <div className="data-hub-links"><a className="secondary-link" href="/api/export?format=json"><span>Complete JSON backup</span><b>Download</b></a><a className="secondary-link" href="/print"><span>Printable logbook</span><b>Open</b></a></div>
      </section>:null}
      {section==="backups"?<BackupCenter backups={backups} createAction={createAction} restoreAction={restoreStoredAction}/>:null}
      {section==="restore"?<div className="restore-workspace"><BackupValidator/><BackupRestore action={restoreFileAction}/></div>:null}
      {section==="trash"?<FlightTrash flights={deletedFlights} restoreAction={restoreTrashAction}/>:null}
    </div>
  </section>;
}
