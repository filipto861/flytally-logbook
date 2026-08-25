"use client";

import { useEffect,useRef,useState,type ReactNode } from "react";

type Mode="gps"|"manual";

export function FlightEntryWorkspace({gps,manual,aircraft,initialMode="gps"}:{gps:ReactNode;manual:ReactNode;aircraft:ReactNode;initialMode?:Mode}){
  const[mode,setMode]=useState<Mode>(initialMode),[aircraftOpen,setAircraftOpen]=useState(false);
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!aircraftOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setAircraftOpen(false)};document.addEventListener("keydown",onKey);closeButton.current?.focus();return()=>document.removeEventListener("keydown",onKey)},[aircraftOpen]);
  return <div className="flight-entry-workspace">
    <section className="entry-choice" aria-label="Choose how to add a flight">
      <button type="button" className={mode==="gps"?"active":""} aria-pressed={mode==="gps"} onClick={()=>setMode("gps")}><span>01</span><strong>Import GPS track</strong><small>Start with KML, GPX or CSV</small></button>
      <button type="button" className={mode==="manual"?"active":""} aria-pressed={mode==="manual"} onClick={()=>setMode("manual")}><span>02</span><strong>Manual entry</strong><small>Enter a flight without a track</small></button>
    </section>
    <section className="panel entry-mode-panel" aria-live="polite">
      <header><div><p className="eyebrow">{mode==="gps"?"GPS IMPORT":"MANUAL ENTRY"}</p><h2>{mode==="gps"?"Review a GPS track":"Enter flight details"}</h2><p className="muted">{mode==="gps"?"Upload the track first. You will review every detected flight before anything is saved.":"Complete the essentials first; training, EASA and cost fields appear only when needed."}</p></div><button type="button" className="secondary-link" onClick={()=>setAircraftOpen(true)}>＋ Add aircraft</button></header>
      <div hidden={mode!=="gps"}>{gps}</div>
      <div hidden={mode!=="manual"}>{manual}</div>
    </section>
    {aircraftOpen?<div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setAircraftOpen(false)}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="aircraft-dialog-title"><header><div><p className="eyebrow">AIRCRAFT</p><h2 id="aircraft-dialog-title">Add aircraft</h2><p className="muted">The new aircraft will be available for future flight entries.</p></div><button ref={closeButton} type="button" className="modal-close" aria-label="Close" onClick={()=>setAircraftOpen(false)}>×</button></header>{aircraft}</section></div>:null}
  </div>;
}
