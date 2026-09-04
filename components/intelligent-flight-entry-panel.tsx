"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { intelligentFlightReview,type IntelligentEntryContext,type IntelligentFlightDraft } from "@/lib/intelligent-logbook-client-types";

function formDraft(form:HTMLFormElement):IntelligentFlightDraft{
  const data=new FormData(form),value=(name:string)=>String(data.get(name)??"");
  return{
    date:value("date"),registration:value("registration"),aircraftType:value("aircraftType"),aircraftClass:value("aircraftClass"),regulatoryCategory:value("regulatoryCategory"),evidence:value("evidence"),role:value("role"),operationType:value("operationType"),engineType:value("engineType"),operatorName:value("operatorName"),flightNumber:value("flightNumber"),operationContext:value("operationContext"),departure:value("departure"),arrival:value("arrival"),offBlock:value("offBlock"),onBlock:value("onBlock"),takeoff:value("takeoff"),landing:value("landing"),starts:value("starts"),landingsDay:value("landingsDay"),landingsNight:value("landingsNight"),movementEvidenceRecorded:data.has("movementEvidenceRecorded")?"yes":"",takeoffsDay:value("takeoffsDay"),takeoffsNight:value("takeoffsNight"),approachesDay:value("approachesDay"),approachesNight:value("approachesNight"),
  };
}

export function IntelligentFlightEntryPanel({context}:{context:IntelligentEntryContext}){
  const[draft,setDraft]=useState<IntelligentFlightDraft>({});
  useEffect(()=>{
    const form=document.querySelector<HTMLFormElement>("form.flight-form");if(!form)return;
    const sync=()=>setDraft(formDraft(form));sync();
    form.addEventListener("input",sync);form.addEventListener("change",sync);
    return()=>{form.removeEventListener("input",sync);form.removeEventListener("change",sync)};
  },[]);
  const insights=useMemo(()=>intelligentFlightReview(draft,context.history),[draft,context.history]);
  const departure=String(draft.departure??"").trim().toUpperCase(),continuation=!departure?context.continuation:null;
  if(!continuation&&!insights.length)return null;
  return <section className="panel" aria-live="polite">
    <div className="section-heading"><div><p className="eyebrow">INTELLIGENT REVIEW</p><h2>Worth checking</h2></div><span>{insights.length+(continuation?1:0)}</span></div>
    <div className="credential-list">
      {continuation?<div className="credential-card" style={{padding:"14px 16px"}}><div className="credential-main"><span>CONTINUITY SUGGESTION</span><strong>Last flight ended at {continuation.airport}</strong><small>{continuation.date} · {continuation.registration}. Use it only if this flight continues that sequence.</small></div><div className="form-actions"><Link className="secondary-button" href={`/flights/new?departure=${encodeURIComponent(continuation.airport)}`}>Use {continuation.airport} as departure</Link></div></div>:null}
      {insights.map(item=><div className="credential-card" style={{padding:"14px 16px"}} key={item.code}><div className="credential-main"><span>{item.tone==="attention"?"CHECK BEFORE SAVE":item.tone==="warning"?"HISTORY / CONSISTENCY CHECK":"CONTEXT NOTE"}</span><strong>{item.title}</strong><small>{item.message}</small>{item.evidence?.length?<small><b>Based on:</b> {item.evidence.map(source=>`${source.label}: ${source.value}`).join(" · ")}</small>:null}</div><b className={item.tone==="attention"?"status-off":"status-warning"}>{item.tone==="attention"?"REVIEW":item.tone==="warning"?"CHECK":"INFO"}</b></div>)}
    </div>
    <p className="muted" style={{marginBottom:0}}>Every suggestion comes only from this form and your own stored flights. FlyTally never rewrites regulatory fields and never infers CAT, NCC, SPO, PICUS or other privileges for you.</p>
  </section>;
}
