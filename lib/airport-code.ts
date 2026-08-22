export type AirportCodeFields={icao?:string|null;gps?:string|null;local?:string|null;ident?:string|null};

const normalized=(value:string|null|undefined)=>String(value??"").trim().toUpperCase();

export function preferredAirportCode(fields:AirportCodeFields){
  return [fields.icao,fields.gps,fields.local,fields.ident].map(normalized).find(Boolean)??"";
}

export function isLegacyCzechAirportIdent(value:string){return /^CZ-\d{4}$/.test(normalized(value))}
