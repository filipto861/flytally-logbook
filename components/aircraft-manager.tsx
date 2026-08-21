"use client";

import { BILLING_SHARES,parseBilling } from "@/lib/billing";
import { useEffect,useState } from "react";

type Row=Record<string,unknown>;
type Action=(form:FormData)=>Promise<void>;

const t=(value:unknown)=>String(value??"");
const classes=["ULL","SEP","TMG","MEP","SET","OTHER","GLIDER"];
const evidence=["ULL","EASA"];
const roles=["PIC","DUAL","INSTRUKTOR","SAFETY PILOT","CO-PILOT","PAX","OBSERVER"];
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

function AircraftFields({aircraft}:{aircraft?:Row}){
  const billing=parseBilling(aircraft?.billing_basis),editing=Boolean(aircraft);
  return <div className="aircraft-form-grid">
    {editing?<input type="hidden" name="id" value={t(aircraft?.id)}/>:null}
    <label>Imatrikulace<input name="registration" defaultValue={t(aircraft?.registration)} placeholder="OK-ABC" required readOnly={editing}/>{editing?<small>Registraci nelze změnit, aby zůstaly zachované vazby na historické lety.</small>:null}</label>
    <label>Typ letadla<input name="aircraft_type" defaultValue={t(aircraft?.aircraft_type)} placeholder="P92 Echo"/></label>
    <label>ICAO typ<input name="icao_type" defaultValue={t(aircraft?.icao_type)} placeholder="P92"/></label>
    <label>Třída<select name="aircraft_class" defaultValue={t(aircraft?.aircraft_class)||"ULL"}>{classes.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Evidence<select name="evidence" defaultValue={t(aircraft?.evidence)||"ULL"}>{evidence.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Výchozí funkce<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Účtovaný čas<select name="billing_basis" defaultValue={billing.basis}><option>BLOCK</option><option>AIR</option></select></label>
    <label>Výchozí podíl<select name="billing_share" defaultValue={billing.share}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · celá cena":`1/${value}`}</option>)}</select></label>
    {!editing?<><label>Počáteční cena za hodinu<input name="initial_price_per_hour" type="number" min="0" step="0.01" placeholder="0"/></label><label>Počáteční cena platí od<input name="initial_valid_from" type="date" defaultValue={today}/></label></>:null}
    <label className="aircraft-note">Poznámka<textarea name="note" rows={2} defaultValue={t(aircraft?.note)} placeholder="Vlastník, provozovatel, zvláštní nastavení…"/></label>
  </div>;
}

function RateTimeline({aircraft,rates,saveAction,deleteAction}:{aircraft:Row;rates:Row[];saveAction:Action;deleteAction:Action}){
  const registration=t(aircraft.registration),history=rates.filter(rate=>t(rate.registration).trim().toUpperCase()===registration.trim().toUpperCase());
  return <section className="aircraft-rates"><div className="modal-section-heading"><div><p className="eyebrow">CENÍK</p><h3>Historie cen</h3></div><span>{history.length} {history.length===1?"sazba":"sazeb"}</span></div>
    <p className="muted">Nová cena ovlivní pouze nově ukládané lety od zadaného data. Ceny již uložených letů se nikdy hromadně nepřepisují.</p>
    <form action={saveAction} className="rate-editor"><input type="hidden" name="registration" value={registration}/><input type="hidden" name="aircraft_type" value={t(aircraft.aircraft_type)}/><label>Nová cena Kč/h<input name="price_per_hour" type="number" min="0.01" step="0.01" required/></label><label>Platí od<input name="valid_from" type="date" defaultValue={today} required/></label><label>Dry cena Kč/h<input name="dry_price_per_hour" type="number" min="0" step="0.01"/></label><label>Zdroj / poznámka<input name="source" defaultValue="Změna ceny letadla"/></label><button className="primary-button">Uložit novou cenu</button></form>
    <div className="rate-history">{history.map((rate,index)=><div className={`rate-history-row${index===0?" newest":""}`} key={t(rate.id)}><span><small>Platí od</small><b>{t(rate.valid_from)||"Bez data"}</b></span><span><small>Cena</small><b>{Number(rate.price_per_hour||0).toLocaleString("cs-CZ")} Kč/h</b></span><span><small>Dry</small><b>{Number(rate.dry_price_per_hour||0)?`${Number(rate.dry_price_per_hour).toLocaleString("cs-CZ")} Kč/h`:"—"}</b></span><span><small>Zdroj</small><b>{t(rate.source)||"—"}</b></span><form action={deleteAction}><input type="hidden" name="id" value={t(rate.id)}/><button className="icon-danger" title="Smaže pouze položku ceníku, nikoli uložené ceny letů">Smazat</button></form></div>)}{!history.length?<p className="empty-state">Pro toto letadlo zatím není samostatná historie sazeb. Používá se původní výchozí cena.</p>:null}</div>
  </section>;
}

export function AircraftManager({aircraft,rates,saveAction,toggleAction,saveRateAction,deleteRateAction}:{aircraft:Row[];rates:Row[];saveAction:Action;toggleAction:Action;saveRateAction:Action;deleteRateAction:Action}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=aircraft.find(item=>t(item.id)===selectedId)??null;
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedId(null)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
  useEffect(()=>{document.body.style.overflow=selected?"hidden":"";return()=>{document.body.style.overflow=""}},[selected]);
  return <div className="aircraft-manager">
    <details className="add-aircraft-card"><summary>＋ Přidat nové letadlo</summary><form action={saveAction}><AircraftFields/><div className="form-actions"><button className="primary-button">Přidat letadlo</button></div></form></details>
    <div className="aircraft-card-list">{aircraft.map(item=>{const billing=parseBilling(item.billing_basis),active=Boolean(Number(item.active));return <article className={`aircraft-card${active?"":" inactive"}`} key={t(item.id)}>
      <header><div><strong>{t(item.registration)}</strong><span>{t(item.aircraft_type)||"Typ neuveden"} · {t(item.aircraft_class)||"—"} · {t(item.evidence)||"—"}</span></div><form action={toggleAction}><input type="hidden" name="id" value={t(item.id)}/><button className={active?"status-on":"status-off"}>{active?"Aktivní":"Neaktivní"}</button></form></header>
      <div className="aircraft-card-metrics"><span><small>ICAO</small><b>{t(item.icao_type)||"—"}</b></span><span><small>Aktuální cena</small><b>{Number(item.current_price_per_hour||0).toLocaleString("cs-CZ")} Kč/h</b><em>{t(item.current_price_valid_from)?`od ${t(item.current_price_valid_from)}`:"původní výchozí sazba"}</em></span><span><small>Účtování</small><b>{billing.basis} · 1/{billing.share}</b></span><span><small>Funkce</small><b>{t(item.default_role)||"PIC"}</b></span></div>
      <button type="button" className="aircraft-manage-button" onClick={()=>setSelectedId(t(item.id))}>Spravovat letadlo</button>
    </article>})}{!aircraft.length?<p className="empty-state">Zatím není uložené žádné letadlo.</p>:null}</div>
    {selected?<div className="aircraft-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}><section className="aircraft-modal" role="dialog" aria-modal="true" aria-labelledby="aircraft-modal-title">
      <header><div><p className="eyebrow">SPRÁVA LETADLA</p><h2 id="aircraft-modal-title">{t(selected.registration)}</h2><p>{t(selected.aircraft_type)||"Typ neuveden"} · {t(selected.aircraft_class)||"—"} · {t(selected.evidence)||"—"}</p></div><button type="button" className="modal-close" aria-label="Zavřít" onClick={()=>setSelectedId(null)}>×</button></header>
      <div className="aircraft-modal-content">
        <section className="aircraft-profile-editor"><div className="modal-section-heading"><div><p className="eyebrow">NASTAVENÍ</p><h3>Profil letadla</h3></div></div><p className="muted">Změna profilu nemění historické ceny. Novou cenu přidejte samostatně do historie cen.</p><form action={saveAction}><AircraftFields aircraft={selected}/><div className="form-actions"><button className="primary-button">Uložit profil</button></div></form></section>
        <RateTimeline aircraft={selected} rates={rates} saveAction={saveRateAction} deleteAction={deleteRateAction}/>
      </div>
    </section></div>:null}
  </div>;
}
