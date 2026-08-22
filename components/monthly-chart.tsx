"use client";

import { useEffect,useMemo,useState } from "react";
import type { MonthlyPoint } from "@/lib/data/dashboard";
import { niceChartMaximum } from "@/lib/dashboard-math";

const choices=[
  ["total","Total time"],["ull","ULL"],["easa","EASA"],["picUll","PIC ULL"],["picEasa","PIC EASA"],["landings","Landings"],
] as const;
type Metric=(typeof choices)[number][0];

const duration=(minutes:number)=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,"0")}`;
const monthLabel=(month:string,long=false)=>{const [year="",value=""]=month.split("-");return long?`${value}/${year}`:`${value}/${year.slice(2)}`};

export function MonthlyChart({data,totalFlights,invalidDates}:{data:MonthlyPoint[];totalFlights:number;invalidDates:number}){
  const [metric,setMetric]=useState<Metric>("total"),[active,setActive]=useState<number|null>(null);
  const visible=data.slice(-18),values=visible.map(point=>Number(point[metric])||0),isLandings=metric==="landings";
  const total=values.reduce((sum,value)=>sum+value,0),bestIndex=values.indexOf(Math.max(...values)),focusIndex=active??bestIndex;
  const width=1120,height=340,left=70,right=24,top=28,bottom=48,usableW=width-left-right,usableH=height-top-bottom,max=niceChartMaximum(Math.max(1,...values),4);
  const geometry=useMemo(()=>values.map((value,index)=>{const slot=usableW/Math.max(1,values.length),barWidth=Math.min(38,Math.max(12,slot*.58)),x=left+slot*index+slot/2,y=top+usableH-value/max*usableH;return{x,y,value,barX:x-barWidth/2,barWidth,barHeight:Math.max(value?3:0,top+usableH-y)}}),[values.join("|"),max,usableW,usableH]);
  const line=geometry.map((point,index)=>`${index?"L":"M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const labelStep=Math.max(1,Math.ceil(visible.length/9)),focus=visible[focusIndex],focusValue=values[focusIndex]||0;
  useEffect(()=>setActive(null),[metric,data]);

  return <section className="panel chart-panel dashboard-chart-v3">
    <div className="section-heading"><div><p className="eyebrow">TREND</p><h2>Monthly activity</h2></div><div className="segment-control chart-metric-control">{choices.map(([key,label])=><button type="button" className={metric===key?"active":""} key={key} onClick={()=>setMetric(key)}>{label}</button>)}</div></div>
    {visible.length?<>
      <div className="chart-summary"><span><small>Total</small><b>{isLandings?total:duration(total)}</b></span><span><small>Monthly average</small><b>{isLandings?Math.round(total/visible.length):(total/visible.length/60).toFixed(1)+" h"}</b></span><span><small>Busiest month</small><b>{monthLabel(visible[bestIndex]?.month??"",true)}</b></span></div>
      <div className="chart-focus"><span>{focus?monthLabel(focus.month,true):"—"}</span><strong>{isLandings?`${focusValue} landings`:duration(focusValue)}</strong></div>
      <div className="monthly-chart" aria-label={`Monthly trend: ${choices.find(([key])=>key===metric)?.[1]}`}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" onMouseLeave={()=>setActive(null)}>
          <defs><linearGradient id="monthlyBarGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8"/><stop offset="1" stopColor="#155e75"/></linearGradient><linearGradient id="monthlyBarActive" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6ee7b7"/><stop offset="1" stopColor="#059669"/></linearGradient></defs>
          <rect x={left} y={top} width={usableW} height={usableH} rx="12" className="chart-plot-bg"/>
          {[0,.25,.5,.75,1].map((level,index)=>{const y=top+usableH*level,value=max*(1-level);return <g key={level}><line x1={left} x2={width-right} y1={y} y2={y} className="chart-grid-line"/><text x={left-12} y={y+4} textAnchor="end" className="chart-y-label">{isLandings?Math.round(value):value>=60?`${(value/60).toFixed(value>=600?0:1)} h`:duration(value)}</text></g>})}
          {geometry.map((point,index)=><g key={visible[index].month} className="chart-hit" onMouseEnter={()=>setActive(index)} onClick={()=>setActive(index)} role="button" tabIndex={0} onFocus={()=>setActive(index)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")setActive(index)}} aria-label={`${monthLabel(visible[index].month,true)}: ${isLandings?point.value:duration(point.value)}`}><rect x={left+index*usableW/visible.length} y={top} width={usableW/visible.length} height={usableH} fill="transparent"/><rect x={point.barX} y={point.y} width={point.barWidth} height={point.barHeight} rx="6" className={`chart-bar${focusIndex===index?" active":""}`}/></g>)}
          {geometry.length>1?<path d={line} className="chart-trend-line"/>:null}
          {geometry.map((point,index)=><circle key={`point-${visible[index].month}`} cx={point.x} cy={point.y} r={focusIndex===index?6:3.5} className={`chart-trend-point${focusIndex===index?" active":""}`} pointerEvents="none"/>)}
          {visible.map((point,index)=>index%labelStep===0||index===visible.length-1?<text key={point.month} x={geometry[index].x} y={height-18} textAnchor="middle" className="chart-x-label">{monthLabel(point.month)}</text>:null)}
        </svg>
      </div>
    </>:<div className="chart-empty-state"><strong>{totalFlights?"Flights could not be grouped by month":"No flights in this period"}</strong></div>}
    {invalidDates?<p className="chart-warning">⚠ {invalidDates} flight records have no valid date.</p>:null}
  </section>;
}
