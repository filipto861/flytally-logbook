"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import type { DashboardData } from "@/lib/data/dashboard";
import { directionalRouteHref,routePairHref } from "@/lib/route-filter";
import { formatDateOnly } from "@/lib/display-format";

const formatDuration=(minutes:number)=>{const value=Math.max(0,Math.round(minutes));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`};
const sections=[["years","Yearly"],["aircraft","Aircraft & costs"],["airports","Airports"],["routes","Routes"],["recent","Recent flights"]] as const;
type DetailSection=(typeof sections)[number][0];
const sectionKeys=new Set<string>(sections.map(([key])=>key));
const detailSection=(value:unknown):DetailSection=>sectionKeys.has(String(value))?String(value) as DetailSection:"years";

export function DashboardDetails({data,initialSection="years",initialOpen=false}:{data:DashboardData;initialSection?:string;initialOpen?:boolean}){
  const requested=detailSection(initialSection);
  const [open,setOpen]=useState(initialOpen);
  const [section,setSection]=useState<DetailSection>(requested);
  useEffect(()=>{setSection(requested);if(initialOpen)setOpen(true)},[requested,initialOpen]);
  return <section className="panel details-panel">
    <button className="details-toggle" type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span>Detailed statistics</span><b>{open?"−":"＋"}</b></button>
    {open?<div className="detail-stats">
      <div className="mini-metrics"><div><span>Air time</span><b>{formatDuration(data.airMinutes)}</b></div><div><span>PIC</span><b>{formatDuration(data.picMinutes)}</b></div><div><span>Co-pilot</span><b>{formatDuration(data.copilotMinutes)}</b></div><div><span>DUAL</span><b>{formatDuration(data.dualMinutes)}</b></div><div><span>Instructor</span><b>{formatDuration(data.instructorMinutes)}</b></div><div><span>Safety pilot</span><b>{formatDuration(data.safetyMinutes)}</b></div><div><span>Night</span><b>{formatDuration(data.nightMinutes)}</b></div><div><span>IFR</span><b>{formatDuration(data.ifrMinutes)}</b></div><div><span>Day / night landings</span><b>{data.dayLandings} / {data.nightLandings}</b></div><div><span>Cost</span><b>{Math.round(data.cost).toLocaleString("en-GB")} CZK</b></div></div>
      <div className="segment-control detail-tabs" role="tablist">{sections.map(([key,label])=><button type="button" role="tab" aria-selected={section===key} className={section===key?"active":""} key={key} onClick={()=>setSection(key)}>{label}</button>)}</div>
      <div className="detail-tab-panel">
        {section==="years"?<StatTable empty={!data.yearly.length} headings={["Year","Flights","Time","Landings"]}>{data.yearly.map(row=><tr key={row.year}><td>{row.year}</td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td>{row.landings}</td></tr>)}</StatTable>:null}
        {section==="aircraft"?<><StatTable empty={!data.topAircraft.length} headings={["Registration","Flights","Time","Cost","Avg. cost / h","Last flight"]}>{data.topAircraft.map(row=><tr key={row.registration}><td><strong>{row.registration}</strong></td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td><strong>{Math.round(row.cost).toLocaleString("en-GB")} CZK</strong></td><td>{row.minutes>0?`${Math.round(row.cost/(row.minutes/60)).toLocaleString("en-GB")} CZK/h`:"—"}</td><td>{row.lastDate?formatDateOnly(row.lastDate):"—"}</td></tr>)}</StatTable><p className="dashboard-detail-note">Aircraft activity and cost use the same period and the same pilot-owned flight records.</p></>:null}
        {section==="airports"?<><div className="section-heading"><div><p className="eyebrow">VISITED AIRPORTS</p><h3>{data.uniqueAirports} airports in this period</h3><p className="muted">A visit counts an airport once per flight. A local flight counts one visit with both a departure and an arrival.</p></div></div><StatTable empty={!data.topAirports.length} headings={["Airport","Visits","Departures","Arrivals","First visit","Last visit",""]}>{data.topAirports.map(row=><tr key={row.airport}><td><strong>{row.airport}</strong></td><td>{row.visits}</td><td>{row.departures}</td><td>{row.arrivals}</td><td>{row.firstDate?formatDateOnly(row.firstDate):"—"}</td><td>{row.lastDate?formatDateOnly(row.lastDate):"—"}</td><td><Link className="row-link" href={`/flights?airport=${encodeURIComponent(row.airport)}`}>View flights</Link></td></tr>)}</StatTable>{data.uniqueAirports>data.topAirports.length?<p className="dashboard-detail-note">Showing the {data.topAirports.length} most visited airports of {data.uniqueAirports}.</p>:null}</>:null}
        {section==="routes"?<><div className="section-heading"><div><p className="eyebrow">FLOWN ROUTES</p><h3>{data.uniqueRoutes} directional routes in this period</h3><p className="muted">A → B and B → A are separate routes. Use Both directions when you want the complete airport pair.</p></div></div><StatTable empty={!data.topRoutes.length} headings={["Route","Flights","Time","First flown","Last flown",""]}>{data.topRoutes.map(row=><tr key={row.route}><td><strong>{row.departure} → {row.arrival}</strong></td><td>{row.flights}</td><td>{formatDuration(row.minutes)}</td><td>{row.firstDate?formatDateOnly(row.firstDate):"—"}</td><td>{row.lastDate?formatDateOnly(row.lastDate):"—"}</td><td><span className="dashboard-route-actions"><Link className="row-link" href={directionalRouteHref(row.departure,row.arrival)}>View flights</Link><Link className="row-link secondary" href={routePairHref(row.departure,row.arrival)}>Both directions</Link></span></td></tr>)}</StatTable>{data.uniqueRoutes>data.topRoutes.length?<p className="dashboard-detail-note">Showing the {data.topRoutes.length} most flown directional routes of {data.uniqueRoutes}.</p>:null}</>:null}
        {section==="recent"?<StatTable empty={!data.recentFlights.length} headings={["Date","Aircraft","Route",""]}>{data.recentFlights.map(row=><tr key={row.id}><td>{formatDateOnly(row.date)}</td><td>{row.registration||"—"}</td><td>{row.departure||"—"} → {row.arrival||"—"}</td><td><Link className="row-link" href={`/flights/${row.id}`}>Details</Link></td></tr>)}</StatTable>:null}
      </div>
    </div>:null}
  </section>;
}

function StatTable({headings,empty,children}:{headings:string[];empty:boolean;children:React.ReactNode}){
  if(empty)return <p className="empty-state">No data for this period.</p>;
  return <div className="table-scroll"><table><thead><tr>{headings.map((value,index)=><th key={`${value}-${index}`}>{value}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
