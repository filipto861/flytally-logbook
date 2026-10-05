"use client";

import { FLIGHT_PURPOSES,flightPurposeApplicable,normalizeFlightPurposeCodes } from "@/lib/flight-purpose";

const purposeNote=(code:string)=>code==="SEP_TMG_FCL740A_REFRESHER"?"Refresher-training marker; it does not by itself revalidate the rating.":code==="LAPL_FCL140A_REFRESHER"?"Recency credit requires the applicable signed instructor evidence.":code==="LAPL_H_FCL140H_REFRESHER"?"Recency credit requires signed instructor evidence on the same helicopter type.":code==="SPL_SFCL160_TRAINING"?"Recency credit requires signed instructor evidence.":code==="BPL_BFCL160_TRAINING"?"Recency credit requires signed FI(B) evidence in the relevant balloon class.":code==="AIRCRAFT_DIFFERENCES"?"Pair with endorsement evidence where applicable.":"";

export function FlightPurposePicker({value="",regulatoryCategory="OTHER",role="",instructor=""}:{value?:unknown;regulatoryCategory?:string;role?:string;instructor?:string}){
  const selected=new Set(normalizeFlightPurposeCodes(value)),context={regulatoryCategory,role,instructor};
  const visible=FLIGHT_PURPOSES.filter(item=>selected.has(item.code)||flightPurposeApplicable(item.code,context));
  return <fieldset className="flight-purpose-picker wide">
    <legend>Training purpose</legend>
    <input type="hidden" name="purposeSelectionPresent" value="yes"/>
    <div className="flight-purpose-options">{visible.map(item=>{
      const applicable=flightPurposeApplicable(item.code,context),note=applicable?purposeNote(item.code):"Stored purpose · preserved until you clear it explicitly.";
      return <label key={item.code}><input type="checkbox" name="purposeCode" value={item.code} defaultChecked={selected.has(item.code)}/><span><b>{item.label}</b>{note?<small>{note}</small>:null}</span></label>
    })}</div>
    <small className="field-note">{visible.length?"Leave clear for a normal flight. Structured recency credit still requires the applicable signed evidence.":"No structured training purpose applies to this flight context. Use Task / exercise for descriptive training notes."}</small>
  </fieldset>;
}
