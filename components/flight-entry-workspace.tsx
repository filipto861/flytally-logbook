"use client";

import { useEffect,useRef,useState,type ReactNode } from "react";
import { QuickAircraftForm } from "@/components/quick-aircraft-form";

type Mode="gps"|"manual";
type AircraftSaveResult={ok:boolean;message:string};
type AircraftAction=(form:FormData)=>Promise<AircraftSaveResult>;

export function FlightEntryWorkspace({gps,manual,aircraftAction,aircraftCount,initialMode="manual"}:{gps:ReactNode;manual:ReactNode;aircraftAction:AircraftAction;aircraftCount:number;initialMode?:Mode}){
  const[mode,setMode]=useState<Mode>(initialMode),[aircraftOpen,setAircraftOpen]=useState(false),[aircraftNotice,setAircraftNotice]=useState("");
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!aircraftOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setAircraftOpen(false)};document.addEventListener("keydown",onKey);closeButton.current?.focus();return()=>document.removeEventListener("keydown",onKey)},[aircraftOpen]);
  const aircraftSaved=()=>{setAircraftOpen(false);setAircraftNotice("Aircraft added. Select it below to continue with the flight.")};
  return <div className="flight-entry-workspace">
    <section className="entry-choice" aria-label="Choose how to add a flight">
      <button type="button" className={mode==="manual"?"active":""} aria-pressed={mode==="manual"} onClick={()=>setMode("manual")}><span>01</span><strong>Manual entry</strong><small>Best for a normal logbook entry</small></button>
      <button type="button" className={mode==="gps"?"active":""} aria-pressed={mode==="gps"} onClick={()=>setMode("gps")}><span>02</span><strong>Import GPS track</strong><small>Use KML, GPX or CSV when you have a track</small></button>
    </section>
    {!aircraftCount?<section className="first-aircraft-callout" aria-labelledby="first-aircraft-heading"><div><span aria-hidden="true">✈</span><div><strong id="first-aircraft-heading">Start by adding the aircraft you fly</strong><p>FlyTally will remember its logbook, class and defaults so future flights need fewer choices.</p></div></div><button type="button" className="primary-button" onClick={()=>setAircraftOpen(true)}>Add first aircraft</button></section>:null}
    {aircraftNotice?<p className="aircraft-added-notice" role="status">{aircraftNotice}</p>:null}
    <section className="panel entry-mode-panel" aria-live="polite">
      <header><div><p className="eyebrow">{mode==="gps"?"GPS IMPORT":"MANUAL ENTRY"}</p><h2>{mode==="gps"?"Review a GPS track":"Enter flight details"}</h2><p className="muted">{mode==="gps"?"Upload the track first. You will review every detected flight before anything is saved.":"Start with the flight itself. FlyTally keeps training, EASA and cost details out of the way until they are relevant."}</p></div><button type="button" className="secondary-link" onClick={()=>setAircraftOpen(true)}>＋ Add aircraft</button></header>
      <div hidden={mode!=="gps"}>{gps}</div>
      <div hidden={mode!=="manual"}>{manual}</div>
    </section>
    {aircraftOpen?<div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setAircraftOpen(false)}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="aircraft-dialog-title"><header><div><p className="eyebrow">AIRCRAFT</p><h2 id="aircraft-dialog-title">Add aircraft</h2><p className="muted">Registration, model and normal logbook are enough to start. Everything else is optional.</p></div><button ref={closeButton} type="button" className="modal-close" aria-label="Close" onClick={()=>setAircraftOpen(false)}>×</button></header><QuickAircraftForm action={aircraftAction} onSaved={aircraftSaved}/></section></div>:null}
  </div>;
}
