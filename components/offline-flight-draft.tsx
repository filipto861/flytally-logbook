"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { FLIGHT_DRAFT_ACTIVE_SCOPE_KEY,flightDraftStorageKey,flightDraftSummary,parseFlightDraft,type StoredFlightDraft } from "@/lib/offline-flight-draft";

const draftId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`draft_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
const today=()=>new Date().toISOString().slice(0,10);

export function OfflineFlightDraft(){
  const[draft,setDraft]=useState<StoredFlightDraft|null>(null),[online,setOnline]=useState(true),[message,setMessage]=useState(""),[scope,setScope]=useState("");
  const values=draft?.values??{},storageKey=flightDraftStorageKey(scope);

  useEffect(()=>{
    const activeScope=localStorage.getItem(FLIGHT_DRAFT_ACTIVE_SCOPE_KEY)||"";setScope(activeScope);setOnline(navigator.onLine);
    const key=flightDraftStorageKey(activeScope);setDraft(key?parseFlightDraft(localStorage.getItem(key)):null);
    const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);
    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline)};
  },[]);

  const update=(key:string,value:string)=>{
    if(!storageKey)return;
    const next:StoredFlightDraft={version:1,id:draft?.id||draftId(),updatedAt:new Date().toISOString(),values:{...(draft?.values??{date:today(),role:"PIC",landingsDay:"1"}),[key]:value}};
    localStorage.setItem(storageKey,JSON.stringify(next));setDraft(next);setMessage("Saved on this device.");
  };
  const save=()=>{
    if(!storageKey){setMessage("Open FlyTally online once before using an offline draft on this device.");return}
    const next=draft??{version:1 as const,id:draftId(),updatedAt:new Date().toISOString(),values:{date:today(),role:"PIC",landingsDay:"1"}};
    const stored={...next,updatedAt:new Date().toISOString()};
    localStorage.setItem(storageKey,JSON.stringify(stored));setDraft(stored);setMessage("Saved on this device.");
  };
  const clear=()=>{if(storageKey)localStorage.removeItem(storageKey);setDraft(null);setMessage("Local draft cleared.")};
  const updated=useMemo(()=>draft?.updatedAt?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(draft.updatedAt)):"",[draft?.updatedAt]);

  return <section className="offline-draft-card">
    <div className="offline-draft-heading"><div><p className="eyebrow">LOCAL DRAFT</p><h2>{draft?flightDraftSummary(draft):storageKey?"New offline flight draft":"Offline draft unavailable"}</h2><p className="muted">{storageKey?"Stored only for the last signed-in FlyTally account on this browser until you review and save it online.":"Sign in online on this device once to establish a private offline draft scope."}</p></div><span className={`network-pill ${online?"online":"offline"}`}>{online?"Online":"Offline"}</span></div>
    {storageKey?<><div className="form-grid essential-grid offline-draft-grid">
      <label>Date<input type="date" value={values.date||today()} onChange={event=>update("date",event.target.value)}/></label>
      <label>Registration<input value={values.registration||""} autoCapitalize="characters" placeholder="OK-ABC" onChange={event=>update("registration",event.target.value.toUpperCase())}/></label>
      <label>Departure<input value={values.departure||""} autoCapitalize="characters" placeholder="LKLT" onChange={event=>update("departure",event.target.value.toUpperCase())}/></label>
      <label>Arrival<input value={values.arrival||""} autoCapitalize="characters" placeholder="LKPR" onChange={event=>update("arrival",event.target.value.toUpperCase())}/></label>
      <label>Off-block <span className="field-hint">UTC</span><input type="time" value={values.offBlock||""} onChange={event=>update("offBlock",event.target.value)}/></label>
      <label>On-block <span className="field-hint">UTC</span><input type="time" value={values.onBlock||""} onChange={event=>update("onBlock",event.target.value)}/></label>
      <label>Role<select value={values.role||"PIC"} onChange={event=>update("role",event.target.value)}><option>PIC</option><option>SOLO</option><option>DUAL</option><option>SPIC</option><option>PICUS</option><option>INSTRUCTOR</option><option>EXAMINER</option><option>CO-PILOT</option></select></label>
      <label>Landings<input type="number" min="0" max="99" value={values.landingsDay||"1"} onChange={event=>update("landingsDay",event.target.value)}/></label>
      <label className="wide">Notes<textarea rows={3} value={values.note||""} onChange={event=>update("note",event.target.value)}/></label>
    </div>
    <div className="offline-draft-actions"><button type="button" className="primary-button" onClick={save}>Save now</button>{draft?<button type="button" className="secondary-button" onClick={clear}>Clear draft</button>:null}{online?<Link className="secondary-link" href="/flights/new?mode=manual">Continue in Add Flight</Link>:null}</div></>:<div className="offline-draft-actions">{online?<Link className="primary-link" href="/login">Sign in</Link>:null}</div>}
    {updated?<small className="muted">Last local update: {updated}</small>:null}{message?<p className="form-success">{message}</p>:null}
  </section>;
}
