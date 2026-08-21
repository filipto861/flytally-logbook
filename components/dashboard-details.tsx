"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardData } from "@/lib/data/dashboard";

const formatDuration=(minutes:number)=>{const value=Math.max(0,Math.round(minutes));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`};

const sections = [["years","Roční přehled"],["aircraft","Letadla"],["routes","Letiště a trasy"],["cost","Náklady"],["recent","Poslední lety"]] as const;

export function DashboardDetails({data}:{data:DashboardData}){
  const [open,setOpen]=useState(false);
  const [section,setSection]=useState<(typeof sections)[number][0]>("years");
  return <section className="panel details-panel">
    <button className="details-toggle" type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span>Podrobné statistiky</span><b>{open?"−":"＋"}</b></button>
    {open?<div className="detail-stats">
      <div className="mini-metrics"><div><span>Čas ve vzduchu</span><b>{formatDuration(data.airMinutes)}</b></div><div><span>PIC celkem</span><b>{formatDuration(data.picMinutes)}</b></div><div><span>DUAL</span><b>{formatDuration(data.dualMinutes)}</b></div><div><span>Safety pilot</span><b>{formatDuration(data.safetyMinutes)}</b></div><div><span>Náklady</span><b>{Math.round(data.cost).toLocaleString("cs-CZ")} Kč</b></div></div>
      <div className="segment-control detail-tabs" role="tablist">{sections.map(([key,label])=><button type="button" role="tab" aria-selected={section===key} className={section===key?"active":""} key={key} onClick={()=>setSection(key)}>{label}</button>)}</div>
      <div className="detail-tab-panel">
        {section==="years"?<StatTable empty={!data.yearly.length} headings={["Rok","Lety","Čas","Přistání"]}>{data.yearly.map(row=><tr key={row.year}><td>{row.year}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td>{row.landings}</td></tr>)}</StatTable>:null}
        {section==="aircraft"?<StatTable empty={!data.topAircraft.length} headings={["Registrace","Lety","Čas"]}>{data.topAircraft.map(row=><tr key={row.registration}><td>{row.registration}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td></tr>)}</StatTable>:null}
        {section==="routes"?<StatTable empty={!data.topRoutes.length} headings={["Trasa","Lety","Čas"]}>{data.topRoutes.map(row=><tr key={row.route}><td>{row.route}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td></tr>)}</StatTable>:null}
        {section==="cost"?<div className="cost-overview"><span>Odhad nákladů ve vybraném období</span><strong>{Math.round(data.cost).toLocaleString("cs-CZ")} Kč</strong><small>Výpočet vychází z hodinových sazeb letadel a nastaveného způsobu účtování.</small></div>:null}
        {section==="recent"?<StatTable empty={!data.recentFlights.length} headings={["Datum","Letadlo","Trasa",""]}>{data.recentFlights.map(row=><tr key={row.id}><td>{row.date}</td><td>{row.registration||"—"}</td><td>{row.departure||"—"} → {row.arrival||"—"}</td><td><Link className="row-link" href={`/flights/${row.id}`}>Detail</Link></td></tr>)}</StatTable>:null}
      </div>
    </div>:null}
  </section>;
}

function StatTable({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">Pro vybrané období nejsou k dispozici žádná data.</p>;
  return <div className="table-scroll"><table><thead><tr>{headings.map(value=><th key={value}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
