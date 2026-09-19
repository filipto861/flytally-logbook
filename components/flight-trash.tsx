"use client";

import { useState } from "react";
import type { DeletedFlight } from "@/lib/flight-trash";
import type { TrashRestoreState } from "@/app/(protected)/export/actions";

type Action=(state:TrashRestoreState,form:FormData)=>Promise<TrashRestoreState>;

export function FlightTrash({flights,restoreAction}:{flights:DeletedFlight[];restoreAction:Action}){
  const [pending,setPending]=useState<number|null>(null),[state,setState]=useState<TrashRestoreState>({});
  const restore=async(id:number)=>{const data=new FormData();data.set("trash_id",String(id));setPending(id);setState({});try{setState(await restoreAction({},data))}finally{setPending(null)}};
  return <section className="panel flight-trash"><header><div><p className="eyebrow">RECENTLY DELETED</p><h2>Flight recycle bin</h2></div><span>{flights.length}</span></header>
    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.success?<p className="form-success" role="status">✓ {state.success}</p>:null}
    {flights.length?<div className="trash-list">{flights.map(flight=><article key={flight.id}><div><strong>{flight.registration} · {flight.date}</strong><span>{flight.departure||"—"} → {flight.arrival||"—"}</span><small>Deleted {new Date(flight.deletedAt).toLocaleString("en-GB")} · {flight.trackCount} GPS tracks</small></div><button type="button" className="secondary-button" disabled={pending!==null} aria-busy={pending===flight.id||undefined} data-loading={pending===flight.id?"true":undefined} onClick={()=>restore(flight.id)}>{pending===flight.id?"Restoring…":"Restore flight"}</button></article>)}</div>:<p className="empty-state">No deleted flights.</p>}
  </section>;
}
