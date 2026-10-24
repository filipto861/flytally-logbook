export type PaceCategory="total"|"ull"|"easa";
export type PaceMonth={month:string;total:number;ull:number;easa:number};
export type PaceComparison={currentMinutes:number;previousMinutes:number;currentRange:string;previousRange:string;percentChange:number|null};
export type DashboardPaceView={status:"available"|"empty"|"unavailable";months:PaceMonth[];comparisons:Record<PaceCategory,PaceComparison>|null;currentMonth:string;reason?:string};

const monthId=(year:number,month:number)=>`${year}-${String(month+1).padStart(2,"0")}`;
const formatInterval=(start:string,end:string)=>`${start} – ${end}`;
const categoryNames=["total","ull","easa"] as const;

export function buildDashboardPace(rows:readonly PaceMonth[]|null,asOf:Date=new Date(),invalidDateFlights=0):DashboardPaceView{
  const invalid={status:"unavailable",months:[],comparisons:null,currentMonth:"",reason:"Monthly flight data is unavailable."} as const;
  if(!Number.isFinite(asOf.getTime())||rows===null||invalidDateFlights>0)return invalid;
  const baseYear=asOf.getUTCFullYear(),baseMonth=asOf.getUTCMonth();
  const keys=Array.from({length:25},(_,i)=>{const d=new Date(Date.UTC(baseYear,baseMonth-24+i,1));return monthId(d.getUTCFullYear(),d.getUTCMonth())});
  const provided=new Map<string,PaceMonth>();
  for(const row of rows){
    if(!row||typeof row.month!=="string"||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(row.month)||provided.has(row.month))return invalid;
    if(categoryNames.some(category=>!Number.isSafeInteger(row[category])||row[category]<0))return invalid;
    if(keys.includes(row.month))provided.set(row.month,row);
  }
  const all=keys.map(month=>provided.get(month)??{month,total:0,ull:0,easa:0});
  const months=all.slice(1);
  const comparisons={} as Record<PaceCategory,PaceComparison>;
  for(const category of categoryNames){
    const previousMinutes=all.slice(0,12).reduce((sum,month)=>sum+month[category],0);
    const currentMinutes=all.slice(12,24).reduce((sum,month)=>sum+month[category],0);
    comparisons[category]={
      currentMinutes,previousMinutes,
      currentRange:formatInterval(keys[12],keys[23]),
      previousRange:formatInterval(keys[0],keys[11]),
      percentChange:previousMinutes>0?Math.round(((currentMinutes-previousMinutes)/previousMinutes)*100):null,
    };
  }
  return {status:rows.length===0?"empty":"available",months,comparisons,currentMonth:keys[24]};
}
