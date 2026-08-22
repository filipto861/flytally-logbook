"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { MapTrack } from "@/lib/data/tracks";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
type UploadAction=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type SimpleAction=(data:FormData)=>Promise<void>;
function UploadButton(){const {pending}=useFormStatus();return <button className="primary-button" disabled={pending}>{pending?"Saving…":"Save track"}</button>}
export function TrackManager({tracks,attachAction,applyAction,deleteAction}:{flightId:number;tracks:MapTrack[];attachAction:UploadAction;applyAction:SimpleAction;deleteAction:SimpleAction}){
 const [state,action]=useActionState(attachAction,{});
 return <details className="panel track-manager"><summary>GPS tracks <b>{tracks.length}</b></summary><div className="track-manager-grid"><form action={action} className="stack-form"><label>KML, GPX or CSV<input type="file" name="kml" accept=".kml,.gpx,.csv,application/xml,text/xml,text/csv" required/></label><label className="check-row"><input type="checkbox" name="replace"/> Replace existing tracks</label>{state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}<UploadButton/></form><div className="stack-form">{tracks.length?<><form action={applyAction}><button className="secondary-link">Use GPS times for BLOCK and AIR</button></form>{tracks.map(t=><form action={deleteAction} key={t.id} className="track-row"><input type="hidden" name="trackId" value={t.id}/><span>Track #{t.id} · {t.distanceKm.toFixed(1)} km</span><button className="icon-danger">Delete</button></form>)}</>:<p className="empty-state">No GPS tracks.</p>}</div></div></details>
}
