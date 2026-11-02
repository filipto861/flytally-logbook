"use client";

import { useState } from "react";
import type { RestoreState } from "@/app/(protected)/export/actions";
import { buildRecoveryPreviewSummary } from "@/lib/recovery-preview";
import { formatLocalDateTime } from "@/lib/display-format";
import { ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE } from "@/lib/account-restore-containment";

type Action=(state:RestoreState,form:FormData)=>Promise<RestoreState>;

export function BackupRestore({action,timeZone}:{action:Action;timeZone:string}){
  const [file,setFile]=useState<File|null>(null),[state,setState]=useState<RestoreState>({}),[pending,setPending]=useState(false);
  const preview=state.preview,summary=preview?buildRecoveryPreviewSummary(preview):null;
  const run=async()=>{if(pending)return;if(!file){setState({error:"Select a complete JSON backup."});return}const data=new FormData();data.set("backup",file);data.set("intent","preview");setPending(true);try{const next=await action({},data);setState(next)}finally{setPending(false)}};
  const certified=preview?.certification;
  return <section className="panel backup-restore"><div><p className="eyebrow">BACKUP CHECK</p><h2>{preview?.accountBound?"Backup checked":"Select a backup"}</h2><p className="muted">Check a JSON backup against this account without starting a full-account restore.</p></div>
    <p className="muted" role="status">{ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE}</p>
    <label className="backup-file">Backup file<input type="file" accept="application/json,.json" onChange={event=>{setFile(event.target.files?.[0]||null);setState({})}}/></label>
    <div className="backup-actions"><button type="button" className="secondary-button" disabled={pending||!file} aria-busy={pending||undefined} data-loading={pending?"true":undefined} onClick={run}>{pending?"Checking…":"Check backup"}</button></div>
    {state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}
    {state.conflict?<div className="credential-card"><div className="entry-section-body"><p className="eyebrow">RECOVERY BLOCKED</p><strong>{state.conflict.title}</strong><p className="muted">{state.conflict.detail}</p><small>{state.conflict.record}</small></div></div>:null}
    {preview&&summary?<div className="restore-preview">
      <header><div><strong>Backup validated</strong><small>Created {preview.exportedAt?formatLocalDateTime(preview.exportedAt,timeZone):"date unavailable"}</small></div><span>{preview.authenticity==="verified"||preview.authenticity==="stored"?"Authenticity verified":"Integrity verified"}</span></header>
      {preview.accountBound?<p className="muted">This check compares the backup with existing records. Full account restore is currently unavailable.</p>:null}
      {preview.authenticity==="invalid"?<p className="form-error">Backup authenticity could not be verified. Full account restore remains unavailable.</p>:preview.authenticity==="unsigned"?<p className="muted">Legacy unsigned backup: full account restore is unavailable. The preview does not grant trust to shared records.</p>:null}
      {certified?<p className="form-success">Certified evidence verified: {certified.certifiedFlights} certified flight{certified.certifiedFlights===1?"":"s"}, {certified.flightRevisions} archived flight revision{certified.flightRevisions===1?"":"s"}, {certified.certifiedFstd} certified FSTD session{certified.certifiedFstd===1?"":"s"}.</p>:null}
      <div className="mini-metrics"><div><span>Missing data</span><b>{summary.missing}</b><small>{summary.missing?"Identified as missing":"Nothing missing"}</small></div><div><span>Already present</span><b>{summary.present}</b><small>Will not be overwritten</small></div><div><span>Protected evidence</span><b>{summary.protectedEvidence}</b><small>Revision, signature & audit records</small></div>{summary.settingsIncluded?<div><span>Account settings</span><b>Included</b><small>Recovered conservatively</small></div>:null}</div>
      <div className="credential-list">{summary.groups.map((group,index)=><details className="credential-card" key={group.id} open={index===0||group.protectedEvidence}>
        <summary className="credential-summary"><div className="credential-main"><span>{group.protectedEvidence?"PROTECTED EVIDENCE":"RECOVERY DATA"}</span><strong>{group.label}</strong><small>{group.description}</small></div><div className="credential-validity"><b className={group.missing||group.withheld?"status-warning":"status-on"}>{group.missing?`${group.missing} MISSING`:group.withheld?`${group.withheld} SERVER-ONLY`:"COMPLETE"}</b><small>{group.present} already present{group.withheld?` · ${group.withheld} withheld`:""}</small></div><span className="credential-chevron" aria-hidden="true">⌄</span></summary>
        <div className="entry-section-body"><div className="restore-grid">{group.items.map(item=><article key={item.key}><strong>{item.label}</strong><span><b>{item.missing}</b> missing</span><small>{item.present} already present · {item.source} in backup{item.withheld?` · ${item.withheld} server-authoritative`:""}{item.protectedEvidence?" · protected evidence":""}</small></article>)}</div></div>
      </details>)}</div>
      {summary.withheld?<p className="muted">{summary.withheld} shared workflow record{summary.withheld===1?" is":"s are"} intentionally withheld from uploaded-file recovery because its server authenticity is not verified.</p>:null}
      {summary.missing===0?<p className="form-success">All checked records from this backup are already present.</p>:null}

    </div>:null}
  </section>;
}
