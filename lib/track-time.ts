export type TrackTimeBasis="utc"|"offset"|"ambiguous"|"none";

export function trackTimestampBasis(value:unknown):TrackTimeBasis{
  const raw=String(value??"").trim();
  if(!raw)return"none";
  if(/Z$/i.test(raw))return"utc";
  if(/[+-]\d{2}:?\d{2}$/.test(raw))return"offset";
  return"ambiguous";
}

export function trackTimeBasis(values:Array<{time?:string|null}>):TrackTimeBasis{
  const bases=[...new Set(values.map(value=>trackTimestampBasis(value.time)).filter(value=>value!=="none"))];
  if(!bases.length)return"none";
  if(bases.every(value=>value==="utc"))return"utc";
  if(bases.every(value=>value==="utc"||value==="offset"))return"offset";
  return"ambiguous";
}

export function utcParts(value:string|null|undefined){
  if(!value)return null;
  const basis=trackTimestampBasis(value);
  if(basis==="ambiguous"||basis==="none")return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return null;
  return{
    date:`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`,
    time:`${String(date.getUTCHours()).padStart(2,"0")}:${String(date.getUTCMinutes()).padStart(2,"0")}`,
  };
}
