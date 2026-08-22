"use client";

import { useState } from "react";
import type { RestoreState } from "@/app/(protected)/export/actions";

type Action=(state:RestoreState,form:FormData)=>Promise<RestoreState>;
const labels:Record<string,string>={flights:"Lety",aircraft:"Letadla",rates:"Cenové sazby",airports:"Vlastní letiště",expiries:"Platnosti",flight_tracks:"GPS tracky"};

export function BackupRestore({action}:{action:Action}){
  const [file,setFile]=useState<File|null>(null),[state,setState]=useState<RestoreState>({}),[confirm,setConfirm]=useState(""),[pending,setPending]=useState(false);
  const preview=state.preview;
  const run=async(intent:"preview"|"restore")=>{if(!file){setState({error:"Vyberte soubor úplné JSON zálohy."});return}const data=new FormData();data.set("backup",file);data.set("intent",intent);if(intent==="restore"){data.set("preview_digest",state.preview?.digest||"");data.set("confirm",confirm)}setPending(true);try{const next=await action({},data);setState(next);if(next.success){setConfirm("");setFile(null)}}finally{setPending(false)}};
  return <section className="panel backup-restore"><div><p className="eyebrow">BEZPEČNÁ OBNOVA</p><h2>Doplnit data z úplné zálohy</h2><p className="muted">Obnova je nedestruktivní: nejdříve zobrazí rozdíly, následně doplní pouze chybějící záznamy v jediné transakci. Existující lety, GPS tracky a historické ceny nepřepisuje.</p></div>
    <label className="backup-file">Soubor zálohy<input type="file" accept="application/json,.json" onChange={event=>{setFile(event.target.files?.[0]||null);setState({});setConfirm("")}}/></label>
    <div className="backup-actions"><button type="button" className="secondary-button" disabled={pending||!file} onClick={()=>run("preview")}>{pending?"Kontroluji…":"1. Ověřit a zobrazit náhled"}</button></div>
    {state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">✓ {state.success}</p>:null}
    {preview?<div className="restore-preview"><header><div><strong>✓ Soubor je nepoškozený</strong><small>Export: {preview.exportedAt?new Date(preview.exportedAt).toLocaleString("cs-CZ"):"datum neuvedeno"}</small></div><span>SHA-256 ověřeno</span></header><div className="restore-grid">{Object.keys(preview.source).map(key=><article key={key}><strong>{labels[key]||key}</strong><span><b>{preview.add[key]||0}</b> doplnit</span><small>{preview.skip[key]||0} již existuje</small></article>)}</div>{preview.settings?<p>Nastavení profilu bude obnoveno ze zálohy. Současná letová data zůstanou zachována.</p>:null}{preview.legacyPoints?<p className="restore-note">Záloha obsahuje {preview.legacyPoints.toLocaleString("cs-CZ")} starších bodů cache. Geometrie GPS se obnovuje z úplných dat uložených přímo u tracků; odvozená cache se znovu nezapisuje.</p>:null}<div className="restore-confirm"><label>Pro potvrzení napište OBNOVIT<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label><button type="button" className="primary-button" disabled={pending||confirm.trim().toUpperCase()!=="OBNOVIT"} onClick={()=>run("restore")}>{pending?"Obnovuji…":"2. Doplnit chybějící data"}</button></div></div>:null}
  </section>;
}
