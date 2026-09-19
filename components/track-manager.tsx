"use client";
import { useActionState,useEffect,useState } from "react";
import { useFormStatus } from "react-dom";
import { PendingActionButton } from "@/components/pending-action-button";
import Link from "next/link";
import type { FlightTrackSummary } from "@/lib/data/flight-track-review";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
type UploadAction=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type SimpleAction=(data:FormData)=>Promise<void>;
function UploadButton(){const {pending}=useFormStatus();return <button className="primary-button" disabled={pending}>{pending?"Saving…":"Save track"}</button>}
function ApplyButton({reviewed}:{reviewed:boolean}){const{pending}=useFormStatus();return <button className="secondary-link" disabled={!reviewed||pending}>{pending?"Applying…":"Apply GPS time suggestions"}</button>}
function stamp(value:string){if(!value)return"";const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):value}
export function TrackManager({flightId,tracks,attachAction,applyAction,deleteAction}:{flightId:number;tracks:FlightTrackSummary[];attachAction:UploadAction;applyAction:SimpleAction;deleteAction:SimpleAction}){
 const [state,action]=useActionState(attachAction,{}),[reviewed,setReviewed]=useState(false),trackEvidenceKey=tracks.map(track=>[track.id,track.pointCount,track.startUtc,track.endUtc,track.distanceKm].join(":" )).join("|");
 useEffect(()=>setReviewed(false),[trackEvidenceKey,state.success]);
 return <details className="panel track-manager"><summary>GPS tracks <b>{tracks.length}</b></summary><div className="track-manager-grid"><form action={action} className="stack-form"><label>KML, GPX or CSV<input type="file" name="kml" accept=".kml,.gpx,.csv,application/xml,text/xml,text/csv" required/></label><label className="check-row"><input type="checkbox" name="replace"/> Replace existing tracks</label>{state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.success?<p className="form-success" role="status">{state.success}</p>:null}<UploadButton/></form><div className="stack-form">{tracks.length?<><div className="gps-apply-block"><p><strong>Review before applying GPS times</strong></p><small>Compare the current record with the GPS-derived BLOCK and AIR suggestions above. Applying them replaces all four time fields.</small><label className="check-row"><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/> I reviewed the current vs GPS comparison</label><form action={applyAction}><ApplyButton reviewed={reviewed}/></form><Link className="secondary-link" href={`/flights/${flightId}?tab=logbook`}>Review Logbook data</Link></div>{tracks.map(t=><form action={deleteAction} key={t.id} className="track-row track-source-row"><input type="hidden" name="trackId" value={t.id}/><span><strong>{t.fileName||`Track #${t.id}`}</strong><small>{t.distanceKm.toFixed(1)} km · {t.pointCount.toLocaleString("en-GB")} points{t.startUtc?` · ${stamp(t.startUtc)}`:""}</small></span><PendingActionButton className="icon-danger" pendingLabel="Deleting…">Delete</PendingActionButton></form>)}</>:<p className="empty-state">No GPS tracks.</p>}</div></div></details>
}
