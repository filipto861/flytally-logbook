"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AircraftTypePicker } from "@/components/aircraft-type-picker";
import { AIRCRAFT_PROFILE_CLASSES,aircraftProfileRegulatoryCategory } from "@/lib/aircraft-profile-context";

 type AircraftSaveResult={ok:boolean;message:string};
type SaveAction=(form:FormData)=>Promise<AircraftSaveResult>;

const roles=[
  {value:"PIC",label:"PIC — Pilot in command"},
  {value:"SOLO",label:"SOLO — Supervised solo"},
  {value:"DUAL",label:"DUAL — Training with instructor"},
  {value:"SPIC",label:"SPIC — Student pilot in command"},
  {value:"PICUS",label:"PICUS — PIC under supervision"},
  {value:"INSTRUCTOR",label:"INSTRUCTOR — Giving instruction"},
  {value:"EXAMINER",label:"EXAMINER"},
  {value:"SAFETY PILOT",label:"SAFETY PILOT"},
  {value:"CO-PILOT",label:"CO-PILOT"},
  {value:"CRUISE-RELIEF CO-PILOT",label:"CRUISE-RELIEF CO-PILOT"},
];
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const classLabel=(value:string)=>value==="HELICOPTER"?"Helicopter":value==="BALLOON"?"Balloon":value;
const balloonClasses=[
  {value:"HOT_AIR_BALLOON",label:"Hot-air balloon"},
  {value:"GAS_BALLOON",label:"Gas balloon"},
  {value:"HOT_AIR_AIRSHIP",label:"Hot-air airship"},
  {value:"MIXED_BALLOON",label:"Mixed balloon"},
];

export function QuickAircraftForm({action,onSaved}:{action:SaveAction;onSaved?:()=>void}){
  const router=useRouter();
  const[logbook,setLogbook]=useState("ULL"),[aircraftClass,setAircraftClass]=useState("ULL"),[regulatoryCategory,setRegulatoryCategory]=useState("ULL"),[balloonClass,setBalloonClass]=useState("HOT_AIR_BALLOON"),[saving,setSaving]=useState(false),[status,setStatus]=useState<AircraftSaveResult|null>(null);
  const changeLogbook=(value:string)=>{const nextClass=value==="ULL"?"ULL":aircraftClass==="ULL"?"SEP":aircraftClass;setLogbook(value);setAircraftClass(nextClass);setRegulatoryCategory(aircraftProfileRegulatoryCategory(value,nextClass,regulatoryCategory))};
  const changeClass=(value:string)=>{setAircraftClass(value);setRegulatoryCategory(aircraftProfileRegulatoryCategory(logbook,value,regulatoryCategory))};
  const submit=async(form:FormData)=>{setSaving(true);setStatus(null);try{const result=await action(form);setStatus(result);if(result.ok){router.refresh();onSaved?.()}}catch{setStatus({ok:false,message:"Aircraft could not be saved."})}finally{setSaving(false)}};
  return <form action={submit} className="aircraft-dialog-form quick-aircraft-form">
    <div className="quick-aircraft-intro wide"><strong>Start with the aircraft identity.</strong><span>Search the aircraft catalogue first. If the type is missing, enter it manually below.</span></div>
    <label>Registration<input name="registration" placeholder="OK-ABC" autoCapitalize="characters" required autoFocus/><small>The registration shown in your logbook.</small></label>
    <label>Logbook<select name="evidence" value={logbook} onChange={event=>changeLogbook(event.target.value)}><option value="ULL">ULL</option><option value="EASA">EASA</option></select><small>Choose where flights with this aircraft normally belong.</small></label>
    <AircraftTypePicker requireMake={logbook==="EASA"} requireModel/>
    {logbook==="EASA"?<label>Class / category<select name="aircraft_class" value={aircraftClass} onChange={event=>changeClass(event.target.value)}>{AIRCRAFT_PROFILE_CLASSES.map(value=><option key={value} value={value}>{classLabel(value)}</option>)}</select><small>Choose the regulatory aircraft category; type/model stays the aircraft identity above. Catalogue hints are informational only.</small></label>:<input type="hidden" name="aircraft_class" value="ULL"/>}
    {logbook==="EASA"&&aircraftClass==="BALLOON"?<><label>Balloon class<select name="balloon_class" value={balloonClass} onChange={event=>setBalloonClass(event.target.value)}>{balloonClasses.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select><small>Part-BFCL privileges and recency are class-specific.</small></label>{balloonClass==="HOT_AIR_BALLOON"?<label>Hot-air group<select name="balloon_group" defaultValue="A"><option>A</option><option>B</option><option>C</option><option>D</option></select><small>Stored explicitly; FlyTally does not infer the group from the type name.</small></label>:<input type="hidden" name="balloon_group" value=""/>}</>:<><input type="hidden" name="balloon_class" value=""/><input type="hidden" name="balloon_group" value=""/></>}
    {logbook==="EASA"&&aircraftClass==="TMG"?<label>Regulatory context<select name="regulatory_category" value={regulatoryCategory} onChange={event=>setRegulatoryCategory(event.target.value)}><option value="AEROPLANE">Aeroplane · Part-FCL</option><option value="SAILPLANE">Sailplane · SPL / Part-SFCL</option></select><small>Choose the normal regulatory context for this TMG.</small></label>:<><input type="hidden" name="regulatory_category" value={regulatoryCategory}/>{logbook==="EASA"&&aircraftClass==="GLIDER"?<div><strong>Regulatory context</strong><small>Sailplane · SPL / Part-SFCL</small></div>:logbook==="EASA"&&aircraftClass==="HELICOPTER"?<div><strong>Regulatory context</strong><small>Helicopter · Part-FCL · type-specific</small></div>:logbook==="EASA"&&aircraftClass==="BALLOON"?<div><strong>Regulatory context</strong><small>Balloon · BPL / Part-BFCL · class-specific</small></div>:null}</>}
    <input type="hidden" name="billing_share" value="1"/>
    <details className="quick-aircraft-advanced wide"><summary>More aircraft settings <small>optional</small></summary><div className="quick-aircraft-advanced-grid">
      <label>Variant<input name="aircraft_variant" placeholder="Optional variant"/></label>
      <label>Default role<select name="default_role" defaultValue="PIC">{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
      <label>Billing time<select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select></label>
      <label>Hourly rate<input name="initial_price_per_hour" type="number" min="0" step="0.01" placeholder="Optional"/></label>
      <input type="hidden" name="initial_valid_from" value={today}/>
      <label className="wide">Notes<textarea name="note" rows={2} placeholder="Optional"/></label>
    </div></details>
    {status&&!status.ok?<p className="form-error wide" role="alert">{status.message}</p>:null}
    <div className="form-actions wide"><button className="primary-button" disabled={saving} aria-busy={saving||undefined} data-loading={saving?"true":undefined}>{saving?"Saving…":"Add aircraft"}</button></div>
  </form>;
}
