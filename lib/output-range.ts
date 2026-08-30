const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const clean=(value:unknown)=>String(value??"").trim();

function normalizeDate(value:unknown){
  const raw=clean(value);
  if(!raw)return{value:null,error:null};
  if(!ISO_DATE.test(raw))return{value:null,error:"invalid" as const};
  const parsed=new Date(`${raw}T00:00:00Z`);
  if(!Number.isFinite(parsed.valueOf())||parsed.toISOString().slice(0,10)!==raw)return{value:null,error:"invalid" as const};
  return{value:raw,error:null};
}

export type OutputDateRange={from:string|null;to:string|null;error:string|null;label:string};

export function normalizeOutputDateRange(fromInput:unknown,toInput:unknown):OutputDateRange{
  const from=normalizeDate(fromInput),to=normalizeDate(toInput);
  if(from.error)return{from:null,to:to.value,error:"From date is invalid.",label:"invalid date range"};
  if(to.error)return{from:from.value,to:null,error:"To date is invalid.",label:"invalid date range"};
  if(from.value&&to.value&&from.value>to.value)return{from:from.value,to:to.value,error:"From date must not be after To date.",label:`${from.value} → ${to.value}`};
  const label=from.value&&to.value?`${from.value} → ${to.value}`:from.value?`from ${from.value}`:to.value?`through ${to.value}`:"complete date range";
  return{from:from.value,to:to.value,error:null,label};
}

export function outputRangeFileToken(range:Pick<OutputDateRange,"from"|"to">){
  if(range.from&&range.to)return`${range.from}-to-${range.to}`;
  if(range.from)return`from-${range.from}`;
  if(range.to)return`through-${range.to}`;
  return"all-dates";
}
