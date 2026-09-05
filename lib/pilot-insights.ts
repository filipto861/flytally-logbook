export const PILOT_INSIGHT_PERIODS=["all","year","12m","previous"] as const;
export type PilotInsightPeriod=(typeof PILOT_INSIGHT_PERIODS)[number];

export type InsightBounds={start:string|null;end:string|null;label:string};
export type PaceComparison={direction:"up"|"down"|"flat"|"new"|"none";percent:number|null};

const iso=(date:Date)=>date.toISOString().slice(0,10);

export function pilotInsightBounds(requested:string,today=new Date()):InsightBounds{
  const period:PilotInsightPeriod=PILOT_INSIGHT_PERIODS.includes(requested as PilotInsightPeriod)?requested as PilotInsightPeriod:"all";
  const year=today.getUTCFullYear();
  if(period==="year")return{start:`${year}-01-01`,end:iso(today),label:String(year)};
  if(period==="previous")return{start:`${year-1}-01-01`,end:`${year-1}-12-31`,label:String(year-1)};
  if(period==="12m"){
    const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1));
    return{start:iso(start),end:iso(today),label:`${iso(start)} – ${iso(today)}`};
  }
  return{start:null,end:null,label:"All time"};
}

export function rollingYearBounds(today=new Date()){
  const end=iso(today);
  const currentStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1));
  const previousEnd=new Date(currentStart.getTime()-86400000);
  const previousStart=new Date(Date.UTC(previousEnd.getUTCFullYear(),previousEnd.getUTCMonth()-12,previousEnd.getUTCDate()+1));
  return{currentStart:iso(currentStart),currentEnd:end,previousStart:iso(previousStart),previousEnd:iso(previousEnd)};
}

export function paceComparison(current:number,previous:number):PaceComparison{
  const a=Math.max(0,Number(current)||0),b=Math.max(0,Number(previous)||0);
  if(!a&&!b)return{direction:"none",percent:null};
  if(!b)return{direction:"new",percent:null};
  const percent=Math.round((a-b)/b*100);
  if(Math.abs(percent)<2)return{direction:"flat",percent};
  return{direction:percent>0?"up":"down",percent};
}

export function sharePercent(part:number,total:number){
  const numerator=Math.max(0,Number(part)||0),denominator=Math.max(0,Number(total)||0);
  return denominator?Math.round(numerator/denominator*100):0;
}

export function formatInsightDuration(minutes:number){
  const value=Math.max(0,Math.round(Number(minutes)||0));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`;
}
