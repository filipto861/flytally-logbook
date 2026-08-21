"use client";
import { useState } from "react";
import type { MonthlyPoint } from "@/lib/data/dashboard";

const choices=[
  ["total","Celkový čas"],["ull","ULL"],["easa","EASA"],["picUll","PIC ULL"],["picEasa","PIC EASA"],["landings","Přistání"],
] as const;

export function MonthlyChart({data}:{data:MonthlyPoint[]}){
  const [metric,setMetric]=useState<(typeof choices)[number][0]>("total");
  const visible=data.slice(-18); const max=Math.max(1,...visible.map(p=>p[metric]));
  return <section className="panel chart-panel">
    <div className="section-heading"><div><p className="eyebrow">VÝVOJ</p><h2>Měsíční přehled</h2></div><div className="segment-control">{choices.map(([key,label])=><button type="button" className={metric===key?"active":""} key={key} onClick={()=>setMetric(key)}>{label}</button>)}</div></div>
    {visible.length?<div className="bar-chart" aria-label="Měsíční přehled">{visible.map(point=>{const value=point[metric];return <div className="bar-column" key={point.month} title={`${point.month}: ${metric==="landings"?value:(value/60).toFixed(1)+" h"}`}><span>{metric==="landings"?value:(value/60).toFixed(1)}</span><i style={{height:`${Math.max(value?4:0,value/max*100)}%`}}/><small>{point.month.slice(2).replace("-","/")}</small></div>})}</div>:<p className="empty-state">Pro toto období zatím nejsou žádné lety.</p>}
  </section>;
}
