"use client";

import { useEffect,useState,type KeyboardEvent,type ReactNode } from "react";
import Link from "next/link";
import { FlightWorkflowProgress,type FlightWorkflowState } from "@/components/flight-workflow-progress";

type Tab = "overview" | "gps" | "logbook";
type CompletionState="draft-saved"|"certified"|"certification-blocked"|"certification-deferred"|null;
const TABS:Tab[]=["overview","gps","logbook"];

export function FlightDetailWorkspace({
  overview,
  gps,
  logbook,
  gpsCount=0,
  initialTab="overview",
  workflow,
  completion=null,
  completionMessage="",
}:{
  overview:ReactNode;
  gps:ReactNode;
  logbook:ReactNode;
  gpsCount?:number;
  initialTab?:Tab;
  workflow:FlightWorkflowState;
  completion?:CompletionState;
  completionMessage?:string;
}){
  const[tab,setTab]=useState<Tab>(completion==="draft-saved"||completion==="certification-blocked"||completion==="certification-deferred"?"logbook":initialTab);
  useEffect(()=>{
    if(!completion)return;
    const params=new URLSearchParams(window.location.search);
    params.delete("saved");
    params.delete("certify");
    params.delete("certified");
    const query=params.toString();
    window.history.replaceState(window.history.state,"",window.location.pathname+(query?`?${query}`:""));
  },[completion]);

  const selectTab=(value:Tab)=>setTab(value);
  const onTabKeyDown=(event:KeyboardEvent<HTMLButtonElement>,value:Tab)=>{
    const current=TABS.indexOf(value);let next=current;
    if(event.key==="ArrowRight")next=(current+1)%TABS.length;
    else if(event.key==="ArrowLeft")next=(current-1+TABS.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=TABS.length-1;
    else return;
    event.preventDefault();const nextTab=TABS[next];selectTab(nextTab);document.getElementById(`flight-tab-${nextTab}`)?.focus();
  };

  const item=(value:Tab,label:string,badge?:number)=><button type="button" role="tab" id={`flight-tab-${value}`} aria-controls={`flight-panel-${value}`} className={tab===value?"active":""} aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>selectTab(value)} onKeyDown={event=>onTabKeyDown(event,value)}><span>{label}</span>{badge!==undefined?<b>{badge}</b>:null}</button>;

  const banner=completion==="certified"
    ?{title:"Flight saved and certified.",detail:"The persisted record passed certification checks and is now locked."}
    :completion==="certification-blocked"
      ?{title:"Flight saved as draft — not certified.",detail:completionMessage||"Resolve the certification issue below, then certify the saved draft."}
      :completion==="certification-deferred"
        ?{title:"Flight saved as draft — certification deferred.",detail:completionMessage||"The draft was preserved safely. Review it before trying certification again."}
        :completion==="draft-saved"
          ?{title:"Flight saved as draft.",detail:"The record is still editable and has not been certified."}
          :null;

  return <section className="flight-detail-workspace">
    {banner?<div className={`flight-post-save completion-${completion}`}><div role="status"><strong>{banner.title}</strong><span>{banner.detail}</span></div><Link className="secondary-link" href="/flights/new?added=1">Add another flight</Link></div>:null}
    <FlightWorkflowProgress state={workflow} activeTab={tab} onSelectTab={selectTab}/>
    <nav className="detail-tabs" role="tablist" aria-label="Flight detail sections">{item("overview","Overview")}{item("gps","GPS track",gpsCount)}{item("logbook","Logbook data")}</nav>
    <div className="detail-tab-content" role="tabpanel" id={`flight-panel-${tab}`} aria-labelledby={`flight-tab-${tab}`}>{tab==="overview"?overview:tab==="gps"?gps:logbook}</div>
  </section>;
}
