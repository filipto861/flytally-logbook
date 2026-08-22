"use client";

import { useState } from "react";
import type { StoredBackup } from "@/lib/backup-center";
import type { RestoreState } from "@/app/(protected)/export/actions";

type RestoreAction=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
const kindLabel:Record<StoredBackup["kind"],string>={automatic:"Automatic",manual:"Manual",pre_restore:"Pre-restore"};
const size=(bytes:number)=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} kB`;

export function BackupCenter({backups,createAction,restoreAction}:{backups:StoredBackup[];createAction:()=>Promise<void>;restoreAction:RestoreAction}){
  const[selected,setSelected]=useState<number|null>(null),[state,setState]=useState<RestoreState>({}),[confirm,setConfirm]=useState(""),[pending,setPending]=useState(false);
  const run=async(id:number,intent:"preview"|"restore")=>{const data=new FormData();data.set("backup_id",String(id));data.set("intent",intent);if(intent==="restore"){data.set("preview_digest",state.preview?.digest||"");data.set("confirm",confirm)}setPending(true);setSelected(id);try{const next=await restoreAction({},data);setState(next);if(next.success){setConfirm("");setSelected(null)}}finally{setPending(false)}};
  return <section className="panel backup-center"><header><div><p className="eyebrow">BACKUP CENTER</p><h2>Stored account backups</h2></div><form action={createAction}><button className="primary-button">Create backup now</button></form></header>
    {state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">✓ {state.success}</p>:null}
    {backups.length?<div className="stored-backup-list">{backups.map(backup=><article key={backup.id} className={selected===backup.id?"selected":""}><div className="stored-backup-main"><span className={`backup-kind ${backup.kind}`}>{kindLabel[backup.kind]}</span><strong>{new Date(backup.createdAt).toLocaleString("en-GB")}</strong><small>v{backup.version} · {size(backup.compressedBytes)} · {backup.counts.flights||0} flights · {backup.counts.flight_tracks||0} GPS tracks</small></div><div className="stored-backup-actions"><a className="secondary-link" href={`/api/backups/${backup.id}`}>Download</a><button className="secondary-button" type="button" disabled={pending} onClick={()=>run(backup.id,"preview")}>{pending&&selected===backup.id?"Checking…":"Restore preview"}</button></div>{selected===backup.id&&state.preview?<div className="stored-restore-preview"><span>SHA-256 verified</span><b>{Object.values(state.preview.add).reduce((sum,value)=>sum+value,0)} missing records will be added</b><small>{Object.values(state.preview.skip).reduce((sum,value)=>sum+value,0)} existing records will remain unchanged</small><label>Type RESTORE<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label><button type="button" className="primary-button" disabled={pending||confirm.trim().toUpperCase()!=="RESTORE"} onClick={()=>run(backup.id,"restore")}>{pending?"Restoring…":"Restore missing data"}</button></div>:null}</article>)}</div>:<p className="empty-state">No stored backups yet.</p>}
  </section>;
}
