"use client";

import { FLIGHT_PURPOSES,normalizeFlightPurposeCodes } from "@/lib/flight-purpose";

export function FlightPurposePicker({value=""}:{value?:unknown}){
  const selected=new Set(normalizeFlightPurposeCodes(value));
  return <fieldset className="flight-purpose-picker wide">
    <legend>Training purpose</legend>
    <input type="hidden" name="purposeSelectionPresent" value="yes"/>
    <div className="flight-purpose-options">{FLIGHT_PURPOSES.map(item=><label key={item.code}><input type="checkbox" name="purposeCode" value={item.code} defaultChecked={selected.has(item.code)}/><span><b>{item.label}</b><small>{item.code==="SEP_TMG_FCL740A_REFRESHER"?"Refresher-training element of revalidation by experience; it does not by itself revalidate the rating.":item.code==="LAPL_FCL140A_REFRESHER"?"Structured marker used by the LAPL recency review when signed evidence is present.":item.code==="AIRCRAFT_DIFFERENCES"?"Use together with the aircraft endorsement record where applicable.":"Knowledge / familiarisation purpose where applicable."}</small></span></label>)}</div>
    <small className="field-note">Choose any combination that applies. Leave all clear for a normal flight; Task / exercise remains free text.</small>
  </fieldset>;
}
