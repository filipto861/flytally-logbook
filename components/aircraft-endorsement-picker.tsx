"use client";

import { useMemo,useState } from "react";
import { AIRCRAFT_ENDORSEMENTS,parseAircraftEndorsements,serializeAircraftEndorsements,type AircraftEndorsementCode } from "@/lib/aircraft-endorsements";

export function AircraftEndorsementPicker({value=""}:{value?:unknown}){
  const initial=useMemo(()=>parseAircraftEndorsements(value),[value]);
  const[codes,setCodes]=useState<AircraftEndorsementCode[]>(initial.codes),[custom,setCustom]=useState(initial.custom);
  const toggle=(code:AircraftEndorsementCode,checked:boolean)=>setCodes(current=>checked?[...current,code].filter((item,index,all)=>all.indexOf(item)===index):current.filter(item=>item!==code));
  return <fieldset className="aircraft-endorsement-picker wide">
    <legend>Aircraft endorsements</legend>
    <input type="hidden" name="differences" value={serializeAircraftEndorsements(codes,custom)}/>
    <div className="endorsement-options">{AIRCRAFT_ENDORSEMENTS.map(item=><label key={item.code} className={codes.includes(item.code)?"selected":""}><input type="checkbox" checked={codes.includes(item.code)} onChange={event=>toggle(item.code,event.target.checked)}/><span><b>{item.code}</b><small>{item.label}</small></span></label>)}</div>
    <label className="endorsement-custom">Other / custom<input value={custom} onChange={event=>setCustom(event.target.value)} placeholder="AP, Garmin G3X, parachute system…"/></label>
    <small className="field-note">Select any applicable standard codes. Equipment without a standard code stays as free text.</small>
  </fieldset>;
}
