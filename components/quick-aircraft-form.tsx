"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AircraftSaveResult={ok:boolean;message:string};
type SaveAction=(form:FormData)=>Promise<AircraftSaveResult>;

const classes=["SEP","TMG","MEP","SET","OTHER","GLIDER"];
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

export function QuickAircraftForm({action,onSaved}:{action:SaveAction;onSaved?:()=>void}){
  const router=useRouter();
  const[logbook,setLogbook]=useState("ULL"),[aircraftClass,setAircraftClass]=useState("ULL"),[saving,setSaving]=useState(false),[status,setStatus]=useState<AircraftSaveResult|null>(null);
  const changeLogbook=(value:string)=>{setLogbook(value);setAircraftClass(value==="ULL"?"ULL":aircraftClass==="ULL"?"SEP":aircraftClass)};
  const submit=async(form:FormData)=>{setSaving(true);setStatus(null);try{const result=await action(form);setStatus(result);if(result.ok){router.refresh();onSaved?.()}}catch{setStatus({ok:false,message:"Aircraft could not be saved."})}finally{setSaving(false)}};
  return <form action={submit} className="aircraft-dialog-form quick-aircraft-form">
    <div className="quick-aircraft-intro wide"><strong>Only the basics are needed.</strong><span>You can add technical details, pricing and defaults later.</span></div>
    <label>Registration<input name="registration" placeholder="OK-ABC" autoCapitalize="characters" required autoFocus/><small>The registration shown in your logbook.</small></label>
    <label>Aircraft type / model<input name="aircraft_model" placeholder="Bristell B23" required/><small>A simple name is enough to get started.</small></label>
    <label>Logbook<select name="evidence" value={logbook} onChange={event=>changeLogbook(event.target.value)}><option value="ULL">ULL</option><option value="EASA">EASA</option></select><small>Choose where flights with this aircraft normally belong.</small></label>
    {logbook==="EASA"?<label>Class<select name="aircraft_class" value={aircraftClass} onChange={event=>setAircraftClass(event.target.value)}>{classes.map(value=><option key={value}>{value}</option>)}</select><small>SEP is the normal single-engine aeroplane choice.</small></label>:<input type="hidden" name="aircraft_class" value="ULL"/>}
    <input type="hidden" name="billing_share" value="1"/>
    <details className="quick-aircraft-advanced wide"><summary>More aircraft settings <small>optional</small></summary><div className="quick-aircraft-advanced-grid">
      <label>Make<input name="aircraft_make" placeholder="BRM Aero"/></label>
      <label>Variant<input name="aircraft_variant" placeholder="Optional variant"/></label>
      <label>ICAO type<input name="icao_type" placeholder="BR23" autoCapitalize="characters"/></label>
      <label>Default role<select name="default_role" defaultValue="PIC">{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
      <label>Billing time<select name="billing_basis" defaultValue="BLOCK"><option>BLOCK</option><option>AIR</option></select></label>
      <label>Hourly rate<input name="initial_price_per_hour" type="number" min="0" step="0.01" placeholder="Optional"/></label>
      <input type="hidden" name="initial_valid_from" value={today}/>
      <label className="wide">Notes<textarea name="note" rows={2} placeholder="Optional"/></label>
    </div></details>
    {status&&!status.ok?<p className="form-error wide" role="alert">{status.message}</p>:null}
    <div className="form-actions wide"><button className="primary-button" disabled={saving}>{saving?"Saving…":"Add aircraft"}</button></div>
  </form>;
}
