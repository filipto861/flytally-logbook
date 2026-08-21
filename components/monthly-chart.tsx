"use client";

import { useState } from "react";
import type { MonthlyPoint } from "@/lib/data/dashboard";

const choices=[
  ["total","Celkový čas"],["ull","ULL"],["easa","EASA"],["picUll","PIC ULL"],["picEasa","PIC EASA"],["landings","Přistání"],
] as const;
type Metric=(typeof choices)[number][0];

const duration=(minutes:number)=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,"0")}`;
const monthLabel=(month:string)=>{const [year="",value=""]=month.split("-");return `${value}/${year.slice(2)}`};

export function MonthlyChart({data,totalFlights,invalidDates}:{data:MonthlyPoint[];totalFlights:number;invalidDates:number}){
  const [metric,setMetric]=useState<Metric>("total");
  const visible=data.slice(-18),values=visible.map(point=>Number(point[metric])||0),max=Math.max(1,...values);
  const total=values.reduce((sum,value)=>sum+value,0),bestIndex=values.indexOf(Math.max(...values));
  const width=1000,height=230,padX=24,padY=22,usableW=width-padX*2,usableH=height-padY*2;
  const points=values.map((value,index)=>({x:visible.length===1?width/2:padX+index*usableW/(visible.length-1),y:height-padY-value/max*usableH,value}));
  const line=points.map((point,index)=>`${index?"L":"M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area=points.length?`${line} L${points.at(-1)!.x.toFixed(1)},${height-padY} L${points[0].x.toFixed(1)},${height-padY} Z`:"";
  const isLandings=metric==="landings";
  return <section className="panel chart-panel dashboard-chart-v2">
    <div className="section-heading"><div><p className="eyebrow">VÝVOJ</p><h2>Měsíční přehled</h2><p className="muted">Posledních {Math.min(18,visible.length)} měsíců ve vybraném období</p></div><div className="segment-control">{choices.map(([key,label])=><button type="button" className={metric===key?"active":""} key={key} onClick={()=>setMetric(key)}>{label}</button>)}</div></div>
    {visible.length?<>
      <div className="chart-summary"><span><small>Celkem</small><b>{isLandings?total:duration(total)}</b></span><span><small>Průměr / měsíc</small><b>{isLandings?Math.round(total/visible.length):(total/visible.length/60).toFixed(1)+" h"}</b></span><span><small>Nejaktivnější měsíc</small><b>{monthLabel(visible[bestIndex]?.month??"")}</b></span></div>
      <div className="line-chart" aria-label={`Měsíční vývoj: ${choices.find(([key])=>key===metric)?.[1]}`}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
          {[0,.25,.5,.75,1].map(level=><line key={level} x1={padX} x2={width-padX} y1={padY+usableH*level} y2={padY+usableH*level} className="chart-grid-line"/>)}
          <path d={area} className="chart-area"/><path d={line} className="chart-line"/>
          {points.map((point,index)=><circle key={visible[index].month} cx={point.x} cy={point.y} r="5" className="chart-point"><title>{monthLabel(visible[index].month)}: {isLandings?point.value:duration(point.value)}</title></circle>)}
        </svg>
        <div className="chart-axis-labels" style={{gridTemplateColumns:`repeat(${visible.length},minmax(0,1fr))`}}>{visible.map((point,index)=><span key={point.month} className={index%Math.max(1,Math.ceil(visible.length/9))===0||index===visible.length-1?"":"axis-hidden"}>{monthLabel(point.month)}</span>)}</div>
      </div>
    </>:<div className="chart-empty-state"><strong>{totalFlights?"Letové záznamy se nepodařilo zařadit do měsíců":"Pro toto období zatím nejsou žádné lety"}</strong><p>{totalFlights?`Ve vybraném období je ${totalFlights} letů, ale nemají použitelné datum pro graf.`:"Po přidání letu se zde automaticky zobrazí měsíční vývoj."}</p></div>}
    {invalidDates?<p className="chart-warning">⚠ {invalidDates} {invalidDates===1?"let nemá":"lety nemají"} platné datum a {invalidDates===1?"není":"nejsou"} zahrnuto do časového grafu.</p>:null}
  </section>;
}
