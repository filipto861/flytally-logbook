export const LOGBOOK_PRINT_SCOPES=[
  {value:"all",label:"Complete logbook"},
  {value:"ull",label:"ULL only"},
  {value:"easa",label:"EASA only"},
  {value:"ull-easa",label:"ULL + EASA"},
] as const;

export type LogbookPrintScope=(typeof LOGBOOK_PRINT_SCOPES)[number]["value"];

export function normalizeLogbookPrintScope(value:unknown):LogbookPrintScope{
  const normalized=String(value??"").trim().toLowerCase();
  return LOGBOOK_PRINT_SCOPES.some(item=>item.value===normalized)?normalized as LogbookPrintScope:"all";
}

export function logbookPrintScopeLabel(scope:LogbookPrintScope){return LOGBOOK_PRINT_SCOPES.find(item=>item.value===scope)?.label??LOGBOOK_PRINT_SCOPES[0].label}

export function matchesLogbookPrintScope(evidence:unknown,scope:LogbookPrintScope){
  const value=String(evidence??"").trim().toUpperCase();
  if(scope==="all")return true;
  if(scope==="ull")return value==="ULL";
  if(scope==="easa")return value==="EASA";
  return value==="ULL"||value==="EASA";
}

export function withAccumulatedFlightTime<T extends Record<string,unknown>>(rows:T[]){
  let accumulated=0;
  return rows.map(row=>{accumulated+=Math.max(0,Math.round(Number(row.block_minutes)||0));return{...row,accumulated_minutes:accumulated}});
}

export type PilotPreferences={default_evidence?:string;pilot_address?:string;licence_number?:string;[key:string]:unknown};
export function parsePilotPreferences(value:unknown):PilotPreferences{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as PilotPreferences;
  try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}
}

export function pilotInCommandName(row:Record<string,unknown>,pilotName:string){
  const commander=String(row.commander??"").trim();if(commander)return commander;
  const role=String(row.role??"").trim().toUpperCase(),instructor=String(row.instructor??"").trim();
  if(role==="DUAL"&&instructor)return instructor;
  if(["PIC","SOLO","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(role))return pilotName.trim();
  return "";
}
