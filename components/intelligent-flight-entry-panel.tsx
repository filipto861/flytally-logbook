"use client";

import { useEffect,useMemo,useState } from "react";
import { createPortal } from "react-dom";
import { intelligentFlightReview,type IntelligentEntryContext,type IntelligentFlightDraft,type IntelligentInsight } from "@/lib/intelligent-logbook-client-types";
import { POST_SAVE_REVIEW_KEY } from "@/lib/flight-review-navigation";

function formDraft(form:HTMLFormElement):IntelligentFlightDraft{
  const data=new FormData(form),value=(name:string)=>String(data.get(name)??"");
  return{
    date:value("date"),registration:value("registration"),aircraftType:value("aircraftType"),aircraftClass:value("aircraftClass"),regulatoryCategory:value("regulatoryCategory"),evidence:value("evidence"),role:value("role"),operationType:value("operationType"),engineType:value("engineType"),operatorName:value("operatorName"),flightNumber:value("flightNumber"),operationContext:value("operationContext"),departure:value("departure"),arrival:value("arrival"),offBlock:value("offBlock"),onBlock:value("onBlock"),takeoff:value("takeoff"),landing:value("landing"),starts:value("starts"),landingsDay:value("landingsDay"),landingsNight:value("landingsNight"),movementEvidenceRecorded:data.has("movementEvidenceRecorded")?"yes":"",takeoffsDay:value("takeoffsDay"),takeoffsNight:value("takeoffsNight"),approachesDay:value("approachesDay"),approachesNight:value("approachesNight"),
  };
}

function preferredField(code:string){
  if(code==="exact_duplicate")return"registration";
  if(code==="incomplete_block_pair"||code==="missing_block_times"||code==="zero_block"||code==="duration_outlier")return"offBlock";
  if(code==="incomplete_air_pair")return"takeoff";
  if(code==="air_exceeds_block")return"landing";
  if(code==="takeoff_outside_block"||code==="taxi_out_long")return"takeoff";
  if(code==="landing_outside_block"||code==="taxi_in_long")return"landing";
  if(code.startsWith("invalid_time_off_block"))return"offBlock";
  if(code.startsWith("invalid_time_on_block"))return"onBlock";
  if(code.startsWith("invalid_time_take_off"))return"takeoff";
  if(code.startsWith("invalid_time_landing"))return"landing";
  if(code.startsWith("movement_"))return"landingsDay";
  if(code==="copilot_single_pilot"||code==="solo_multi_pilot")return"role";
  if(code==="professional_context_scope")return"operationContext";
  if(code==="professional_operator_missing")return"operatorName";
  if(code==="professional_operation_missing")return"operationContext";
  if(code==="registration_profile_aircraft_class")return"aircraftClass";
  if(code==="registration_profile_regulatory_category")return"regulatoryCategory";
  if(code==="registration_profile_evidence")return"evidence";
  if(code==="registration_profile_engine_type")return"engineType";
  return"";
}

function fieldTarget(form:HTMLFormElement|null,name:string){
  if(!form||!name)return null;
  const control=form.querySelector<HTMLElement>(`[name="${name}"]`);
  if(!control||control instanceof HTMLInputElement&&control.type==="hidden"||control.closest("[hidden]"))return null;
  return control.closest<HTMLElement>("label")||control.parentElement;
}

function applyFieldValue(form:HTMLFormElement,name:string,value:string){
  const control=form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if(!control)return;
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
  if(setter)setter.call(control,value);else control.value=value;
  control.dispatchEvent(new Event("input",{bubbles:true}));
  control.dispatchEvent(new Event("change",{bubbles:true}));
  control.focus();
}

function InlineInsight({item}:{item:IntelligentInsight}){
  const attention=item.tone==="attention";
  return <small className={attention?"form-error":"role-guidance"} data-intelligent-review={item.code} role={attention?"alert":undefined}>
    <strong>{attention?"Check before save: ":item.tone==="warning"?"History check: ":"Suggestion: "}{item.title}</strong> {item.message}
  </small>;
}

const inlineActionStyle={marginLeft:6,background:"transparent",cursor:"pointer"} as const;

export function IntelligentFlightEntryPanel({context}:{context:IntelligentEntryContext}){
  const[draft,setDraft]=useState<IntelligentFlightDraft>({}),[form,setForm]=useState<HTMLFormElement|null>(null);
  useEffect(()=>{
    const node=document.querySelector<HTMLFormElement>("form.flight-form");if(!node)return;
    setForm(node);
    const sync=()=>setDraft(formDraft(node));
    const markPostSaveReview=(event:SubmitEvent)=>{
      const submitter=event.submitter instanceof HTMLButtonElement?event.submitter:null,intent=submitter?.name==="intent"?submitter.value:"";
      if(intent==="save")sessionStorage.setItem(POST_SAVE_REVIEW_KEY,String(Date.now()));else sessionStorage.removeItem(POST_SAVE_REVIEW_KEY);
    };
    const clearRejectedReview=()=>{if(node.querySelector('.form-error[role="alert"]'))sessionStorage.removeItem(POST_SAVE_REVIEW_KEY)};
    const observer=new MutationObserver(clearRejectedReview);
    sync();node.addEventListener("input",sync);node.addEventListener("change",sync);node.addEventListener("submit",markPostSaveReview);observer.observe(node,{childList:true,subtree:true});
    return()=>{node.removeEventListener("input",sync);node.removeEventListener("change",sync);node.removeEventListener("submit",markPostSaveReview);observer.disconnect()};
  },[]);
  const insights=useMemo(()=>intelligentFlightReview(draft,context.history),[draft,context.history]);
  const departure=String(draft.departure??"").trim().toUpperCase(),arrival=String(draft.arrival??"").trim().toUpperCase(),continuation=!departure?context.continuation:null;
  const latest=context.history[0],latestDeparture=String(latest?.departure??"").trim().toUpperCase(),latestArrival=String(latest?.arrival??"").trim().toUpperCase();
  const returnLeg=departure&&!arrival&&latestArrival===departure&&latestDeparture&&latestDeparture!==departure?latest:null;
  const inline=insights.map(item=>({item,target:fieldTarget(form,preferredField(item.code))})),fallback=inline.filter(entry=>!entry.target).map(entry=>entry.item);
  const departureTarget=fieldTarget(form,"departure"),arrivalTarget=fieldTarget(form,"arrival");

  return <>
    {continuation&&form&&departureTarget?createPortal(<small className="role-guidance" data-intelligent-review="continuation">
      <strong>Continue from {continuation.airport}?</strong> Last flight ended there on {continuation.date} with {continuation.registration}. <button className="detail-button" style={inlineActionStyle} type="button" onClick={()=>applyFieldValue(form,"departure",continuation.airport)}>Use {continuation.airport}</button>
    </small>,departureTarget):null}
    {returnLeg&&form&&arrivalTarget?createPortal(<small className="role-guidance" data-intelligent-review="return-leg">
      <strong>Return to {latestDeparture}?</strong> Your latest flight was {latestDeparture} → {latestArrival} on {String(returnLeg.date).slice(0,10)}. <button className="detail-button" style={inlineActionStyle} type="button" onClick={()=>applyFieldValue(form,"arrival",latestDeparture)}>Use {latestDeparture}</button>
    </small>,arrivalTarget):null}
    {inline.map(({item,target})=>target?createPortal(<InlineInsight item={item}/>,target,`intelligent-${item.code}`):null)}
    {fallback.length?<section className="panel" aria-live="polite" data-intelligent-review="fallback">
      <div className="section-heading"><div><p className="eyebrow">INTELLIGENT REVIEW</p><h2>Worth checking</h2></div><span>{fallback.length}</span></div>
      <div className="credential-list">
        {fallback.map(item=><div className="credential-card" style={{padding:"14px 16px"}} key={item.code}><div className="credential-main"><span>{item.tone==="attention"?"CHECK BEFORE SAVE":item.tone==="warning"?"HISTORY / CONSISTENCY CHECK":"CONTEXT NOTE"}</span><strong>{item.title}</strong><small>{item.message}</small>{item.evidence?.length?<small><b>Based on:</b> {item.evidence.map(source=>`${source.label}: ${source.value}`).join(" · ")}</small>:null}</div><b className={item.tone==="attention"?"status-off":"status-warning"}>{item.tone==="attention"?"REVIEW":item.tone==="warning"?"CHECK":"INFO"}</b></div>)}
      </div>
      <p className="muted" style={{marginBottom:0}}>Suggestions use only this form and your own stored flights. FlyTally never rewrites regulatory fields or infers privileges.</p>
    </section>:null}
  </>;
}
