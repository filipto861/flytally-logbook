export const OPERATION_TYPES=["SP","MP"] as const;
export const ENGINE_TYPES=["SE","ME"] as const;
export const EASA_ROLES=["PIC","SOLO","CO-PILOT","CRUISE-RELIEF CO-PILOT","DUAL","SPIC","PICUS","FI","INSTRUCTOR","EXAMINER","SAFETY PILOT"] as const;

export function durationMinutes(value:unknown){
  const raw=String(value??"").trim();
  if(!raw)return 0;
  if(/^\d+:\d{2}$/.test(raw)){const [hours,minutes]=raw.split(":").map(Number);return Math.max(0,Math.min(24*60,hours*60+minutes))}
  const numeric=Number(raw);return Number.isFinite(numeric)?Math.max(0,Math.min(24*60,Math.round(numeric))):0;
}
export function formatEasaDuration(minutes:unknown){const value=Math.max(0,Math.round(Number(minutes)||0));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`}
export function allocatedFunctionTimes(role:string,blockMinutes:number){
  const minutes=Math.max(0,Math.round(blockMinutes)),normalized=role.trim().toUpperCase();
  return{picMinutes:["PIC","SOLO","SPIC","PICUS","FI","INSTRUCTOR","EXAMINER"].includes(normalized)?minutes:0,copilotMinutes:["CO-PILOT","CRUISE-RELIEF CO-PILOT"].includes(normalized)?minutes:0,dualMinutes:normalized==="DUAL"?minutes:0,instructorMinutes:["FI","INSTRUCTOR","EXAMINER"].includes(normalized)?minutes:0};
}
export function defaultEngineType(aircraftClass:string){return aircraftClass.trim().toUpperCase()==="MEP"?"ME":"SE"}
