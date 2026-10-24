"use client";

import { useRef,useState,type KeyboardEvent,type PointerEvent } from "react";
import Link from "next/link";
import type { DashboardPaceView,PaceCategory } from "@/lib/dashboard-pace";
const formatDuration=(minutes:number)=>`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`;

const categories=[["total","Total"],["ull","ULL"],["easa","EASA"]] as const;
const utcMonthLabel=(key:string)=>{const [year,month]=key.split("-").map(Number);return new Intl.DateTimeFormat("en",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)))};

export function DashboardPace({pace}:{pace:DashboardPaceView}){
  const[category,setCategory]=useState<PaceCategory>("total"),[selected,setSelected]=useState(23);
  const plotRef=useRef<HTMLDivElement>(null);
  const months=pace.months;
  const active=months[selected];
  const max=Math.max(1,...months.map(month=>month[category]));
  const comparison=pace.comparisons?.[category];
  const readPoint=(event:PointerEvent<HTMLDivElement>)=>{
    const bounds=plotRef.current?.getBoundingClientRect();
    if(!bounds||bounds.width<=0)return;
    const relative=Math.max(0,Math.min(0.999999,(event.clientX-bounds.left)/bounds.width));
    setSelected(Math.floor(relative*months.length));
  };
  const keys=(event:KeyboardEvent<HTMLDivElement>)=>{
    const next=event.key==="Home"?0:event.key==="End"?months.length-1:event.key==="ArrowLeft"?Math.max(0,selected-1):event.key==="ArrowRight"?Math.min(months.length-1,selected+1):null;
    if(next===null)return;
    event.preventDefault();setSelected(next);
  };
  return <section className="d1v11-pace" aria-labelledby="d1v11-pace-heading">
    <div className="d1v11-pace-top">
      <div><p className="d1v11-kicker">LAST 24 MONTHS</p><h2 id="d1v11-pace-heading">Flying Pace</h2></div>
      <div className="d1v11-pace-switch" role="group" aria-label="Flying pace category">
        {categories.map(([id,title])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{title}</button>)}
      </div>
    </div>
    {pace.status!=="available"?<p className="d1v11-pace-empty">{pace.status==="empty"?"No flights recorded in this period.":pace.reason??"Monthly flying pace unavailable."}</p>:<>
      {comparison?<div className="d1v11-pace-comparison">
        <div><span>Last 12 complete months</span><strong>{formatDuration(comparison.currentMinutes)}</strong></div>
        <div className="d1v11-pace-compare-secondary"><span>Previous 12 complete months</span><strong>{formatDuration(comparison.previousMinutes)}</strong>
          <small>{comparison.percentChange===null?"Change not available":`${comparison.percentChange>0?"+":""}${comparison.percentChange}%`} · {comparison.currentRange} vs {comparison.previousRange}</small>
        </div>
      </div>:null}
      <div ref={plotRef} className="d1v11-pace-plot" role="slider" tabIndex={0} aria-label="Monthly flying time" aria-valuemin={0} aria-valuemax={months.length-1} aria-valuenow={selected} aria-valuetext={active?`${utcMonthLabel(active.month)}: ${formatDuration(active[category])}`:"No data"} onKeyDown={keys} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);readPoint(event)}} onPointerMove={event=>{if(event.buttons===1)readPoint(event)}}>
        {months.map((month,i)=><span key={month.month} className={`d1v11-pace-column${i===selected?" selected":""}`} aria-hidden="true"><span style={{height:`${month[category]===0?0:Math.max(2,100*month[category]/max)}%`}}/></span>)}
      </div>
      <div className="d1v11-pace-ends"><span>{utcMonthLabel(months[0].month)}</span><span>{utcMonthLabel(months[months.length-1].month)} · MTD</span></div>
      <div className="d1v11-pace-foot"><output aria-live="polite">{active?utcMonthLabel(active.month):""} · <strong>{active?formatDuration(active[category]):"—"}</strong>{active?.month===pace.currentMonth?" · Month to date":""}</output><Link href="/statistics?period=all&section=overview">Explore statistics →</Link></div>
    </>}
  </section>;
}
