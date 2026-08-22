import { requireUser } from "@/lib/auth/require-user";
import { formatDuration,getDashboardData } from "@/lib/data/dashboard";
import { BackupValidator } from "@/components/backup-validator";
import { BackupRestore } from "@/components/backup-restore";
import { restorePortableBackup } from "./actions";

export const metadata={title:"Export | FlyTally"};

export default async function ExportPage(){
  const {userId}=await requireUser();const d=await getDashboardData(userId,"all");
  return <>
    <header className="page-header"><div><p className="eyebrow">DATA</p><h1>Export</h1></div></header>
    <section className="export-summary"><div><span>Flights</span><strong>{d.total.flights}</strong></div><div><span>BLOCK</span><strong>{formatDuration(d.total.minutes)}</strong></div><div><span>Landings</span><strong>{d.total.landings}</strong></div><div><span>GPS</span><strong>{d.gpsKm.toFixed(0)} km</strong></div></section>
    <form className="panel export-filter" action="/api/export" method="get"><label>From<input type="date" name="from"/></label><label>To<input type="date" name="to"/></label><label>Logbook<select name="evidence"><option value="">All</option><option>ULL</option><option>EASA</option></select></label><label>Registration<input name="registration" placeholder="OK-..."/></label><button className="primary-button" name="format" value="xls">Excel</button><button name="format" value="csv">CSV</button></form>
    <section className="export-grid"><article className="panel export-card"><i>▦</i><h2>Excel</h2></article><article className="panel export-card"><i>≡</i><h2>CSV</h2></article><article className="panel export-card"><i>⛁</i><h2>Complete account backup</h2><a className="primary-link" href="/api/export?format=json">Download backup</a></article></section>
    <BackupValidator/><BackupRestore action={restorePortableBackup}/>
    <section className="panel print-panel"><div><p className="eyebrow">PRINT</p><h2>Printable pilot logbook</h2></div><a className="primary-link" href="/print">Open print view</a></section>
  </>;
}
