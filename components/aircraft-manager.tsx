"use client";

import { BILLING_SHARES,parseBilling } from "@/lib/billing";
import { useEffect,useState } from "react";
import { createPortal } from "react-dom";

type Row=Record<string,unknown>;
type Action=(form:FormData)=>Promise<void>;
type AircraftSaveResult={ok:boolean;message:string};
type SaveAction=(form:FormData)=>Promise<AircraftSaveResult>;

const t=(value:unknown)=>String(value??"");
const classes=["ULL","SEP","TMG","MEP","SET","OTHER","GLIDER"];
const evidence=["ULL","EASA"];
const roles=[
  {value:"PIC",label:"PIC"},{value:"SOLO",label:"SOLO"},{value:"DUAL",label:"DUAL"},{value:"SPIC",label:"SPIC"},{value:"PICUS",label:"PICUS"},
  {value:"INSTRUCTOR",label:"INSTRUCTOR"},{value:"EXAMINER",label:"EXAMINER"},{value:"SAFETY PILOT",label:"SAFETY PILOT"},{value:"CO-PILOT",label:"CO-PILOT"},{value:"CRUISE-RELIEF CO-PILOT",label:"CRUISE-RELIEF CO-PILOT"},{value:"PAX",label:"PAX"},{value:"OBSERVER",label:"OBSERVER"}
];
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

function AircraftFields({aircraft}:{aircraft?:Row}){
  const billing=parseBilling(aircraft?.billing_basis),editing=Boolean(aircraft),creditClass=t(aircraft?.part_fcl_credit_class).toUpperCase();
  return <div className="aircraft-form-grid">
    {editing?<input type="hidden" name="id" value={t(aircraft?.id)}/>:null}
    <label>Registration<input name="registration" defaultValue={t(aircraft?.registration)} placeholder="OK-ABC" required readOnly={editing}/></label>
    <label>Make<input name="aircraft_make" defaultValue={t(aircraft?.aircraft_make)} placeholder="Tecnam"/><small>FCL.050 aircraft identity</small></label>
    <label>Model<input name="aircraft_model" defaultValue={t(aircraft?.aircraft_model)||t(aircraft?.aircraft_type)} placeholder="P2008 JC"/><small>Required for an EASA record</small></label>
    <label>Variant<input name="aircraft_variant" defaultValue={t(aircraft?.aircraft_variant)} placeholder="Optional variant"/></label>
    <label>Display type<input name="aircraft_type" defaultValue={t(aircraft?.aircraft_type)} placeholder="P2008 JC"/><small>Short label used elsewhere in FlyTally</small></label>
    <label>ICAO type<input name="icao_type" defaultValue={t(aircraft?.icao_type)} placeholder="P208"/></label>
    <label>Class<select name="aircraft_class" defaultValue={t(aircraft?.aircraft_class)||"ULL"}>{classes.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Logbook<select name="evidence" defaultValue={t(aircraft?.evidence)||"ULL"}>{evidence.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Default role<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
    <details className="aircraft-credit-card">
      <summary>Part-FCL credit <small>optional · set once per aircraft</small></summary>
      <div className="aircraft-credit-grid">
        <label>Credit as<select name="part_fcl_credit_class" defaultValue={creditClass}><option value="">Do not count</option><option value="SEP">SEP</option><option value="TMG">TMG</option></select><small>For Annex-I / Article 2(8) aircraft only. Eligible ULL hours and take-offs/landings can support FCL.140.A and FCL.740.A; never FCL.060. The mandatory FI/CRI refresher is not credited from ULL.</small></label>
        <label>Credit valid from<input name="part_fcl_credit_from" type="date" defaultValue={t(aircraft?.part_fcl_credit_from).slice(0,10)}/><small>Prevents historical flights being credited before the basis applied.</small></label>
        <label className="wide">Basis / reference<input name="part_fcl_credit_basis" defaultValue={t(aircraft?.part_fcl_credit_basis)} placeholder="e.g. Annex I aircraft matching SEP(land), authority/DTO reference"/><small>Required when credit is enabled. FlyTally never decides eligibility from ULL status alone.</small></label>
      </div>
    </details>
    <label>Billing time<select name="billing_basis" defaultValue={billing.basis}><option>BLOCK</option><option>AIR</option></select></label>
    <label>Default share<select name="billing_share" defaultValue={billing.share}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
    {!editing?<><label>Initial hourly rate<input name="initial_price_per_hour" type="number" min="0" step="0.01" placeholder="0"/></label><label>Valid from<input name="initial_valid_from" type="date" defaultValue={today}/></label></>:null}
    <label className="aircraft-note">Notes<textarea name="note" rows={2} defaultValue={t(aircraft?.note)}/></label>
  </div>;
}

function RateTimeline({aircraft,rates,saveAction,deleteAction}:{aircraft:Row;rates:Row[];saveAction:Action;deleteAction:Action}){
  const registration=t(aircraft.registration),history=rates.filter(rate=>t(rate.registration).trim().toUpperCase()===registration.trim().toUpperCase());
  return <section className="aircraft-rates"><div className="modal-section-heading"><div><p className="eyebrow">RATES</p><h3>Rate history</h3></div><span>{history.length}</span></div>
    <form action={saveAction} className="rate-editor"><input type="hidden" name="registration" value={registration}/><input type="hidden" name="aircraft_type" value={t(aircraft.aircraft_type)}/><label>New rate CZK/h<input name="price_per_hour" type="number" min="0.01" step="0.01" required/></label><label>Valid from<input name="valid_from" type="date" defaultValue={today} required/></label><label>Dry rate CZK/h<input name="dry_price_per_hour" type="number" min="0" step="0.01"/></label><label>Source / note<input name="source" defaultValue="Aircraft rate change"/></label><button className="primary-button">Save rate</button></form>
    <div className="rate-history">{history.map((rate,index)=><div className={`rate-history-row${index===0?" newest":""}`} key={t(rate.id)}><span><small>Valid from</small><b>{t(rate.valid_from)||"No date"}</b></span><span><small>Rate</small><b>{Number(rate.price_per_hour||0).toLocaleString("en-GB")} CZK/h</b></span><span><small>Dry</small><b>{Number(rate.dry_price_per_hour||0)?`${Number(rate.dry_price_per_hour).toLocaleString("en-GB")} CZK/h`:"—"}</b></span><span><small>Source</small><b>{t(rate.source)||"—"}</b></span><details className="confirm-action compact-confirm"><summary>Remove…</summary><div><small>This permanently deletes only this historical rate.</small><form action={deleteAction}><input type="hidden" name="id" value={t(rate.id)}/><button className="icon-danger">Delete rate</button></form></div></details></div>)}{!history.length?<p className="empty-state">No rate history.</p>:null}</div>
  </section>;
}

export function AircraftManager({aircraft,rates,saveAction,toggleAction,saveRateAction,deleteRateAction}:{aircraft:Row[];rates:Row[];saveAction:SaveAction;toggleAction:Action;saveRateAction:Action;deleteRateAction:Action}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [profileStatus,setProfileStatus]=useState<{ok:boolean;message:string}|null>(null);
  const [savingProfile,setSavingProfile]=useState(false);
  const selected=aircraft.find(item=>t(item.id)===selectedId)??null;
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedId(null)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
  useEffect(()=>{document.body.style.overflow=selected?"hidden":"";return()=>{document.body.style.overflow=""}},[selected]);
  useEffect(()=>{setProfileStatus(null)},[selectedId]);
  const saveSelected=async(form:FormData)=>{setSavingProfile(true);setProfileStatus(null);try{setProfileStatus(await saveAction(form))}catch{setProfileStatus({ok:false,message:"Aircraft profile could not be saved."})}finally{setSavingProfile(false)}};
  return <div className="aircraft-manager">
    <details className="add-aircraft-card"><summary>＋ Add aircraft</summary><form action={async form=>{await saveAction(form)}}><AircraftFields/><div className="form-actions"><button className="primary-button">Add aircraft</button></div></form></details>
    <div className="aircraft-card-list">{aircraft.map(item=>{const billing=parseBilling(item.billing_basis),active=Boolean(Number(item.active)),identity=[t(item.aircraft_make),t(item.aircraft_model)||t(item.aircraft_type),t(item.aircraft_variant)].filter(Boolean).join(" ");return <article className={`aircraft-card${active?"":" inactive"}`} key={t(item.id)}>
      <header><div><strong>{t(item.registration)}</strong><span>{identity||"Type not set"} · {t(item.aircraft_class)||"—"} · {t(item.evidence)||"—"}</span></div><span className={active?"status-on":"status-off"}>{active?"Active":"Inactive"}</span></header>
      <div className="aircraft-card-metrics"><span><small>ICAO</small><b>{t(item.icao_type)||"—"}</b></span><span><small>Current rate</small><b>{Number(item.current_price_per_hour||0).toLocaleString("en-GB")} CZK/h</b><em>{t(item.current_price_valid_from)?`from ${t(item.current_price_valid_from)}`:"default rate"}</em></span><span><small>Billing</small><b>{billing.basis} · 1/{billing.share}</b></span><span><small>Role</small><b>{t(item.default_role)||"PIC"}</b></span></div>
      <button type="button" className="aircraft-manage-button" onClick={()=>setSelectedId(t(item.id))}>Edit aircraft & rates</button>
    </article>})}{!aircraft.length?<div className="guided-empty-state"><span aria-hidden="true">✈</span><h3>No aircraft yet</h3><p>Add the aircraft you fly. It will then be available in manual entry and GPS import.</p></div>:null}</div>
    {selected?createPortal(<div className="aircraft-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}><section className="aircraft-modal" role="dialog" aria-modal="true" aria-labelledby="aircraft-modal-title">
      <header><div><p className="eyebrow">AIRCRAFT</p><h2 id="aircraft-modal-title">{t(selected.registration)}</h2><p>{[t(selected.aircraft_make),t(selected.aircraft_model)||t(selected.aircraft_type),t(selected.aircraft_variant)].filter(Boolean).join(" ")||"Type not set"} · {t(selected.aircraft_class)||"—"} · {t(selected.evidence)||"—"}</p></div><button type="button" className="modal-close" aria-label="Close" onClick={()=>setSelectedId(null)}>×</button></header>
      <div className="aircraft-modal-content">
        <section className="aircraft-profile-editor"><div className="modal-section-heading"><div><p className="eyebrow">SETTINGS</p><h3>Aircraft profile</h3></div></div><form action={saveSelected}><AircraftFields aircraft={selected}/><div className="form-actions"><button className="primary-button" disabled={savingProfile}>{savingProfile?"Saving…":"Save profile"}</button></div>{profileStatus?<p className={profileStatus.ok?"form-success":"form-error"} role="status">{profileStatus.message}</p>:null}</form><div className="aircraft-state-action"><div><strong>{Number(selected.active)?"Aircraft is active":"Aircraft is inactive"}</strong><small>{Number(selected.active)?"Deactivate it to hide it from new-flight choices.":"Activate it to make it available for new flights."}</small></div><form action={toggleAction}><input type="hidden" name="id" value={t(selected.id)}/><button className="secondary-button">{Number(selected.active)?"Deactivate aircraft":"Activate aircraft"}</button></form></div></section>
        <RateTimeline aircraft={selected} rates={rates} saveAction={saveRateAction} deleteAction={deleteRateAction}/>
      </div>
    </section></div>,document.body):null}
  </div>;
}
