"use client";

import Link from "next/link";
import { useActionState } from "react";

type Row=Record<string,unknown>;
type ShareState={ok:boolean;message:string};
type ShareAction=(state:ShareState,form:FormData)=>Promise<ShareState>;
const text=(value:unknown)=>String(value??"");

export function AircraftSharePanel({aircraft,connections,action}:{aircraft:Row;connections:Row[];action:ShareAction}){
  const[state,formAction,pending]=useActionState(action,{ok:false,message:""});
  const hasPhoto=Boolean(aircraft.has_photo),hasRate=Number(aircraft.current_price_per_hour||0)>0,rateCount=Number(aircraft.rate_count||0);
  return <section className="aircraft-share-section">
    <div className="modal-section-heading"><div><p className="eyebrow">SHARE</p><h3>Share aircraft profile</h3><p className="muted">Send a pre-filled copy to one of your Connections. After import, both pilots can edit their own aircraft independently.</p></div></div>
    {!connections.length?<div className="u31-empty-state compact"><strong>No Connections available</strong><span>Connect with the other pilot first. Aircraft sharing never exposes a public pilot directory.</span><Link className="secondary-button" href="/connections">Open Connections</Link></div>:<form action={formAction} className="aircraft-share-form">
      <input type="hidden" name="aircraft_id" value={text(aircraft.id)}/>
      <label>Pilot<select name="recipient_user_id" required defaultValue=""><option value="" disabled>Select a connection…</option>{connections.map(row=><option key={text(row.id)} value={text(row.id)}>{text(row.display_name)||"Pilot"}{text(row.home_airport)?` · ${text(row.home_airport)}`:""}</option>)}</select></label>
      <div className="aircraft-share-options">
        <div className="share-fixed-row"><span>✓</span><div><strong>Aircraft profile</strong><small>Registration, type, ICAO, ULL/EASA and regulatory classification are always included.</small></div></div>
        <label className="share-check"><input type="checkbox" name="include_photo" value="yes" defaultChecked={hasPhoto} disabled={!hasPhoto}/><span><strong>Cover photo</strong><small>{hasPhoto?"Copy the current aircraft cover.":"No aircraft photo saved."}</small></span></label>
        <label className="share-check"><input type="checkbox" name="include_defaults" value="yes" defaultChecked/><span><strong>Flight defaults</strong><small>Default role and billing basis/share. The recipient can change them afterwards.</small></span></label>
        <label className="share-check"><input type="checkbox" name="include_current_rate" value="yes" defaultChecked={hasRate} disabled={!hasRate}/><span><strong>Current hourly rate</strong><small>{hasRate?`${Number(aircraft.current_price_per_hour).toLocaleString("en-GB")} CZK/h`:"No current rate is set."}</small></span></label>
        <label className="share-check"><input type="checkbox" name="include_rate_history" value="yes" disabled={!rateCount}/><span><strong>Full rate history</strong><small>{rateCount?`${rateCount} saved rate record${rateCount===1?"":"s"}.`:"No rate history to send."}</small></span></label>
        <label className="share-check"><input type="checkbox" name="include_notes" value="yes"/><span><strong>Notes</strong><small>Off by default because notes may contain personal information.</small></span></label>
      </div>
      <p className="aircraft-share-privacy">This is a one-time copy, not shared ownership. Future edits, prices and photos are not synchronized.</p>
      <button className="primary-button" disabled={pending}>{pending?"Sending…":"Send aircraft profile"}</button>
      {state.message?<p className={state.ok?"form-success":"form-error"} role="status">{state.message}</p>:null}
    </form>}
  </section>;
}
