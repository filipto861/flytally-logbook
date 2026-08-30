"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FlightTrackSummary } from "@/lib/data/flight-track-review";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
type UploadAction=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type SimpleAction=(data:FormData)=>Promise<void>;
function UploadButton(){const {pending}=useFormStatus();return <button className="primary-button" disabled={pending}>{pending?"Saving…":"Save track"}</button>}
function stamp(value:string){if(!value)return"";const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):value}
export function TrackManager({tracks,attachAction,applyAction,deleteAction}:{flightId:number;tracks:FlightTrackSummary[];attachAction:UploadAction;applyAction:SimpleAction;deleteAction:SimpleAction}){
 const [state,action]=useActionState(attachAction,{});
 return <details className="panel track-manager"><summary>GPS tracks <b>{tracks.length}</b></summary><div className="track-manager-grid"><form action={action} className="stack-form"><label>KML, GPX or CSV<input type="file" name="kml" accept=".kml,.gpx,.csv,application/xml,text/xml,text/csv" required/></label><label className="check-row"><input type="checkbox" name="replace"/> Replace existing tracks</label>{state.error?<p className="form-error">{state.error}</p>:null}{state.success?<p className="form-success">{state.success}</p>:null}<UploadButton/></form><div className="stack-form">{tracks.length?<><div className="gps-apply-block"><form action={applyAction}><button className="secondary-link">Apply GPS time suggestions</button></form><small>Replaces BLOCK and AIR time fields with the current GPS-derived suggestion. Review the comparison above first.</small></div>{tracks.map(t=><form action={deleteAction} key={t.id} className="track-row track-source-row"><input type="hidden" name="trackId" value={t.id}/><span><strong>{t.fileName||`Track #${t.id}`}</strong><small>{t.distanceKm.toFixed(1)} km · {t.pointCount.toLocaleString("en-GB")} points{t.startUtc?` · ${stamp(t.startUtc)}`:""}</small></span><button className="icon-danger">Delete</button></form>)}</>:<p className="empty-state">No GPS tracks.</p>}</div></div></details>
}
