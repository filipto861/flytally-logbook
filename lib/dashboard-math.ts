export function flightDateKey(value:unknown):string|null{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  const raw=String(value??"").trim();
  let year=0,month=0,day=0;
  const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const czech=/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(raw);
  if(iso){year=Number(iso[1]);month=Number(iso[2]);day=Number(iso[3])}
  else if(czech){day=Number(czech[1]);month=Number(czech[2]);year=Number(czech[3])}
  else return null;
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export function flightMinutes(start:unknown,end:unknown):number{
  const parse=(value:unknown)=>{const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value??"").trim());return match?Number(match[1])*60+Number(match[2]):null};
  const from=parse(start),to=parse(end);
  return from===null||to===null?0:(to-from+1440)%1440;
}

export function niceChartMaximum(value:number,steps=4):number{
  const safe=Math.max(1,Number.isFinite(value)?value:1),rawStep=safe/Math.max(1,steps),magnitude=10**Math.floor(Math.log10(rawStep)),normalized=rawStep/magnitude;
  const nice=normalized<=1?1:normalized<=2?2:normalized<=2.5?2.5:normalized<=5?5:10;
  return nice*magnitude*Math.max(1,steps);
}
