"use client";

import { useEffect,useRef,useState,type ReactNode } from "react";
import { QuickAircraftForm } from "@/components/quick-aircraft-form";

type Mode="gps"|"manual";
type AircraftSaveResult={ok:boolean;message:string};
type AircraftAction=(form:FormData)=>Promise<AircraftSaveResult>;

export function FlightEntryWorkspace({gps,manual,aircraftAction,aircraftCount,initialMode="manual"}:{gps:ReactNode;manual:ReactNode;aircraftAction:AircraftAction;aircraftCount:number;initialMode?:Mode}){
  const[mode,setMode]=useState<Mode>(initialMode),[aircraftOpen,setAircraftOpen]=useState(false),[aircraftNotice,setAircraftNotice]=useState("");
  const closeButton=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),opener=useRef<HTMLButtonElement|null>(null);
  const openAircraft=(button:HTMLButtonElement)=>{opener.current=button;setAircraftOpen(true)};
  const closeAircraft=()=>{setAircraftOpen(false);requestAnimationFrame(()=>opener.current?.focus())};
  useEffect(()=>{
    if(!aircraftOpen)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeAircraft();return}
      if(event.key!=="Tab"||!dialog.current)return;
      const controls=[...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hasAttribute("hidden")&&node.getAttribute("aria-hidden")!=="true");
      if(!controls.length){event.preventDefault();closeButton.current?.focus();return}
      const first=controls[0],last=controls.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",onKey);closeButton.current?.focus();
    return()=>document.removeEventListener("keydown",onKey);
  },[aircraftOpen]);
  const aircraftSaved=()=>{setAircraftOpen(false);setAircraftNotice("Aircraft added. Select it below to continue with the flight.");requestAnimationFrame(()=>opener.current?.focus())};
  return <div className="flight-entry-workspace">
    <section className="entry-choice" aria-label="Choose how to add a flight">
      <button type="button" className={mode==="manual"?"active":""} aria-pressed={mode==="manual"} onClick={()=>setMode("manual")}><strong>Manual entry</strong><small>Normal logbook entry</small></button>
      <button type="button" className={mode==="gps"?"active":""} aria-pressed={mode==="gps"} onClick={()=>setMode("gps")}><strong>Import GPS track</strong><small>KML, GPX or CSV</small></button>
    </section>
    {!aircraftCount?<section className="first-aircraft-callout" aria-labelledby="first-aircraft-heading"><div><span aria-hidden="true">✈</span><div><strong id="first-aircraft-heading">Start by adding the aircraft you fly</strong><p>FlyTally will remember its logbook, class and defaults so future flights need fewer choices.</p></div></div><button type="button" className="primary-button" aria-haspopup="dialog" aria-expanded={aircraftOpen} aria-controls="quick-aircraft-dialog" onClick={event=>openAircraft(event.currentTarget)}>Add first aircraft</button></section>:null}
    {aircraftNotice?<p className="aircraft-added-notice" role="status">{aircraftNotice}</p>:null}
    <section className="panel entry-mode-panel" aria-live="polite">
      <header><div><p className="eyebrow">{mode==="gps"?"GPS IMPORT":"MANUAL ENTRY"}</p><h2>{mode==="gps"?"Review a GPS track":"Enter flight details"}</h2><p className="muted">{mode==="gps"?"Upload the track first. You will review every detected flight before anything is saved.":"Enter the flight itself first. Extra training, regulatory and cost fields stay collapsed unless they are needed."}</p></div><button type="button" className="secondary-link" aria-haspopup="dialog" aria-expanded={aircraftOpen} aria-controls="quick-aircraft-dialog" onClick={event=>openAircraft(event.currentTarget)}>＋ Add aircraft</button></header>
      <div hidden={mode!=="gps"}>{gps}</div>
      <div hidden={mode!=="manual"}>{manual}</div>
    </section>
    {aircraftOpen?<div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeAircraft()}}><section ref={dialog} id="quick-aircraft-dialog" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="aircraft-dialog-title"><header><div><p className="eyebrow">AIRCRAFT</p><h2 id="aircraft-dialog-title">Add aircraft</h2><p className="muted">Registration, model and normal logbook are enough to start. Everything else is optional.</p></div><button ref={closeButton} type="button" className="modal-close" aria-label="Close" onClick={closeAircraft}>×</button></header><QuickAircraftForm action={aircraftAction} onSaved={aircraftSaved}/></section></div>:null}
  </div>;
}
