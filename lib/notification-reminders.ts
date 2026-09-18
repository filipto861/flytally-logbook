export function reminderStage(days:number,maxDays:number){
  if(days<0)return"expired";
  const safeMax=Math.max(0,Math.round(maxDays)||0);
  const thresholds=[...new Set([safeMax,7,1,0].filter(value=>value>=0&&value<=safeMax))].sort((a,b)=>a-b);
  return String(thresholds.find(value=>days<=value)??safeMax);
}
export function reminderTitle(label:string,days:number){
  if(days<0)return`${label} expired`;
  if(days===0)return`${label} due today`;
  if(days===1)return`${label} due tomorrow`;
  return`${label} due in ${days} days`;
}
