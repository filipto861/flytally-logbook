"use client";

import { BILLING_SHARES,parseBilling } from "@/lib/billing";
import { AircraftTypePicker } from "@/components/aircraft-type-picker";
import { AIRCRAFT_PROFILE_CLASSES,aircraftProfileRegulatoryCategory } from "@/lib/aircraft-profile-context";
import { useEffect,useState } from "react";
import { createPortal } from "react-dom";
import { AircraftPhotoEditor } from "@/components/aircraft-photo-editor";
import { AircraftSharePanel } from "@/components/aircraft-share-panel";

type Row=Record<string,unknown>;
type Action=(form:FormData)=>Promise<void>;
type AircraftSaveResult={ok:boolean;message:string};
type SaveAction=(form:FormData)=>Promise<AircraftSaveResult>;
type PhotoState={ok:boolean;message:string};
type PhotoSaveAction=(state:PhotoState,form:FormData)=>Promise<PhotoState>;
type ShareState={ok:boolean;message:string};
type ShareAction=(state:ShareState,form:FormData)=>Promise<ShareState>;

const t=(value:unknown)=>String(value??"");
const classLabel=(value:string)=>value==="HELICOPTER"?"Helicopter":value==="BALLOON"?"Balloon":value;
const roles=[
  {value:"PIC",label:"PIC — Pilot in command"},{value:"SOLO",label:"SOLO — Supervised solo"},{value:"DUAL",label:"DUAL — Training with instructor"},{value:"SPIC",label:"SPIC — Student pilot in command"},{value:"PICUS",label:"PICUS — PIC under supervision"},
  {value:"INSTRUCTOR",label:"INSTRUCTOR — Giving instruction"},{value:"EXAMINER",label:"EXAMINER"},{value:"SAFETY PILOT",label:"SAFETY PILOT"},{value:"CO-PILOT",label:"CO-PILOT"},{value:"CRUISE-RELIEF CO-PILOT",label:"CRUISE-RELIEF CO-PILOT"},{value:"PAX",label:"PAX"},{value:"OBSERVER",label:"OBSERVER"}
];
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

function AircraftFields({aircraft}:{aircraft?:Row}){
  const billing=parseBilling(aircraft?.billing_basis),editing=Boolean(aircraft),initialLogbook=t(aircraft?.evidence)||"ULL",initialClass=t(aircraft?.aircraft_class)||(initialLogbook==="EASA"?"SEP":"ULL"),initialCategory=t(aircraft?.regulatory_category)||aircraftProfileRegulatoryCategory(initialLogbook,initialClass),initialBalloonClass=t(aircraft?.balloon_class),initialBalloonGroup=t(aircraft?.balloon_group);
  const[logbook,setLogbook]=useState(initialLogbook),[aircraftClass,setAircraftClass]=useState(initialClass),[regulatoryCategory,setRegulatoryCategory]=useState(initialCategory),[balloonClass,setBalloonClass]=useState(initialBalloonClass),[balloonGroup,setBalloonGroup]=useState(initialBalloonGroup);
  const clearBalloon=()=>{setBalloonClass("");setBalloonGroup("")};
  const changeLogbook=(value:string)=>{const nextClass=value==="ULL"?"ULL":aircraftClass==="ULL"?"SEP":aircraftClass;setLogbook(value);setAircraftClass(nextClass);setRegulatoryCategory(aircraftProfileRegulatoryCategory(value,nextClass,regulatoryCategory));if(value!=="EASA"||nextClass!=="BALLOON")clearBalloon()};
  const changeClass=(value:string)=>{setAircraftClass(value);setRegulatoryCategory(aircraftProfileRegulatoryCategory(logbook,value,regulatoryCategory));if(value!=="BALLOON")clearBalloon()};
  const changeBalloonClass=(value:string)=>{setBalloonClass(value);if(value!=="HOT_AIR_BALLOON")setBalloonGroup("")};
  return <div className="aircraft-form-grid guided-aircraft-fields">
    {editing?<><input type="hidden" name="id" value={t(aircraft?.id)}/><input type="hidden" name="part_fcl_credit_class" value={t(aircraft?.part_fcl_credit_class)}/><input type="hidden" name="part_fcl_credit_basis" value={t(aircraft?.part_fcl_credit_basis)}/><input type="hidden" name="part_fcl_credit_from" value={t(aircraft?.part_fcl_credit_from).slice(0,10)}/></>:null}
    <label>Registration<input name="registration" defaultValue={t(aircraft?.registration)} placeholder="OK-ABC" required readOnly={editing}/><small>The registration used in flight entries.</small></label>
    <AircraftTypePicker initialMake={t(aircraft?.aircraft_make)} initialModel={t(aircraft?.aircraft_model)||t(aircraft?.aircraft_type)} initialIcao={t(aircraft?.icao_type)} requireMake={logbook==="EASA"} requireModel/>
    <label>Normal logbook<select name="evidence" value={logbook} onChange={event=>changeLogbook(event.target.value)}><option value="ULL">ULL</option><option value="EASA">EASA</option></select><small>Flights will use this by default.</small></label>
    {logbook==="EASA"?<label>Class / category<select name="aircraft_class" value={aircraftClass} onChange={event=>changeClass(event.target.value)}>{AIRCRAFT_PROFILE_CLASSES.map(value=><option key={value} value={value}>{classLabel(value)}</option>)}</select><small>For helicopters choose Helicopter; for balloons choose Balloon. Catalogue hints are informational only.</small></label>:<input type="hidden" name="aircraft_class" value="ULL"/>}
    {aircraftClass==="TMG"&&logbook==="EASA"?<label>Regulatory context<select name="regulatory_category" value={regulatoryCategory} onChange={event=>setRegulatoryCategory(event.target.value)}><option value="AEROPLANE">Aeroplane · Part-FCL</option><option value="SAILPLANE">Sailplane · SPL / Part-SFCL</option></select><small>TMG can support either regulatory context. This is the normal default and can be changed per flight.</small></label>:<><input type="hidden" name="regulatory_category" value={regulatoryCategory}/>{logbook==="EASA"&&aircraftClass==="GLIDER"?<div><strong>Regulatory context</strong><small>Sailplane · SPL / Part-SFCL</small></div>:logbook==="EASA"&&aircraftClass==="HELICOPTER"?<div><strong>Regulatory context</strong><small>Helicopter · Part-FCL · type-specific</small></div>:logbook==="EASA"&&aircraftClass==="BALLOON"?<div><strong>Regulatory context</strong><small>Balloon · BPL / Part-BFCL</small></div>:null}</>}
    {logbook==="EASA"&&aircraftClass==="BALLOON"?<><label>Balloon class<select name="balloon_class" value={balloonClass} onChange={event=>changeBalloonClass(event.target.value)} required><option value="">Select balloon class…</option><option value="HOT_AIR_BALLOON">Hot-air balloon</option><option value="GAS_BALLOON">Gas balloon</option><option value="HOT_AIR_AIRSHIP">Hot-air airship</option><option value="MIXED_BALLOON">Mixed balloon</option></select><small>Stored explicitly so BFCL.160 experience is never pooled across the wrong balloon class.</small></label>{balloonClass==="HOT_AIR_BALLOON"?<label>Hot-air group<select name="balloon_group" value={balloonGroup} onChange={event=>setBalloonGroup(event.target.value)} required><option value="">Select group…</option><option value="A">Group A</option><option value="B">Group B</option><option value="C">Group C</option><option value="D">Group D</option></select><small>Group is part of the hot-air balloon privilege context.</small></label>:<input type="hidden" name="balloon_group" value=""/>}</>:<><input type="hidden" name="balloon_class" value=""/><input type="hidden" name="balloon_group" value=""/></>}
    <details className="aircraft-advanced-fields"><summary><span>More aircraft settings</span><small>Optional defaults, identity details and pricing</small></summary><div className="aircraft-advanced-grid">
      <label>Variant<input name="aircraft_variant" defaultValue={t(aircraft?.aircraft_variant)} placeholder="Optional variant"/></label>
      <label>Display name<input name="aircraft_type" defaultValue={t(aircraft?.aircraft_type)} placeholder="Leave blank to use model"/><small>Optional short label used elsewhere in FlyTally.</small></label>
      <label>Default role<select name="default_role" defaultValue={t(aircraft?.default_role)||"PIC"}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
      <label>Billing time<select name="billing_basis" defaultValue={billing.basis}><option>BLOCK</option><option>AIR</option></select></label>
      <label>Default share<select name="billing_share" defaultValue={billing.share}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
      {!editing?<><label>Initial hourly rate<input name="initial_price_per_hour" type="number" min="0" step="0.01" placeholder="Optional"/></label><label>Valid from<input name="initial_valid_from" type="date" defaultValue={today}/></label></>:null}
      <label className="aircraft-note">Notes<textarea name="note" rows={2} defaultValue={t(aircraft?.note)} placeholder="Optional"/></label>
    </div></details>
  </div>;
}

function RateTimeline({aircraft,rates,saveAction,deleteAction}:{aircraft:Row;rates:Row[];saveAction:Action;deleteAction:Action}){
  const registration=t(aircraft.registration),history=rates.filter(rate=>t(rate.registration).trim().toUpperCase()===registration.trim().toUpperCase());
  return <section className="aircraft-rates"><div className="modal-section-heading"><div><p className="eyebrow">RATES</p><h3>Rate history</h3></div><span>{history.length}</span></div>
    <form action={saveAction} className="rate-editor"><input type="hidden" name="registration" value={registration}/><input type="hidden" name="aircraft_type" value={t(aircraft.aircraft_type)}/><label>New rate CZK/h<input name="price_per_hour" type="number" min="0.01" step="0.01" required/></label><label>Valid from<input name="valid_from" type="date" defaultValue={today} required/></label><label>Dry rate CZK/h<input name="dry_price_per_hour" type="number" min="0" step="0.01"/></label><label>Source / note<input name="source" defaultValue="Aircraft rate change"/></label><button className="primary-button">Save rate</button></form>
    <div className="rate-history">{history.map((rate,index)=><div className={`rate-history-row${index===0?" newest":""}`} key={t(rate.id)}><span><small>Valid from</small><b>{t(rate.valid_from)||"No date"}</b></span><span><small>Rate</small><b>{Number(rate.price_per_hour||0).toLocaleString("en-GB")} CZK/h</b></span><span><small>Dry</small><b>{Number(rate.dry_price_per_hour||0)?`${Number(rate.dry_price_per_hour).toLocaleString("en-GB")} CZK/h`:"—"}</b></span><span><small>Source</small><b>{t(rate.source)||"—"}</b></span><details className="confirm-action compact-confirm"><summary>Remove…</summary><div><small>This permanently deletes only this historical rate.</small><form action={deleteAction}><input type="hidden" name="id" value={t(rate.id)}/><button className="icon-danger">Delete rate</button></form></div></details></div>)}{!history.length?<p className="empty-state">No rate history.</p>:null}</div>
  </section>;
}

export function AircraftManager({aircraft,rates,connections,saveAction,toggleAction,saveRateAction,deleteRateAction,savePhotoAction,removePhotoAction,shareAction}:{aircraft:Row[];rates:Row[];connections:Row[];saveAction:SaveAction;toggleAction:Action;saveRateAction:Action;deleteRateAction:Action;savePhotoAction:PhotoSaveAction;removePhotoAction:Action;shareAction:ShareAction}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [profileStatus,setProfileStatus]=useState<{ok:boolean;message:string}|null>(null),[newStatus,setNewStatus]=useState<{ok:boolean;message:string}|null>(null);
  const [savingProfile,setSavingProfile]=useState(false),[savingNew,setSavingNew]=useState(false);
  const selected=aircraft.find(item=>t(item.id)===selectedId)??null;
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedId(null)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
  useEffect(()=>{document.body.style.overflow=selected?"hidden":"";return()=>{document.body.style.overflow=""}},[selected]);
  useEffect(()=>{setProfileStatus(null)},[selectedId]);
  const saveSelected=async(form:FormData)=>{setSavingProfile(true);setProfileStatus(null);try{setProfileStatus(await saveAction(form))}catch{setProfileStatus({ok:false,message:"Aircraft profile could not be saved."})}finally{setSavingProfile(false)}};
  const saveNew=async(form:FormData)=>{setSavingNew(true);setNewStatus(null);try{setNewStatus(await saveAction(form))}catch{setNewStatus({ok:false,message:"Aircraft could not be added."})}finally{setSavingNew(false)}};
  return <div className="aircraft-manager">
    <details className="add-aircraft-card" open={!aircraft.length}><summary>{aircraft.length?"＋ Add aircraft":"＋ Add your first aircraft"}</summary><div className="aircraft-add-guidance"><strong>Start with the aircraft identity and normal logbook.</strong><span>Search the aircraft catalogue first; pricing and technical defaults can be added later.</span></div><form action={saveNew}><AircraftFields/><div className="form-actions"><button className="primary-button" disabled={savingNew}>{savingNew?"Saving…":"Add aircraft"}</button></div>{newStatus?<p className={newStatus.ok?"form-success":"form-error"} role="status">{newStatus.message}</p>:null}</form></details>
    <div className="aircraft-card-list">{aircraft.map(item=>{const active=Boolean(Number(item.active)),identity=[t(item.aircraft_make),t(item.aircraft_model)||t(item.aircraft_type),t(item.aircraft_variant)].filter(Boolean).join(" "),currentRate=Number(item.current_price_per_hour||0),aircraftClass=classLabel(t(item.aircraft_class))||t(item.regulatory_category)||"—",hasPhoto=Boolean(item.has_photo),photoUrl=hasPhoto?`/api/aircraft-photo/${t(item.id)}?v=${encodeURIComponent(t(item.photo_updated_at))}`:"";return <article className={`aircraft-card${active?"":" inactive"}${hasPhoto?" with-photo":""}`} style={hasPhoto?{backgroundImage:`linear-gradient(180deg,rgba(4,12,22,.18),rgba(4,12,22,.86)),url("${photoUrl}")`}:undefined} key={t(item.id)}>
      <header><div><strong>{t(item.registration)}</strong><span>{identity||"Type not set"}</span></div><span className={active?"status-on":"status-off"}>{active?"Active":"Inactive"}</span></header>
      <div className="aircraft-card-summary"><span><small>Logbook</small><b>{t(item.evidence)||"—"}</b></span><span><small>Class / category</small><b>{aircraftClass}</b></span><span><small>Current rate</small><b>{currentRate>0?`${currentRate.toLocaleString("en-GB")} CZK/h`:"Not set"}</b>{currentRate>0?<em>{t(item.current_price_valid_from)?`from ${t(item.current_price_valid_from)}`:"default rate"}</em>:null}</span></div>
      <button type="button" className="aircraft-manage-button" onClick={()=>setSelectedId(t(item.id))}>Manage aircraft</button>
    </article>})}{!aircraft.length?<div className="guided-empty-state"><span aria-hidden="true">✈</span><h3>No aircraft yet</h3><p>Add the aircraft you fly. FlyTally will remember its normal logbook and defaults for future flights.</p></div>:null}</div>
    {selected?createPortal(<div className="aircraft-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}><section className="aircraft-modal" role="dialog" aria-modal="true" aria-labelledby="aircraft-modal-title">
      <header><div><p className="eyebrow">AIRCRAFT</p><h2 id="aircraft-modal-title">{t(selected.registration)}</h2><p>{[t(selected.aircraft_make),t(selected.aircraft_model)||t(selected.aircraft_type),t(selected.aircraft_variant)].filter(Boolean).join(" ")||"Type not set"} · {classLabel(t(selected.aircraft_class))||"—"} · {t(selected.regulatory_category)||t(selected.evidence)||"—"}</p></div><button type="button" className="modal-close" aria-label="Close" onClick={()=>setSelectedId(null)}>×</button></header>
      <div className="aircraft-modal-content">
        <AircraftPhotoEditor aircraftId={Number(selected.id)} hasPhoto={Boolean(selected.has_photo)} photoUpdatedAt={t(selected.photo_updated_at)} saveAction={savePhotoAction} removeAction={removePhotoAction}/>
        <section className="aircraft-profile-editor"><div className="modal-section-heading"><div><p className="eyebrow">SETTINGS</p><h3>Aircraft profile</h3><p className="muted">The everyday fields are shown first. Open More aircraft settings only when you need them.</p></div></div><form action={saveSelected}><AircraftFields aircraft={selected}/><div className="form-actions"><button className="primary-button" disabled={savingProfile}>{savingProfile?"Saving…":"Save profile"}</button></div>{profileStatus?<p className={profileStatus.ok?"form-success":"form-error"} role="status">{profileStatus.message}</p>:null}</form><div className="aircraft-state-action"><div><strong>{Number(selected.active)?"Aircraft is active":"Aircraft is inactive"}</strong><small>{Number(selected.active)?"Deactivate it to hide it from new-flight choices.":"Activate it to make it available for new flights."}</small></div><form action={toggleAction}><input type="hidden" name="id" value={t(selected.id)}/><button className="secondary-button">{Number(selected.active)?"Deactivate aircraft":"Activate aircraft"}</button></form></div></section>
        <RateTimeline aircraft={selected} rates={rates} saveAction={saveRateAction} deleteAction={deleteRateAction}/>
        <AircraftSharePanel aircraft={selected} connections={connections} action={shareAction}/>
      </div>
    </section></div>,document.body):null}
  </div>;
}
