"use client";

import { useEffect,useState,type ReactNode } from "react";
import { FlightWorkflowProgress,type FlightWorkflowState } from "@/components/flight-workflow-progress";

type Tab = "overview" | "gps" | "logbook";

export function FlightDetailWorkspace({overview,gps,logbook,gpsCount=0,initialTab="overview",workflow,postSave=false}:{overview:ReactNode;gps:ReactNode;logbook:ReactNode;gpsCount?:number;initialTab?:Tab;workflow:FlightWorkflowState;postSave?:boolean}){
  const[tab,setTab]=useState<Tab>(postSave?"logbook":initialTab);
  useEffect(()=>{
    if(!postSave)return;
    const params=new URLSearchParams(window.location.search);
    params.delete("saved");
    const query=params.toString();
    window.history.replaceState(window.history.state,"",window.location.pathname+(query?`?${query}`:""));
  },[postSave]);
  const selectTab=(value:Tab)=>setTab(value);
  const item=(value:Tab,label:string,badge?:number)=><button type="button" role="tab" id={`flight-tab-${value}`} aria-controls={`flight-panel-${value}`} className={tab===value?"active":""} aria-selected={tab===value} onClick={()=>selectTab(value)}><span>{label}</span>{badge!==undefined?<b>{badge}</b>:null}</button>;
  return <section className="flight-detail-workspace">
    <FlightWorkflowProgress state={workflow} activeTab={tab} onSelectTab={selectTab}/>
    <nav className="detail-tabs" role="tablist" aria-label="Flight detail sections">{item("overview","Overview")}{item("gps","GPS track",gpsCount)}{item("logbook","Logbook data")}</nav>
    <div className="detail-tab-content" role="tabpanel" id={`flight-panel-${tab}`} aria-labelledby={`flight-tab-${tab}`}>{tab==="overview"?overview:tab==="gps"?gps:logbook}</div>
  </section>;
}
