"use client";

import { useState } from "react";
import { PendingActionButton } from "@/components/pending-action-button";
import type { StoredBackup } from "@/lib/backup-center";
import type { RestoreState } from "@/app/(protected)/export/actions";
import { buildRecoveryPreviewSummary } from "@/lib/recovery-preview";
import { formatLocalDateTime } from "@/lib/display-format";

type RestoreAction=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
const kindLabel:Record<StoredBackup["kind"],string>={automatic:"Automatic",manual:"Manual",pre_restore:"Pre-restore"};
const size=(bytes:number)=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} kB`;

export function BackupCenter({backups,createAction,restoreAction,timeZone}:{backups:StoredBackup[];createAction:()=>Promise<void>;restoreAction:RestoreAction;timeZone:string}){
  const[selected,setSelected]=useState<number|null>(null),[state,setState]=useState<RestoreState>({}),[confirm,setConfirm]=useState(""),[pending,setPending]=useState(false),[showAll,setShowAll]=useState(false);
  const preview=state.preview,summary=preview?buildRecoveryPreviewSummary(preview):null;
  const run=async(id:number,intent:"preview"|"restore")=>{const data=new FormData();data.set("backup_id",String(id));data.set("intent",intent);if(intent==="restore"){data.set("preview_digest",state.preview?.digest||"");data.set("confirm",confirm)}else{setState({});setConfirm("")}setPending(true);setSelected(id);try{const next=await restoreAction({},data);setState(next);if(next.success){setConfirm("");setSelected(null)}}finally{setPending(false)}};
  return <section className="panel backup-center"><header><div><p className="eyebrow">BACKUP CENTER</p><h2>Stored account backups</h2></div><form action={createAction}><PendingActionButton className="primary-button" pendingLabel="Creating…">Create backup now</PendingActionButton></form></header>
    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.success?<p className="form-success" role="status">{state.success}</p>:null}
    {backups.length?<><div className="stored-backup-list">{(showAll?backups:backups.slice(0,6)).map(backup=><article key={backup.id} className={selected===backup.id?"selected":""}>
      <div className="stored-backup-main"><span className={`backup-kind ${backup.kind}`}>{kindLabel[backup.kind]}</span><strong>{formatLocalDateTime(backup.createdAt,timeZone)}</strong><small>v{backup.version} · {size(backup.compressedBytes)} · {backup.counts.flights||0} flights · {backup.counts.flight_tracks||0} GPS tracks</small></div>
      <div className="stored-backup-actions"><a className="secondary-link" href={`/api/backups/${backup.id}`}>Download</a><button className="secondary-button" type="button" disabled={pending} aria-busy={pending||undefined} data-loading={pending?"true":undefined} onClick={()=>run(backup.id,"preview")}>{pending&&selected===backup.id?"Checking…":"Restore preview"}</button></div>
      {selected===backup.id&&state.conflict?<div className="stored-restore-preview"><span>RECOVERY BLOCKED</span><b>{state.conflict.title}</b><small>{state.conflict.detail}</small><small>{state.conflict.record}</small></div>:null}
      {selected===backup.id&&preview&&summary?<div className="stored-restore-preview"><span>{preview.authenticity==="stored"?"Stored FlyTally backup · trusted recovery":"SHA-256 verified · non-destructive recovery"}</span><b>{summary.missing} missing records will be added</b><small>{summary.present} existing records will remain unchanged · {summary.protectedEvidence} protected evidence records validated{summary.withheld?` · ${summary.withheld} shared records withheld`:""}</small>
        {preview.certification?<small>Certified history verified: {preview.certification.certifiedFlights} certified flights · {preview.certification.flightRevisions} archived flight revisions · {preview.certification.certifiedFstd} certified FSTD sessions.</small>:null}
        <details><summary>Review recovery groups</summary><div className="qualification-list">{summary.groups.map(group=><div key={group.id}><span><strong>{group.label}</strong><small>{group.description}</small></span><span><strong>{group.missing} to restore</strong><small>{group.present} already present{group.withheld?` · ${group.withheld} server-authoritative`:""}{group.protectedEvidence?" · protected evidence":""}</small></span></div>)}</div></details>
        {summary.withheld?<small>{summary.withheld} shared workflow records remain server-authoritative and will not be recreated from an untrusted file.</small>:null}
        {summary.missing===0?<small>All recoverable records from this backup are already present.</small>:null}
        <label>Type RESTORE<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label><button type="button" className="primary-button" disabled={pending||confirm.trim().toUpperCase()!=="RESTORE"||summary.missing===0} aria-busy={pending||undefined} data-loading={pending?"true":undefined} onClick={()=>run(backup.id,"restore")}>{pending?"Restoring…":summary.missing?"Restore missing data":"Nothing to restore"}</button></div>:null}
    </article>)}</div>{backups.length>6?<button type="button" className="backup-history-toggle" onClick={()=>setShowAll(value=>!value)}>{showAll?"Show recent only":`Show all ${backups.length} backups`}</button>:null}</>:<p className="empty-state">No stored backups yet.</p>}
  </section>;
}
