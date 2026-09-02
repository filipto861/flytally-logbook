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
const purposeNote=(code:string)=>code==="SEP_TMG_FCL740A_REFRESHER"?"Refresher-training element of revalidation by experience; it does not by itself revalidate the rating.":code==="LAPL_FCL140A_REFRESHER"?"Structured marker used by LAPL(A) recency when signed evidence is present.":code==="LAPL_H_FCL140H_REFRESHER"?"Structured FCL.140.H marker; LAPL(H) recency counts it only with signed instructor evidence on the same helicopter type.":code==="SPL_SFCL160_TRAINING"?"Structured Part-SFCL training marker; signed instructor evidence is required for recency credit.":code==="BPL_BFCL160_TRAINING"?"Structured BFCL.160 training-flight marker; recency counts it only with signed FI(B) evidence in the relevant balloon class.":code==="AIRCRAFT_DIFFERENCES"?"Use together with the aircraft endorsement record where applicable.":"Knowledge / familiarisation purpose where applicable.";

export function FlightPurposePicker({value="",regulatoryCategory="OTHER"}:{value?:unknown;regulatoryCategory?:string}){
  const selected=new Set(normalizeFlightPurposeCodes(value)),visible=FLIGHT_PURPOSES.filter(item=>visiblePurpose(item.code,regulatoryCategory));
  return <fieldset className="flight-purpose-picker wide">
    <legend>Training purpose</legend>
    <input type="hidden" name="purposeSelectionPresent" value="yes"/>
    <div className="flight-purpose-options">{visible.map(item=><label key={item.code}><input type="checkbox" name="purposeCode" value={item.code} defaultChecked={selected.has(item.code)}/><span><b>{item.label}</b><small>{purposeNote(item.code)}</small></span></label>)}</div>
    <small className="field-note">Choose only what actually applies. Leave all clear for a normal flight; Task / exercise remains free text. Structured recency purposes are shown only for the selected regulatory category. LAPL recency does not depend on free-text wording when the structured purpose and required signed evidence are present.</small>
  </fieldset>;
}
