"use client";

import { useActionState,useState } from "react";

type State={error?:string;voided?:boolean;tombstoneId?:number};
type Action=(previous:State,form:FormData)=>Promise<State>;

export function VoidCertifiedFlightButton({action}:{action:Action}){
  const[open,setOpen]=useState(false);
  const[state,formAction,pending]=useActionState(action,{});
  return <>
    <button type="button" className="danger-button" onClick={()=>setOpen(true)}>Remove certified flight</button>
    {open?<div className="modal-backdrop certified-void-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!pending)setOpen(false)}}>
      <section className="modal-card certified-void-dialog" role="dialog" aria-modal="true" aria-labelledby="certified-void-title">
        <header>
          <div>
            <p className="eyebrow">CERTIFIED RECORD</p>
            <h2 id="certified-void-title">Remove certified flight?</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close" disabled={pending} onClick={()=>setOpen(false)}>×</button>
        </header>
        <div className="certified-void-warning">
          <strong>This removes the flight from your active logbook.</strong>
          <p>It will no longer appear in Flights, totals, statistics, map, exports or recency/compliance calculations.</p>
          <p>The original certification, revision history and removal reason stay permanently preserved in the audit record.</p>
        </div>
        <form action={formAction} className="certified-void-form">
          <label>
            <span>Reason for removal <span className="field-hint">Required</span></span>
            <textarea name="reason" minLength={8} maxLength={1000} required autoFocus placeholder="Explain why this certified flight should no longer count in your logbook."/>
            <small>Minimum 8 characters. This reason becomes part of the permanent audit evidence.</small>
          </label>
          {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
          <div className="certified-void-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={()=>setOpen(false)}>Cancel</button>
            <button type="submit" className="danger-button" disabled={pending} aria-busy={pending||undefined} data-loading={pending?"true":undefined}>{pending?"Removing…":"Remove certified flight"}</button>
          </div>
        </form>
      </section>
    </div>:null}
  </>;
}
