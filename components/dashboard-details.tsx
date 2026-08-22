"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardData } from "@/lib/data/dashboard";

const formatDuration=(minutes:number)=>{const value=Math.max(0,Math.round(minutes));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`};

const sections = [["years","Yearly"],["aircraft","Aircraft"],["cost","Cost"],["routes","Airports and routes"],["recent","Recent flights"]] as const;

export function DashboardDetails({data}:{data:DashboardData}){
  const [open,setOpen]=useState(false);
  const [section,setSection]=useState<(typeof sections)[number][0]>("years");
  const costAircraft=[...data.topAircraft].sort((left,right)=>right.cost-left.cost);
  return <section className="panel details-panel">
    <button className="details-toggle" type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span>Detailed statistics</span><b>{open?"−":"＋"}</b></button>
    {open?<div className="detail-stats">
      <div className="mini-metrics"><div><span>Air time</span><b>{formatDuration(data.airMinutes)}</b></div><div><span>Total PIC</span><b>{formatDuration(data.picMinutes)}</b></div><div><span>DUAL</span><b>{formatDuration(data.dualMinutes)}</b></div><div><span>Safety pilot</span><b>{formatDuration(data.safetyMinutes)}</b></div><div><span>Cost</span><b>{Math.round(data.cost).toLocaleString("en-GB")} CZK</b></div></div>
      <div className="segment-control detail-tabs" role="tablist">{sections.map(([key,label])=><button type="button" role="tab" aria-selected={section===key} className={section===key?"active":""} key={key} onClick={()=>setSection(key)}>{label}</button>)}</div>
      <div className="detail-tab-panel">
        {section==="years"?<StatTable empty={!data.yearly.length} headings={["Year","Flights","Time","Landings"]}>{data.yearly.map(row=><tr key={row.year}><td>{row.year}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td>{row.landings}</td></tr>)}</StatTable>:null}
        {section==="aircraft"?<StatTable empty={!data.topAircraft.length} headings={["Registration","Flights","Time","Cost"]}>{data.topAircraft.map(row=><tr key={row.registration}><td><strong>{row.registration}</strong></td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td><strong>{Math.round(row.cost).toLocaleString("en-GB")} CZK</strong></td></tr>)}</StatTable>:null}
        {section==="routes"?<StatTable empty={!data.topRoutes.length} headings={["Route","Flights","Time"]}>{data.topRoutes.map(row=><tr key={row.route}><td>{row.route}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td></tr>)}</StatTable>:null}
        {section==="cost"?<div className="cost-breakdown"><header><div><span>Cost</span><strong>{Math.round(data.cost).toLocaleString("en-GB")} CZK</strong></div></header><div>{costAircraft.map(row=>{const share=data.cost>0?row.cost/data.cost*100:0;return <article key={row.registration}><div><b>{row.registration}</b><span>{Math.round(row.cost).toLocaleString("en-GB")} CZK</span></div><div className="cost-bar"><i style={{width:`${Math.max(row.cost?2:0,share)}%`}}/></div><small>{share.toFixed(1)}% · {row.flights} flights · {formatDuration(row.minutes)}</small></article>})}{!costAircraft.length?<p className="empty-state">No cost data for this period.</p>:null}</div></div>:null}
        {section==="recent"?<StatTable empty={!data.recentFlights.length} headings={["Date","Aircraft","Route",""]}>{data.recentFlights.map(row=><tr key={row.id}><td>{row.date}</td><td>{row.registration||"—"}</td><td>{row.departure||"—"} → {row.arrival||"—"}</td><td><Link className="row-link" href={`/flights/${row.id}`}>Details</Link></td></tr>)}</StatTable>:null}
      </div>
    </div>:null}
  </section>;
}

function StatTable({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">No data for this period.</p>;
  return <div className="table-scroll"><table><thead><tr>{headings.map(value=><th key={value}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
