"use client";

import { useActionState,useEffect,useMemo,useRef,useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { FlightRow } from "@/lib/data/flights";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
import { BILLING,CLASSES,EVIDENCE,ROLES } from "@/lib/flight-input";
import { defaultEngineType,ENGINE_TYPES,formatEasaDuration,OPERATION_TYPES } from "@/lib/easa-logbook";
import { BILLING_SHARES,calculatedFlightPrice,parseBilling,serializeBilling } from "@/lib/billing";
import { FLIGHT_DRAFT_ACTIVE_SCOPE_KEY,flightDraftStorageKey,parseFlightDraft } from "@/lib/offline-flight-draft";

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type Initial=Partial<FlightRow>&Record<string,unknown>;

function addTime(value:string,minutes:number){if(!/^\d\d:\d\d$/.test(value))return"";const total=(Number(value.slice(0,2))*60+Number(value.slice(3))+minutes+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`}
function minutesBetween(start:string,end:string){if(!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end))return 0;const a=Number(start.slice(0,2))*60+Number(start.slice(3)),b=Number(end.slice(0,2))*60+Number(end.slice(3));return(b-a+1440)%1440}
const roleLabel=(value:string)=>value==="INSTRUKTOR"?"INSTRUCTOR":value;
const draftId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`draft_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
const controlledDraftFields=new Set(["registration","role","evidence","aircraftType","aircraftClass","billingBasis","billingShare","departure","arrival","offBlock","onBlock","takeoff","landing","operationType","engineType","landingsDay","landingsNight"]);

function Submit({another=false}:{another?:boolean}){
  const{pending}=useFormStatus();
  return <button className={another?"secondary-link":"primary-button"} name="intent" value={another?"another":"save"} disabled={pending}>{pending?"Saving…":another?"Save and add another":"Save flight"}</button>;
}

export function FlightForm({action,aircraft,initial={},routes=[],draftScope=""}:{action:Action;aircraft:AircraftOption[];initial?:Initial;routes?:Array<{departure:string;arrival:string}>;draftScope?:string}){
  const[state,formAction]=useActionState(action,{}),field=(name:string,fallback="")=>String(initial[name]??fallback),editing=Boolean(initial.id),storageKey=flightDraftStorageKey(draftScope);
  const formRef=useRef<HTMLFormElement>(null),draftTokenRef=useRef<HTMLInputElement>(null),saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const[draftKey,setDraftKey]=useState(""),[draftStatus,setDraftStatus]=useState("");
  const initialRegistration=field("registration",aircraft[0]?.registration||"").trim().toUpperCase();
  const normalizedAircraft=useMemo(()=>aircraft.map(item=>({...item,registration:item.registration.trim().toUpperCase()})),[aircraft]);
  const[registration,setRegistration]=useState(initialRegistration);
  const selected=useMemo(()=>normalizedAircraft.find(x=>x.registration===registration),[normalizedAircraft,registration]);
  const registrationOptions=useMemo(()=>{const extras:AircraftOption[]=[];for(const value of [initialRegistration,registration])if(value&&!normalizedAircraft.some(item=>item.registration===value)&&!extras.some(item=>item.registration===value))extras.push({registration:value} as AircraftOption);return[...extras,...normalizedAircraft]},[initialRegistration,registration,normalizedAircraft]);
  const initialBilling=parseBilling(field("billing_basis",selected?.billing_basis||"BLOCK"));
  const initialRole=field("role",selected?.default_role||"PIC")==="INSTRUKTOR"?"INSTRUCTOR":field("role",selected?.default_role||"PIC");
  const[type,setType]=useState(field("aircraft_type",selected?.aircraft_type||""));
  const[aircraftClass,setClass]=useState(field("aircraft_class",selected?.aircraft_class||"ULL"));
  const[evidence,setEvidence]=useState(field("evidence",selected?.evidence||"ULL"));
  const[role,setRole]=useState(initialRole);
  const[billing,setBilling]=useState(initialBilling.basis);
  const[billingShare,setBillingShare]=useState(initialBilling.share);
  const[hourlyRate,setHourlyRate]=useState(Number(field("price_per_hour",String(selected?.price_per_hour||0)))||0);
  const[departure,setDeparture]=useState(field("departure"));
  const[arrival,setArrival]=useState(field("arrival"));
  const[off,setOff]=useState(field("off_block"));
  const[takeoff,setTakeoff]=useState(field("takeoff"));
  const[landing,setLanding]=useState(field("landing"));
  const[on,setOn]=useState(field("on_block"));
  const[duration,setDuration]=useState(60);
  const[operationType,setOperationType]=useState(field("operation_type","SP"));
  const[engineType,setEngineType]=useState(field("engine_type",defaultEngineType(field("aircraft_class",selected?.aircraft_class||"ULL"))));
  const[landingsDay,setLandingsDay]=useState(Number(field("landings_day",field("starts","1")))||0);
  const[landingsNight,setLandingsNight]=useState(Number(field("landings_night","0"))||0);

  const pickAircraft=(reg:string)=>{
    const normalized=reg.trim().toUpperCase();setRegistration(normalized);
    const a=normalizedAircraft.find(x=>x.registration===normalized);
    if(a){
      const nextBilling=parseBilling(a.billing_basis),nextClass=a.aircraft_class||"ULL";
      setType(a.aircraft_type||"");setClass(nextClass);setEngineType(defaultEngineType(nextClass));setEvidence(a.evidence||"ULL");setRole(a.default_role==="INSTRUKTOR"?"INSTRUCTOR":a.default_role||"PIC");setBilling(nextBilling.basis);setBillingShare(nextBilling.share);setHourlyRate(Number(a.price_per_hour)||0);
    }
  };

  const persistLocalDraft=()=>{
    if(editing||!storageKey||!formRef.current)return;
    const data=new FormData(formRef.current),values:Record<string,string>={};
    for(const [key,value] of data.entries())if(typeof value==="string"&&key!=="clientDraftId"&&key!=="intent")values[key]=value;
    let id=draftTokenRef.current?.value||draftKey;if(!id){id=draftId();if(draftTokenRef.current)draftTokenRef.current.value=id;setDraftKey(id)}
    const updatedAt=new Date().toISOString();localStorage.setItem(FLIGHT_DRAFT_ACTIVE_SCOPE_KEY,draftScope);localStorage.setItem(storageKey,JSON.stringify({version:1,id,updatedAt,values}));
    setDraftStatus(`Saved locally · ${new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(updatedAt))}`);
  };
  const scheduleLocalDraft=()=>{if(editing||!storageKey)return;if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(persistLocalDraft,350)};
  const clearLocalDraft=()=>{if(saveTimer.current)clearTimeout(saveTimer.current);if(storageKey)localStorage.removeItem(storageKey);if(draftTokenRef.current)draftTokenRef.current.value="";setDraftKey("");setDraftStatus("Local draft cleared.")};

  useEffect(()=>{
    if(editing||!storageKey)return;
    localStorage.setItem(FLIGHT_DRAFT_ACTIVE_SCOPE_KEY,draftScope);
    const draft=parseFlightDraft(localStorage.getItem(storageKey));if(!draft)return;
    const v=draft.values;setDraftKey(draft.id);if(draftTokenRef.current)draftTokenRef.current.value=draft.id;
    if(v.registration!==undefined)pickAircraft(v.registration);
    if(v.aircraftType!==undefined)setType(v.aircraftType);if(v.aircraftClass!==undefined)setClass(v.aircraftClass);if(v.evidence!==undefined)setEvidence(v.evidence);if(v.role!==undefined)setRole(v.role);
    if(v.billingBasis==="BLOCK"||v.billingBasis==="AIR")setBilling(v.billingBasis);if(v.billingShare&&Number(v.billingShare)>0)setBillingShare(Number(v.billingShare));
    if(v.departure!==undefined)setDeparture(v.departure);if(v.arrival!==undefined)setArrival(v.arrival);if(v.offBlock!==undefined)setOff(v.offBlock);if(v.takeoff!==undefined)setTakeoff(v.takeoff);if(v.landing!==undefined)setLanding(v.landing);if(v.onBlock!==undefined)setOn(v.onBlock);
    if(v.operationType!==undefined)setOperationType(v.operationType);if(v.engineType!==undefined)setEngineType(v.engineType);if(v.landingsDay!==undefined)setLandingsDay(Number(v.landingsDay)||0);if(v.landingsNight!==undefined)setLandingsNight(Number(v.landingsNight)||0);
    const timer=setTimeout(()=>{const form=formRef.current;if(!form)return;for(const [name,value] of Object.entries(v)){if(controlledDraftFields.has(name))continue;const item=form.elements.namedItem(name);if(item instanceof HTMLInputElement||item instanceof HTMLTextAreaElement||item instanceof HTMLSelectElement)item.value=value}},0);
    setDraftStatus(`Restored local draft · ${new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(draft.updatedAt))}`);
    return()=>clearTimeout(timer);
  // restore is intentionally performed once per scoped new-flight form
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[editing,storageKey,draftScope]);
  useEffect(()=>()=>{if(saveTimer.current)clearTimeout(saveTimer.current)},[]);

  const fillTimes=()=>{const start=off||new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"});setOff(start);setTakeoff(addTime(start,5));setLanding(addTime(start,5+duration));setOn(addTime(start,10+duration));setTimeout(scheduleLocalDraft,0)};
  const blockMinutes=minutesBetween(off,on),airMinutes=minutesBetween(takeoff,landing),billableMinutes=billing==="AIR"?airMinutes:blockMinutes,billingValue=serializeBilling(billing,billingShare),flightPrice=calculatedFlightPrice(hourlyRate,blockMinutes,airMinutes,billingValue);
  const trainingRole=["DUAL","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(role),countersignatureRequired=["SPIC","PICUS"].includes(role);

  const draftEnabled=!editing&&Boolean(storageKey);
  return <form ref={formRef} action={formAction} className="flight-form" onInput={draftEnabled?scheduleLocalDraft:undefined} onChange={draftEnabled?scheduleLocalDraft:undefined} onSubmit={draftEnabled?persistLocalDraft:undefined}>
    {draftEnabled?<><input ref={draftTokenRef} type="hidden" name="clientDraftId"/><div className="local-draft-bar"><div><strong>{draftKey?"Offline-safe local draft":"Offline-safe entry"}</strong><small>{draftStatus||"Changes are kept for this account on this device while you fill the flight."}</small></div>{draftKey?<button type="button" className="secondary-button" onClick={clearLocalDraft}>Clear</button>:null}</div></>:null}
    {!editing?<details className="quick-tools" open><summary>Quick tools</summary><div className="quick-tools-grid"><label>Flight duration (min)<input type="number" min="1" max="1440" value={duration} onChange={e=>setDuration(Number(e.target.value)||1)}/></label><button type="button" className="secondary-link" onClick={fillTimes}>Fill UTC times ±5 min</button><button type="button" className="secondary-link" onClick={()=>{setDeparture(arrival);setArrival(departure);setTimeout(scheduleLocalDraft,0)}}>Reverse route</button></div>{routes.length?<div className="route-chips">{routes.slice(0,12).map((r,i)=><button type="button" key={`${r.departure}-${r.arrival}-${i}`} onClick={()=>{setDeparture(r.departure);setArrival(r.arrival);setTimeout(scheduleLocalDraft,0)}}>{r.departure}–{r.arrival}</button>)}</div>:null}</details>:null}

    <section className="entry-section entry-section-primary">
      <p className="section-kicker">Flight essentials</p>
      <div className="form-grid essential-grid">
        <label>Date<input name="date" type="date" defaultValue={field("date",new Date().toISOString().slice(0,10))} required/></label>
        <label>Registration<select name="registration" value={registration} onChange={e=>pickAircraft(e.target.value)} required><option value="">Select</option>{registrationOptions.map(a=><option key={a.registration} value={a.registration}>{a.registration}</option>)}</select><small><Link href="/database">Manage aircraft</Link></small></label>
        <label>Role<select name="role" value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(x=><option key={x} value={x}>{roleLabel(x)}</option>)}</select></label>
        <label>Day landings<input name="landingsDay" type="number" min="0" max="99" value={landingsDay} onChange={event=>setLandingsDay(Number(event.target.value)||0)}/></label>
        <label>Departure<input name="departure" value={departure} onChange={e=>setDeparture(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
        <label>Arrival<input name="arrival" value={arrival} onChange={e=>setArrival(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
        <label>Off-block <span className="field-hint">UTC</span><input name="offBlock" type="time" value={off} onChange={e=>setOff(e.target.value)}/></label>
        <label>On-block <span className="field-hint">UTC</span><input name="onBlock" type="time" value={on} onChange={e=>setOn(e.target.value)}/></label>
        <label>Takeoff <span className="field-hint">UTC</span><input name="takeoff" type="time" value={takeoff} onChange={e=>setTakeoff(e.target.value)}/></label>
        <label>Landing <span className="field-hint">UTC</span><input name="landing" type="time" value={landing} onChange={e=>setLanding(e.target.value)}/></label>
      </div>
    </section>

    <details className="entry-section" open={trainingRole}>
      <summary><span>Pilot & training</span><small>{role}{field("instructor")?` · ${field("instructor")}`:""}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        <label>Commander / PIC<input name="commander" defaultValue={field("commander")}/></label>
        <label>Instructor<input name="instructor" defaultValue={field("instructor")}/></label>
        <label className="wide">Task / exercise<input name="task" defaultValue={field("task")}/></label>
      </div></div>
    </details>

    <details className="entry-section" open={evidence==="EASA"}>
      <summary><span>Aircraft & EASA record</span><small>{evidence} · {operationType} · {engineType}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        <label>Logbook<select name="evidence" value={evidence} onChange={e=>setEvidence(e.target.value)}>{EVIDENCE.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Aircraft type<input name="aircraftType" value={type} onChange={e=>setType(e.target.value)}/></label>
        <label>Class<select name="aircraftClass" value={aircraftClass} onChange={e=>{setClass(e.target.value);setEngineType(defaultEngineType(e.target.value))}}>{CLASSES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Operation<select name="operationType" value={operationType} onChange={event=>setOperationType(event.target.value)}>{OPERATION_TYPES.map(value=><option key={value}>{value}</option>)}</select><small>Single-pilot / multi-pilot</small></label>
        <label>Engine<select name="engineType" value={engineType} onChange={event=>setEngineType(event.target.value)}>{ENGINE_TYPES.map(value=><option key={value}>{value}</option>)}</select><small>Single-engine / multi-engine</small></label>
        <label>Night landings<input name="landingsNight" type="number" min="0" max="99" value={landingsNight} onChange={event=>setLandingsNight(Number(event.target.value)||0)}/></label>
        <label>Night time<input name="nightTime" inputMode="numeric" placeholder="0:00" defaultValue={formatEasaDuration(field("night_minutes","0"))}/></label>
        <label>IFR time<input name="ifrTime" inputMode="numeric" placeholder="0:00" defaultValue={formatEasaDuration(field("ifr_minutes","0"))}/></label>
        {countersignatureRequired?<><label>Supervising PIC / FI<input name="verificationName" defaultValue={field("verification_name")} required/><small>Required for {role} credit.</small></label><label>Countersignature reference<input name="verificationReference" defaultValue={field("verification_reference")} required/><small>Reference to the supervising PIC/FI countersignature or signed evidence.</small></label></>:<><input type="hidden" name="verificationName" value={field("verification_name")}/><input type="hidden" name="verificationReference" value={field("verification_reference")}/></>}
      </div></div>
    </details>

    <details className="entry-section">
      <summary><span>Cost & notes</span><small>{billing} · 1/{billingShare}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        <label>Billing time<select name="billingBasis" value={billing} onChange={e=>setBilling(e.target.value as "BLOCK"|"AIR")}>{BILLING.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>My share<select name="billingShare" value={billingShare} onChange={e=>setBillingShare(Number(e.target.value))}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
        <label className="wide">Notes<textarea name="note" rows={3} defaultValue={field("note")}/></label>
      </div><section className="price-preview compact-price" aria-live="polite"><div><span>Calculated flight cost</span><strong>{hourlyRate>0&&billableMinutes>0?`${Math.round(flightPrice).toLocaleString("en-GB")} CZK`:"—"}</strong></div><small>{hourlyRate>0?`${hourlyRate.toLocaleString("en-GB")} CZK/h · ${billing} ${billing==="AIR"?`${Math.floor(airMinutes/60)}:${String(airMinutes%60).padStart(2,"0")}`:`${Math.floor(blockMinutes/60)}:${String(blockMinutes%60).padStart(2,"0")}`} · 1/${billingShare}`:"Hourly rate missing"}</small></section></div>
    </details>

    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
    {state.success?<p className="form-success" role="status">{state.success}</p>:null}
    <div className="form-actions field-actions"><Submit/>{!editing?<Submit another/>:null}</div>
  </form>;
}
