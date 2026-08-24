export const FLIGHT_DRAFT_STORAGE_KEY="flytally.flight-draft.v1";

export type StoredFlightDraft={
  version:1;
  id:string;
  updatedAt:string;
  values:Record<string,string>;
};

const MAX_FIELDS=80;
const MAX_KEY=80;
const MAX_VALUE=6000;
const draftId=/^[A-Za-z0-9_-]{8,80}$/;

export function normalizeFlightDraft(value:unknown):StoredFlightDraft|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const source=value as Record<string,unknown>,id=String(source.id??"").trim(),updatedAt=String(source.updatedAt??"").trim();
  if(Number(source.version)!==1||!draftId.test(id)||!updatedAt||Number.isNaN(Date.parse(updatedAt)))return null;
  const raw=source.values;if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const values:Record<string,string>={};
  for(const [key,input] of Object.entries(raw as Record<string,unknown>).slice(0,MAX_FIELDS)){
    if(!key||key.length>MAX_KEY||typeof input!=="string")continue;
    values[key]=input.slice(0,MAX_VALUE);
  }
  return{version:1,id,updatedAt,values};
}

export function parseFlightDraft(raw:string|null):StoredFlightDraft|null{
  if(!raw)return null;
  try{return normalizeFlightDraft(JSON.parse(raw))}catch{return null}
}

export function flightDraftSummary(draft:StoredFlightDraft){
  const v=draft.values,route=[v.departure,v.arrival].filter(Boolean).join(" → ");
  return [v.date,v.registration,route].filter(Boolean).join(" · ")||"Unsynced flight draft";
}
