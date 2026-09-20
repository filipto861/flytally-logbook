"use client";

import { useState } from "react";
import type { RestoreState } from "@/app/(protected)/export/actions";
import { buildRecoveryPreviewSummary } from "@/lib/recovery-preview";

type Action=(state:RestoreState,form:FormData)=>Promise<RestoreState>;

export function BackupRestore({action}:{action:Action}){
  const [file,setFile]=useState<File|null>(null),[state,setState]=useState<RestoreState>({}),[confirm,setConfirm]=useState(""),[pending,setPending]=useState(false);
  const preview=state.preview,summary=preview?buildRecoveryPreviewSummary(preview):null;
  const run=async(intent:"preview"|"restore")=>{if(!file){setState({error:"Select a complete JSON backup."});return}const data=new FormData();data.set("backup",file);data.set("intent",intent);if(intent==="restore"){data.set("preview_digest",state.preview?.digest||"");data.set("confirm",confirm)}setPending(true);try{const next=await action({},data);setState(next);if(next.success){setConfirm("");setFile(null)}}finally{setPending(false)}};
  const certified=preview?.certification;
  return <section className="panel backup-restore"><div><p className="eyebrow">SAFE RESTORE</p><h2>{preview?.accountBound?"Backup is ready":"Select a backup"}</h2><p className="muted">FlyTally validates the backup first, compares it with this account and restores only missing records. Existing records are never overwritten.</p></div>
    <label className="backup-file">Backup file<input type="file" accept="application/json,.json" onChange={event=>{setFile(event.target.files?.[0]||null);setState({});setConfirm("")}}/></label>
    <div className="backup-actions"><button type="button" className="secondary-button" disabled={pending||!file} aria-busy={pending||undefined} data-loading={pending?"true":undefined} onClick={()=>run("preview")}>{pending?"Checking…":"Check backup"}</button></div>
    {state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}
    {state.conflict?<div className="credential-card"><div className="entry-section-body"><p className="eyebrow">RECOVERY BLOCKED</p><strong>{state.conflict.title}</strong><p className="muted">{state.conflict.detail}</p><small>{state.conflict.record}</small></div></div>:null}
    {preview&&summary?<div className="restore-preview">
      <header><div><strong>Backup validated</strong><small>Created {preview.exportedAt?new Date(preview.exportedAt).toLocaleString("en-GB"):"date unavailable"}</small></div><span>{preview.authenticity==="verified"||preview.authenticity==="stored"?"Authenticity verified":"Integrity verified"}</span></header>
      {preview.accountBound?<p className="muted">This is non-destructive recovery. FlyTally will add missing records only; matching records remain unchanged and any authoritative-history conflict stops recovery before data is changed.</p>:null}
      {preview.authenticity==="invalid"?<p className="form-error">Backup authenticity could not be verified. Personal recovery remains available, but missing shared workflow state will not be recreated from this file.</p>:preview.authenticity==="unsigned"?<p className="muted">Legacy unsigned backup: personal data can be recovered, while shared workflow state remains server-authoritative.</p>:null}
      {certified?<p className="form-success">Certified evidence verified: {certified.certifiedFlights} certified flight{certified.certifiedFlights===1?"":"s"}, {certified.flightRevisions} archived flight revision{certified.flightRevisions===1?"":"s"}, {certified.certifiedFstd} certified FSTD session{certified.certifiedFstd===1?"":"s"}.</p>:null}
      <div className="mini-metrics"><div><span>Missing data</span><b>{summary.missing}</b><small>{summary.missing?"Can be recovered":"Nothing missing"}</small></div><div><span>Already present</span><b>{summary.present}</b><small>Will not be overwritten</small></div><div><span>Protected evidence</span><b>{summary.protectedEvidence}</b><small>Revision, signature & audit records</small></div>{summary.settingsIncluded?<div><span>Account settings</span><b>Included</b><small>Recovered conservatively</small></div>:null}</div>
      <div className="credential-list">{summary.groups.map((group,index)=><details className="credential-card" key={group.id} open={index===0||group.protectedEvidence}>
        <summary className="credential-summary"><div className="credential-main"><span>{group.protectedEvidence?"PROTECTED EVIDENCE":"RECOVERY DATA"}</span><strong>{group.label}</strong><small>{group.description}</small></div><div className="credential-validity"><b className={group.missing||group.withheld?"status-warning":"status-on"}>{group.missing?`${group.missing} TO RESTORE`:group.withheld?`${group.withheld} SERVER-ONLY`:"COMPLETE"}</b><small>{group.present} already present{group.withheld?` · ${group.withheld} withheld`:""}</small></div><span className="credential-chevron" aria-hidden="true">⌄</span></summary>
        <div className="entry-section-body"><div className="restore-grid">{group.items.map(item=><article key={item.key}><strong>{item.label}</strong><span><b>{item.missing}</b> to restore</span><small>{item.present} already present · {item.source} in backup{item.withheld?` · ${item.withheld} server-authoritative`:""}{item.protectedEvidence?" · protected evidence":""}</small></article>)}</div></div>
      </details>)}</div>
      {summary.withheld?<p className="muted">{summary.withheld} shared workflow record{summary.withheld===1?" is":"s are"} intentionally withheld from uploaded-file recovery because its server authenticity is not verified.</p>:null}
      {summary.missing===0?<p className="form-success">All recoverable records from this backup are already present. Running restore would not add data.</p>:null}
      <div className="restore-confirm"><label>Type RESTORE to confirm<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label><button type="button" className="primary-button" disabled={pending||confirm.trim().toUpperCase()!=="RESTORE"||summary.missing===0} aria-busy={pending||undefined} data-loading={pending?"true":undefined} onClick={()=>run("restore")}>{pending?"Restoring…":summary.missing?"Restore missing data":"Nothing to restore"}</button></div>
    </div>:null}
  </section>;
}
