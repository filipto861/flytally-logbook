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

export const AUXILIARY_LOGBOOK_ROLES=["SAFETY PILOT","PAX","OBSERVER"] as const;
export function isAuxiliaryLogbookRole(role:unknown){return AUXILIARY_LOGBOOK_ROLES.includes(String(role??"").trim().toUpperCase() as (typeof AUXILIARY_LOGBOOK_ROLES)[number])}

export type PilotPreferences={
  default_evidence?:string;
  pilot_address?:string;
  licence_number?:string;
  easa_address?:string;
  easa_licence_number?:string;
  ull_address?:string;
  ull_licence_number?:string;
  print_default_scope?:string;
  print_include_auxiliary_roles?:boolean;
  [key:string]:unknown;
};
export function parsePilotPreferences(value:unknown):PilotPreferences{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as PilotPreferences;
  try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}
}

const clean=(value:unknown)=>String(value??"").trim();
export function printIdentity(preferences:PilotPreferences,scope:LogbookPrintScope){
  const easaAddress=clean(preferences.easa_address)||clean(preferences.pilot_address),easaLicence=clean(preferences.easa_licence_number)||clean(preferences.licence_number);
  const ullAddress=clean(preferences.ull_address)||clean(preferences.pilot_address),ullLicence=clean(preferences.ull_licence_number);
  if(scope==="easa")return{address:easaAddress,licence:easaLicence,addressLabel:"Holder's address",licenceLabel:"Holder's licence number"};
  if(scope==="ull")return{address:ullAddress,licence:ullLicence,addressLabel:"Holder's address",licenceLabel:"Holder's licence number"};
  const addresses=[easaAddress?`EASA: ${easaAddress}`:"",ullAddress?`ULL: ${ullAddress}`:""].filter(Boolean).join("\n");
  const licences=[easaLicence?`EASA: ${easaLicence}`:"",ullLicence?`ULL: ${ullLicence}`:""].filter(Boolean).join("\n");
  return{address:addresses,licence:licences,addressLabel:"Holder's addresses",licenceLabel:"Holder's licence numbers"};
}

export function pilotInCommandName(row:Record<string,unknown>,pilotName:string){
  const role=String(row.role??"").trim().toUpperCase();
  const instructor=String(row.instructor??"").trim();
  const commander=String(row.commander??"").trim();

  // During dual instruction the instructor is the pilot in command unless the
  // record explicitly lacks an instructor. This must take precedence over a
  // legacy/default commander value that may contain the student's own name.
  if(role==="DUAL"&&instructor)return instructor;
  if(commander)return commander;
  if(["PIC","SOLO","SPIC","PICUS","INSTRUCTOR","EXAMINER"].includes(role))return pilotName.trim();
  return "";
}
