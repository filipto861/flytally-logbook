import { BackupCenter } from "@/components/backup-center";
import { BackupRestore } from "@/components/backup-restore";
import { FlightTrash } from "@/components/flight-trash";
import { LOGBOOK_OUTPUT_CATEGORIES,LOGBOOK_PRINT_SCOPES } from "@/lib/logbook-print";
import type { StoredBackup } from "@/lib/backup-center";
import type { DeletedFlight } from "@/lib/flight-trash";
import type { RestoreState,TrashRestoreState } from "@/app/(protected)/export/actions";
import type { DataWorkspaceView } from "@/components/data-workspace-navigation";

type RestoreAction=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
type TrashAction=(state:TrashRestoreState,form:FormData)=>Promise<TrashRestoreState>;

export function DataHub({view,timeZone,backups=[],deletedFlights=[],createAction,restoreStoredAction,restoreFileAction,restoreTrashAction}:{
  view:DataWorkspaceView;
  timeZone:string;
  backups?:StoredBackup[];
  deletedFlights?:DeletedFlight[];
  createAction:()=>Promise<void>;
  restoreStoredAction:RestoreAction;
  restoreFileAction:RestoreAction;
  restoreTrashAction:TrashAction;
}){
  if(view==="recovery")return <main className="u32-data-workspace">
    <section className="u32-workspace-heading"><div><p className="eyebrow">BACKUP & RESTORE</p><h2>Keep a recoverable copy of your logbook</h2><p className="muted">Use FlyTally recovery points for normal recovery. Download a portable backup when you want an independent copy outside FlyTally.</p></div></section>
    <section className="u32-recovery-grid">
      <div className="u32-recovery-primary"><BackupCenter backups={backups} createAction={createAction} restoreAction={restoreStoredAction} timeZone={timeZone}/></div>
      <aside className="panel u32-portable-backup"><div><p className="eyebrow">PORTABLE COPY</p><h2>Download complete backup</h2><p className="muted">A complete JSON account backup for your own archive or later recovery.</p></div><a className="primary-button" href="/api/export?format=json">Download JSON backup</a><details><summary>What is included?</summary><p className="muted">The portable backup keeps the account data needed by FlyTally recovery, including logbook records, protected certification history and supported settings. Shared workflow state remains subject to recovery authenticity rules.</p></details></aside>
    </section>
    <section className="u32-file-restore">
      <header className="u32-section-heading"><div><p className="eyebrow">RESTORE FROM FILE</p><h2>Use an existing FlyTally backup</h2><p className="muted">The file is validated and compared with this account before anything can be restored. Existing records are not overwritten.</p></div></header>
      <BackupRestore action={restoreFileAction} timeZone={timeZone}/>
    </section>
  </main>;

  if(view==="deleted")return <main className="u32-data-workspace">
    <section className="u32-workspace-heading"><div><p className="eyebrow">RECOVERY</p><h2>Deleted flights</h2><p className="muted">Restore flights that were removed from your logbook. This is separate from full account backup recovery.</p></div></section>
    <FlightTrash flights={deletedFlights} restoreAction={restoreTrashAction} timeZone={timeZone}/>
  </main>;

  return <main className="u32-data-workspace">
    <section className="u32-workspace-heading"><div><p className="eyebrow">PRINT & EXPORT</p><h2>Get your logbook out of FlyTally</h2><p className="muted">Print a pilot logbook or export flight rows for your own processing. Backup and recovery tools live in their own section.</p></div></section>
    <section className="u32-output-grid">
      <article className="panel u32-output-card">
        <header><div><p className="eyebrow">PILOT LOGBOOK</p><h2>Printable logbook</h2><p className="muted">Open a print-ready logbook for the complete history or a selected period.</p></div><span className="u32-output-kind">PRINT</span></header>
        <form className="u32-output-form" action="/print" method="get">
          <div className="u32-date-range"><label>From<input type="date" name="from"/><small>Optional</small></label><label>To<input type="date" name="to"/><small>Optional</small></label></div>
          <label>Logbook content<select name="scope" defaultValue="all">{LOGBOOK_PRINT_SCOPES.map(scope=><option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
          <label>Regulatory category<select name="category" defaultValue="all">{LOGBOOK_OUTPUT_CATEGORIES.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label>Auxiliary roles<select name="auxiliary" defaultValue="exclude"><option value="exclude">Exclude Safety Pilot / PAX / Observer</option><option value="include">Include for reference</option></select></label>
          <button className="primary-button">Open printable logbook</button>
        </form>
        <details className="u32-output-details"><summary>Output details</summary><p className="muted">Holder identity comes from Licences. Part-FCL/powered records keep the established FCL.050 view. Sailplane, Balloon and Other are structured FlyTally print views, not authority-issued forms. FSTD is shown only when no regulatory-category filter is active.</p></details>
      </article>

      <article className="panel u32-output-card">
        <header><div><p className="eyebrow">FLIGHT DATA</p><h2>Excel or CSV</h2><p className="muted">Export stored flight records for spreadsheets, analysis or your own archive.</p></div><span className="u32-output-kind">DATA</span></header>
        <form className="u32-output-form" action="/api/export" method="get">
          <div className="u32-date-range"><label>From<input type="date" name="from"/></label><label>To<input type="date" name="to"/></label></div>
          <label>Logbook content<select name="scope" defaultValue="all">{LOGBOOK_PRINT_SCOPES.map(scope=><option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>
          <label>Regulatory category<select name="category" defaultValue="all">{LOGBOOK_OUTPUT_CATEGORIES.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label>Registration<input name="registration" placeholder="OK-..."/><small>Optional</small></label>
          <label>Auxiliary roles<select name="auxiliary" defaultValue="exclude"><option value="exclude">Exclude Safety Pilot / PAX / Observer</option><option value="include">Include for reference</option></select></label>
          <div className="u32-export-actions"><button className="primary-button" name="format" value="xls">Download Excel</button><button className="secondary-button" name="format" value="csv">Download CSV</button></div>
        </form>
        <details className="u32-output-details"><summary>Excel vs CSV</summary><p className="muted">Excel includes filtered flight rows and a category-aware summary. CSV contains filtered flight rows only. FSTD is included only when no regulatory-category filter is active because FSTD sessions do not store a flight regulatory-category snapshot.</p></details>
      </article>
    </section>
  </main>;
}
