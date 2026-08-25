"use client";

import { useActionState,useMemo,useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { FlightRow } from "@/lib/data/flights";
import type { FlightActionState } from "@/app/(protected)/flights/actions";
import { BILLING,CLASSES,EVIDENCE,ROLES } from "@/lib/flight-input";
import { defaultEngineType,ENGINE_TYPES,formatEasaDuration,OPERATION_TYPES } from "@/lib/easa-logbook";
import { BILLING_SHARES,calculatedFlightPrice,parseBilling,serializeBilling } from "@/lib/billing";
import { normalizeChoice,normalizeRegistration,shouldApplyAircraftProfileDefaults } from "@/lib/flight-form-rules";

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type Initial=Partial<FlightRow>&Record<string,unknown>;

function addTime(value:string,minutes:number){if(!/^\d\d:\d\d$/.test(value))return"";const total=(Number(value.slice(0,2))*60+Number(value.slice(3))+minutes+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`}
function minutesBetween(start:string,end:string){if(!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end))return 0;const a=Number(start.slice(0,2))*60+Number(start.slice(3)),b=Number(end.slice(0,2))*60+Number(end.slice(3));return(b-a+1440)%1440}
const roleLabel=(value:string)=>value==="INSTRUKTOR"?"INSTRUCTOR":value;
const validBilling=(value:string)=>/^(BLOCK|AIR)(?:\/\d+)?$/.test(value);

function Submit({another=false}:{another?:boolean}){
  const{pending}=useFormStatus();
  return <button className={another?"secondary-link":"primary-button"} name="intent" value={another?"another":"save"} disabled={pending}>{pending?"Saving…":another?"Save and add another":"Save flight"}</button>;
}

export function FlightForm({action,aircraft,initial={},routes=[]}:{action:Action;aircraft:AircraftOption[];initial?:Initial;routes?:Array<{departure:string;arrival:string}>}){
  const[state,formAction]=useActionState(action,{}),field=(name:string,fallback="")=>String(initial[name]??fallback),editing=Boolean(initial.id);
  const normalizedAircraft=useMemo(()=>aircraft.map(item=>({...item,registration:normalizeRegistration(item.registration)})),[aircraft]);
  const initialRegistration=normalizeRegistration(field("registration",editing?"":normalizedAircraft[0]?.registration||""));
  const[registration,setRegistration]=useState(initialRegistration);
  const selected=useMemo(()=>normalizedAircraft.find(x=>x.registration===registration),[normalizedAircraft,registration]);
  const registrationOptions=useMemo(()=>initialRegistration&&!normalizedAircraft.some(item=>item.registration===initialRegistration)?[{registration:initialRegistration} as AircraftOption,...normalizedAircraft]:normalizedAircraft,[initialRegistration,normalizedAircraft]);

  const storedEvidence=normalizeChoice(field("evidence"),EVIDENCE,"");
  const storedClass=normalizeChoice(field("aircraft_class"),CLASSES,"");
  const storedRole=normalizeChoice(field("role"),ROLES,"");
  const profileEvidence=normalizeChoice(selected?.evidence,EVIDENCE,"ULL");
  const profileClass=normalizeChoice(selected?.aircraft_class,CLASSES,"ULL");
  const profileRole=normalizeChoice(selected?.default_role==="INSTRUKTOR"?"INSTRUCTOR":selected?.default_role,ROLES,"PIC");
  const initialEvidence=editing?storedEvidence:(storedEvidence||profileEvidence);
  const initialClass=editing?storedClass:(storedClass||profileClass);
  const initialRole=editing?storedRole:(storedRole||profileRole);
  const storedBillingRaw=String(field("billing_basis")).trim().toUpperCase();
  const billingSource=editing?storedBillingRaw:(storedBillingRaw||String(selected?.billing_basis||"BLOCK"));
  const initialBilling=parseBilling(billingSource);
  const initialBillingBasis:""|"BLOCK"|"AIR"=editing&&!validBilling(storedBillingRaw)?"":initialBilling.basis;

  const[type,setType]=useState(editing?field("aircraft_type").trim():field("aircraft_type",selected?.aircraft_type||"").trim());
  const[aircraftClass,setClass]=useState<string>(initialClass);
  const[evidence,setEvidence]=useState<string>(initialEvidence);
  const[role,setRole]=useState<string>(initialRole);
  const[billing,setBilling]=useState<""|"BLOCK"|"AIR">(initialBillingBasis);
  const[billingShare,setBillingShare]=useState(initialBilling.share);
  const[hourlyRate,setHourlyRate]=useState(Number(field("price_per_hour",String(selected?.price_per_hour||0)))||0);
  const[departure,setDeparture]=useState(field("departure"));
  const[arrival,setArrival]=useState(field("arrival"));
  const[off,setOff]=useState(field("off_block"));
  const[takeoff,setTakeoff]=useState(field("takeoff"));
  const[landing,setLanding]=useState(field("landing"));
  const[on,setOn]=useState(field("on_block"));
  const[duration,setDuration]=useState(60);
  const[operationType,setOperationType]=useState(normalizeChoice(field("operation_type"),OPERATION_TYPES,"SP"));
  const[engineType,setEngineType]=useState(normalizeChoice(field("engine_type"),ENGINE_TYPES,defaultEngineType(initialClass||profileClass)));
  const[landingsDay,setLandingsDay]=useState(Number(field("landings_day",field("starts","1")))||0);
  const[landingsNight,setLandingsNight]=useState(Number(field("landings_night","0"))||0);

  const pickAircraft=(reg:string)=>{
    const normalized=normalizeRegistration(reg);setRegistration(normalized);
    const a=normalizedAircraft.find(x=>x.registration===normalized);
    if(a&&shouldApplyAircraftProfileDefaults(editing,initialRegistration,normalized)){
      const nextBilling=parseBilling(a.billing_basis),nextClass=normalizeChoice(a.aircraft_class,CLASSES,"ULL"),nextEvidence=normalizeChoice(a.evidence,EVIDENCE,"ULL"),nextRole=normalizeChoice(a.default_role==="INSTRUKTOR"?"INSTRUCTOR":a.default_role,ROLES,"PIC");
      setType(a.aircraft_type||"");setClass(nextClass);setEngineType(defaultEngineType(nextClass));setEvidence(nextEvidence);setRole(nextRole);setBilling(nextBilling.basis);setBillingShare(nextBilling.share);setHourlyRate(Number(a.price_per_hour)||0);
    }
  };
  const fillTimes=()=>{const start=off||new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"});setOff(start);setTakeoff(addTime(start,5));setLanding(addTime(start,5+duration));setOn(addTime(start,10+duration))};
  const blockMinutes=minutesBetween(off,on),airMinutes=minutesBetween(takeoff,landing),billableMinutes=billing==="AIR"?airMinutes:billing==="BLOCK"?blockMinutes:0,billingValue=billing?serializeBilling(billing,billingShare):"",flightPrice=calculatedFlightPrice(hourlyRate,blockMinutes,airMinutes,billingValue);
  const trainingRole=["DUAL","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(role),pilotSectionOpen=trainingRole||role==="SAFETY PILOT",countersignatureRequired=["SPIC","PICUS"].includes(role);

  const roleGuidance=role==="DUAL"?"Enter the instructor below. The instructor is recorded as PIC; your time is credited as DUAL.":role==="SAFETY PILOT"?"Enter the actual PIC below. Safety Pilot time is kept for reference and is not added to creditable logbook totals.":["SPIC","PICUS"].includes(role)?"Add the supervising PIC/FI and countersignature reference in the EASA section.":"";
  return <form action={formAction} className="flight-form">
    <section className="entry-section entry-section-primary">
      <p className="section-kicker">Flight essentials</p>
      <div className="form-grid essential-grid">
        <label>Date<input name="date" type="date" defaultValue={field("date",new Date().toISOString().slice(0,10))} required/></label>
        <label>Registration<select name="registration" value={registration} onChange={e=>pickAircraft(e.target.value)} required><option value="">Select</option>{registrationOptions.map(a=><option key={a.registration} value={a.registration}>{a.registration}</option>)}</select><small><Link href="/database">Manage aircraft</Link></small></label>
        <label>Role<select name="role" value={role} onChange={e=>setRole(e.target.value)} required><option value="">Select role</option>{ROLES.map(x=><option key={x} value={x}>{roleLabel(x)}</option>)}</select>{roleGuidance?<small className="role-guidance">{roleGuidance}</small>:null}</label>
        <label>Departure<input name="departure" value={departure} onChange={e=>setDeparture(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
        <label>Arrival<input name="arrival" value={arrival} onChange={e=>setArrival(e.target.value.toUpperCase())} placeholder="LKLT" autoCapitalize="characters"/></label>
        <label>Off-block <span className="field-hint">UTC</span><input name="offBlock" type="time" value={off} onChange={e=>setOff(e.target.value)}/></label>
        <label>Takeoff <span className="field-hint">UTC</span><input name="takeoff" type="time" value={takeoff} onChange={e=>setTakeoff(e.target.value)}/></label>
        <label>Landing <span className="field-hint">UTC</span><input name="landing" type="time" value={landing} onChange={e=>setLanding(e.target.value)}/></label>
        <label>On-block <span className="field-hint">UTC</span><input name="onBlock" type="time" value={on} onChange={e=>setOn(e.target.value)}/></label>
        <label>Day landings<input name="landingsDay" type="number" min="0" max="99" value={landingsDay} onChange={event=>setLandingsDay(Number(event.target.value)||0)}/></label>
      </div>
    </section>

    {!editing?<details className="quick-tools"><summary>Speed up entry</summary><div className="quick-tools-grid"><label>Flight duration (min)<input type="number" min="1" max="1440" value={duration} onChange={e=>setDuration(Number(e.target.value)||1)}/></label><button type="button" className="secondary-link" onClick={fillTimes}>Fill UTC times ±5 min</button><button type="button" className="secondary-link" onClick={()=>{setDeparture(arrival);setArrival(departure)}}>Reverse route</button></div>{routes.length?<div className="route-chips"><small>Recent routes</small>{routes.slice(0,8).map((r,i)=><button type="button" key={`${r.departure}-${r.arrival}-${i}`} onClick={()=>{setDeparture(r.departure);setArrival(r.arrival)}}>{r.departure}–{r.arrival}</button>)}</div>:null}</details>:null}

    <details className="entry-section" open={pilotSectionOpen}>
      <summary><span>Pilot & training</span><small>{role}{field("instructor")?` · ${field("instructor")}`:""}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        {role==="DUAL"?<><input type="hidden" name="commander" value={field("commander")}/><label>Instructor / PIC<input name="instructor" defaultValue={field("instructor")} required={evidence==="EASA"}/><small>Required for a DUAL training record.</small></label></>:<><label>{role==="SAFETY PILOT"?"Actual PIC":"Commander / PIC"}<input name="commander" defaultValue={field("commander")} required={evidence==="EASA"&&role==="SAFETY PILOT"}/></label><label>Instructor<input name="instructor" defaultValue={field("instructor")}/></label></>}
        <label className="wide">Task / exercise<input name="task" defaultValue={field("task")}/></label>
      </div></div>
    </details>

    <details className="entry-section" open={evidence==="EASA"}>
      <summary><span>Aircraft & EASA record</span><small>{evidence||"Select logbook"} · {operationType} · {engineType}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        <label>Logbook<select name="evidence" value={evidence} onChange={e=>setEvidence(e.target.value)} required><option value="">Select logbook</option>{EVIDENCE.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Aircraft type<input name="aircraftType" value={type} onChange={e=>setType(e.target.value)}/></label>
        <label>Class<select name="aircraftClass" value={aircraftClass} onChange={e=>{setClass(e.target.value);if(e.target.value)setEngineType(defaultEngineType(e.target.value))}} required><option value="">Select class</option>{CLASSES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Operation<select name="operationType" value={operationType} onChange={event=>setOperationType(event.target.value)}>{OPERATION_TYPES.map(value=><option key={value}>{value}</option>)}</select><small>Single-pilot / multi-pilot</small></label>
        <label>Engine<select name="engineType" value={engineType} onChange={event=>setEngineType(event.target.value)}>{ENGINE_TYPES.map(value=><option key={value}>{value}</option>)}</select><small>Single-engine / multi-engine</small></label>
        <label>Night landings<input name="landingsNight" type="number" min="0" max="99" value={landingsNight} onChange={event=>setLandingsNight(Number(event.target.value)||0)}/></label>
        <label>Night time<input name="nightTime" inputMode="numeric" placeholder="0:00" defaultValue={formatEasaDuration(field("night_minutes","0"))}/></label>
        <label>IFR time<input name="ifrTime" inputMode="numeric" placeholder="0:00" defaultValue={formatEasaDuration(field("ifr_minutes","0"))}/></label>
        {countersignatureRequired?<><label>Supervising PIC / FI<input name="verificationName" defaultValue={field("verification_name")} required/><small>Required for {role} credit.</small></label><label>Countersignature reference<input name="verificationReference" defaultValue={field("verification_reference")} required/><small>Reference to the supervising PIC/FI countersignature or signed evidence.</small></label></>:<><input type="hidden" name="verificationName" value={field("verification_name")}/><input type="hidden" name="verificationReference" value={field("verification_reference")}/></>}
      </div></div>
    </details>

    <details className="entry-section">
      <summary><span>Cost & notes</span><small>{billing||"Select billing"}{billing?` · 1/${billingShare}`:""}</small></summary>
      <div className="entry-section-body"><div className="form-grid secondary-entry-grid">
        <label>Billing time<select name="billingBasis" value={billing} onChange={e=>setBilling(e.target.value as ""|"BLOCK"|"AIR")} required><option value="">Select billing</option>{BILLING.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>My share<select name="billingShare" value={billingShare} onChange={e=>setBillingShare(Number(e.target.value))}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
        <label className="wide">Notes<textarea name="note" rows={3} defaultValue={field("note")}/></label>
      </div><section className="price-preview compact-price" aria-live="polite"><div><span>Calculated flight cost</span><strong>{hourlyRate>0&&billableMinutes>0?`${Math.round(flightPrice).toLocaleString("en-GB")} CZK`:"—"}</strong></div><small>{hourlyRate>0&&billing?`${hourlyRate.toLocaleString("en-GB")} CZK/h · ${billing} ${billing==="AIR"?`${Math.floor(airMinutes/60)}:${String(airMinutes%60).padStart(2,"0")}`:`${Math.floor(blockMinutes/60)}:${String(blockMinutes%60).padStart(2,"0")}`} · 1/${billingShare}`:hourlyRate>0?"Select billing basis":"Hourly rate missing"}</small></section></div>
    </details>

    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}
    {state.success?<p className="form-success" role="status">{state.success}</p>:null}
    <div className="form-actions field-actions"><Submit/>{!editing?<Submit another/>:null}</div>
  </form>;
}
