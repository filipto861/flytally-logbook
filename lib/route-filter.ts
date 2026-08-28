const clean=(value:unknown)=>String(value??"").trim().toUpperCase();

export function directionalRouteKey(departure:unknown,arrival:unknown){
  const from=clean(departure),to=clean(arrival);
  return from&&to?`${from}→${to}`:"";
}

export function directionalRouteHref(departure:unknown,arrival:unknown){
  const key=directionalRouteKey(departure,arrival);
  return key?`/flights?route=${encodeURIComponent(key)}`:"/flights";
}

export function routePairKey(departure:unknown,arrival:unknown){
  const values=[clean(departure),clean(arrival)].filter(Boolean).sort();
  return values.length===2?`${values[0]}↔${values[1]}`:"";
}

export function parseRoutePair(value:unknown):{from:string;to:string}|null{
  const raw=clean(value),parts=raw.split(/[↔|]/).map(clean).filter(Boolean);
  if(parts.length!==2||parts[0]===parts[1])return null;
  return{from:parts[0],to:parts[1]};
}

export function routePairHref(departure:unknown,arrival:unknown){
  const key=routePairKey(departure,arrival);
  return key?`/flights?routePair=${encodeURIComponent(key)}`:"/flights";
}
