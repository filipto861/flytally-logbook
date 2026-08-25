"use client";

import { useState,type ReactNode } from "react";

type Tab="overview"|"gps"|"logbook";

export function FlightDetailWorkspace({overview,gps,logbook,gpsCount=0}:{overview:ReactNode;gps:ReactNode;logbook:ReactNode;gpsCount?:number}){
  const[tab,setTab]=useState<Tab>("overview");
  const item=(value:Tab,label:string,badge?:number)=><button type="button" role="tab" id={`flight-tab-${value}`} aria-controls={`flight-panel-${value}`} className={tab===value?"active":""} aria-selected={tab===value} onClick={()=>setTab(value)}><span>{label}</span>{badge!==undefined?<b>{badge}</b>:null}</button>;
  return <section className="flight-detail-workspace">
    <nav className="detail-tabs" role="tablist" aria-label="Flight detail sections">{item("overview","Overview")}{item("gps","GPS track",gpsCount)}{item("logbook","Logbook data")}</nav>
    <div className="detail-tab-content" role="tabpanel" id={`flight-panel-${tab}`} aria-labelledby={`flight-tab-${tab}`}>{tab==="overview"?overview:tab==="gps"?gps:logbook}</div>
  </section>;
}
