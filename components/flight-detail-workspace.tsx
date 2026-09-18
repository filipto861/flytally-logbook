"use client";

import Link from "next/link";
import { useEffect,useState,type ReactNode } from "react";
import { FlightWorkflowProgress,type FlightWorkflowState } from "@/components/flight-workflow-progress";

type Tab = "overview" | "gps" | "logbook";

export function FlightDetailWorkspace({overview,gps,logbook,gpsCount=0,initialTab="overview",workflow,postSave=false}:{overview:ReactNode;gps:ReactNode;logbook:ReactNode;gpsCount?:number;initialTab?:Tab;workflow:FlightWorkflowState;postSave?:boolean}){
  const[tab,setTab]=useState<Tab>(postSave?"logbook":initialTab),[postSaveReview,setPostSaveReview]=useState(postSave);
  useEffect(()=>{
    if(!postSave)return;
    const params=new URLSearchParams(window.location.search);
    params.delete("saved");
    const query=params.toString();
    window.history.replaceState(window.history.state,"",window.location.pathname+(query?`?${query}`:""));
  },[postSave]);
  const selectTab=(value:Tab)=>{setTab(value);if(value!=="logbook")setPostSaveReview(false)};
  const item=(value:Tab,label:string,badge?:number)=><button type="button" role="tab" id={`flight-tab-${value}`} aria-controls={`flight-panel-${value}`} className={tab===value?"active":""} aria-selected={tab===value} onClick={()=>selectTab(value)}><span>{label}</span>{badge!==undefined?<b>{badge}</b>:null}</button>;
  return <section className="flight-detail-workspace">
    <FlightWorkflowProgress state={workflow} activeTab={tab} onSelectTab={selectTab}/>
    {postSaveReview&&tab==="logbook"?<div className="flight-post-save" role="status"><div><strong>Flight saved as an editable draft.</strong><span>Review the final Logbook data below. Certification is the next step and protects the finished record.</span></div></div>:null}
    <div className="flight-detail-tabs-row"><nav className="detail-tabs" role="tablist" aria-label="Flight detail sections">{item("overview","Overview")}{item("gps","GPS track",gpsCount)}{item("logbook","Logbook data")}</nav>{workflow.certified?<Link className="flight-share-shortcut" href={workflow.shareHref}>Share</Link>:null}</div>
    <div className="detail-tab-content" role="tabpanel" id={`flight-panel-${tab}`} aria-labelledby={`flight-tab-${tab}`}>{tab==="overview"?overview:tab==="gps"?gps:logbook}</div>
  </section>;
}
