"use client";

import { FLIGHT_PURPOSES,normalizeFlightPurposeCodes } from "@/lib/flight-purpose";

const visiblePurpose=(code:string,category:string)=>{
  if(!category||category==="OTHER")return true;
  if(code==="LAPL_FCL140A_REFRESHER"||code==="SEP_TMG_FCL740A_REFRESHER")return category==="AEROPLANE";
  if(code==="LAPL_H_FCL140H_REFRESHER")return category==="HELICOPTER";
  if(code==="SPL_SFCL160_TRAINING")return category==="SAILPLANE";
  if(code==="BPL_BFCL160_TRAINING")return category==="BALLOON";
  return true;
};
const purposeNote=(code:string)=>code==="SEP_TMG_FCL740A_REFRESHER"?"Refresher-training marker; it does not by itself revalidate the rating.":code==="LAPL_FCL140A_REFRESHER"?"Recency credit requires the applicable signed instructor evidence.":code==="LAPL_H_FCL140H_REFRESHER"?"Recency credit requires signed instructor evidence on the same helicopter type.":code==="SPL_SFCL160_TRAINING"?"Recency credit requires signed instructor evidence.":code==="BPL_BFCL160_TRAINING"?"Recency credit requires signed FI(B) evidence in the relevant balloon class.":code==="AIRCRAFT_DIFFERENCES"?"Pair with endorsement evidence where applicable.":"";

export function FlightPurposePicker({value="",regulatoryCategory="OTHER"}:{value?:unknown;regulatoryCategory?:string}){
  const selected=new Set(normalizeFlightPurposeCodes(value)),visible=FLIGHT_PURPOSES.filter(item=>visiblePurpose(item.code,regulatoryCategory));
  return <fieldset className="flight-purpose-picker wide">
    <legend>Training purpose</legend>
    <input type="hidden" name="purposeSelectionPresent" value="yes"/>
    <div className="flight-purpose-options">{visible.map(item=>{const note=purposeNote(item.code);return <label key={item.code}><input type="checkbox" name="purposeCode" value={item.code} defaultChecked={selected.has(item.code)}/><span><b>{item.label}</b>{note?<small>{note}</small>:null}</span></label>})}</div>
    <small className="field-note">Leave clear for a normal flight. Structured recency credit still requires the applicable signed evidence.</small>
  </fieldset>;
}
