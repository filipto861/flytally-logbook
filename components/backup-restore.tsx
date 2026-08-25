"use client";

import { useState } from "react";
import type { RestoreState } from "@/app/(protected)/export/actions";

type Action=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
const labels:Record<string,string>={flights:"Flights",aircraft:"Aircraft",rates:"Rates",airports:"Custom airports",expiries:"Licences / documents",flight_tracks:"GPS tracks",track_points:"Legacy GPS points",audit_log:"Audit events",fstd_sessions:"FSTD sessions",flight_certified_revisions:"Flight revisions",fstd_certified_revisions:"FSTD revisions",deleted_flights:"Trash records"};

export function BackupRestore({action}:{action:Action}){
  const [file,setFile]=useState<File|null>(null),[state,setState]=useState<RestoreState>({}),[confirm,setConfirm]=useState(""),[pending,setPending]=useState(false);
  const preview=state.preview;
  const run=async(intent:"preview"|"restore")=>{if(!file){setState({error:"Select a complete JSON backup."});return}const data=new FormData();data.set("backup",file);data.set("intent",intent);if(intent==="restore"){data.set("preview_digest",state.preview?.digest||"");data.set("confirm",confirm)}setPending(true);try{const next=await action({},data);setState(next);if(next.success){setConfirm("");setFile(null)}}finally{setPending(false)}};
  const certified=preview?.certification;
  return <section className="panel backup-restore"><div><p className="eyebrow">SAFE RESTORE</p><h2>{preview?.accountBound?"Backup is ready":"Select a backup"}</h2><p className="muted">FlyTally checks the file and shows exactly what can be restored. Existing records are never overwritten.</p></div>
    <label className="backup-file">Backup file<input type="file" accept="application/json,.json" onChange={event=>{setFile(event.target.files?.[0]||null);setState({});setConfirm("")}}/></label>
    <div className="backup-actions"><button type="button" className="secondary-button" disabled={pending||!file} onClick={()=>run("preview")}>{pending?"Checking…":"Check backup"}</button></div>
    {state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">✓ {state.success}</p>:null}
    {preview?<div className="restore-preview"><header><div><strong>✓ Backup validated</strong><small>Created {preview.exportedAt?new Date(preview.exportedAt).toLocaleString("en-GB"):"date unavailable"}</small></div><span>Integrity verified</span></header>{certified?<p className="form-success">✓ Certified records and revision history are valid.</p>:null}<div className="restore-grid">{Object.keys(preview.source).map(key=><article key={key}><strong>{labels[key]||key.replaceAll("_"," ")}</strong><span><b>{preview.add[key]||0}</b> to restore</span><small>{preview.skip[key]||0} already present</small></article>)}</div><div className="restore-confirm"><label>Type RESTORE to confirm<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label><button type="button" className="primary-button" disabled={pending||confirm.trim().toUpperCase()!=="RESTORE"} onClick={()=>run("restore")}>{pending?"Restoring…":"Restore missing data"}</button></div></div>:null}
  </section>;
}
