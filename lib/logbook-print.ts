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

export type LicenceProfile={scope?:string;number?:string;address?:string};
export type PilotPreferences={
  default_evidence?:string;
  pilot_address?:string;
  licence_number?:string;
  easa_address?:string;
  easa_licence_number?:string;
  ull_address?:string;
  ull_licence_number?:string;
  licence_profiles?:Record<string,LicenceProfile>;
  print_default_scope?:string;
  print_include_auxiliary_roles?:boolean;
  [key:string]:unknown;
};
export function parsePilotPreferences(value:unknown):PilotPreferences{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as PilotPreferences;
  try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}
}

const clean=(value:unknown)=>{const result=String(value??"").trim();return ["nan","null","undefined"].includes(result.toLowerCase())?"":result};
export function licenceProfileMap(preferences:PilotPreferences):Record<string,LicenceProfile>{
  const value=preferences.licence_profiles;
  return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
}

export function fullAircraftIdentity(row:Record<string,unknown>){
  return [clean(row.aircraft_make),clean(row.aircraft_model)||clean(row.aircraft_type),clean(row.aircraft_variant)].filter(Boolean).join(" ")||clean(row.aircraft_type);
}

export function aircraftPrintCode(row:Record<string,unknown>){
  return (clean(row.icao_type)||clean(row.aircraft_type)||clean(row.aircraft_model)||fullAircraftIdentity(row)).toUpperCase();
}

function licenceForScope(preferences:PilotPreferences,licences:Array<Record<string,unknown>>,target:"EASA"|"ULL"){
  const profiles=licenceProfileMap(preferences),today=new Date().toISOString().slice(0,10);
  const candidates=licences.filter(row=>String(row.category??"").trim().toUpperCase()==="LICENCE"&&Number(row.active??1)!==0).map(row=>{
    const profile=profiles[String(row.id??"")]??{},expiry=clean(row.expiry_date),scope=clean(profile.scope).toUpperCase();
    return{row,profile,expiry,scope,valid:!expiry||expiry>=today};
  }).filter(item=>item.scope===target).sort((a,b)=>Number(b.valid)-Number(a.valid)||b.expiry.localeCompare(a.expiry));
  const selected=candidates[0];
  const legacyAddress=target==="EASA"?(clean(preferences.easa_address)||clean(preferences.pilot_address)):(clean(preferences.ull_address)||clean(preferences.pilot_address));
  const legacyNumber=target==="EASA"?(clean(preferences.easa_licence_number)||clean(preferences.licence_number)):clean(preferences.ull_licence_number);
  if(!selected)return{address:legacyAddress,number:legacyNumber,expiry:"",expired:false,label:""};
  return{address:clean(selected.profile.address)||legacyAddress,number:clean(selected.profile.number)||legacyNumber,expiry:selected.expiry,expired:Boolean(selected.expiry&&selected.expiry<today),label:clean(selected.row.label)};
}

const expiryWarning=(prefix:string,entry:{expired:boolean;label:string;number:string;expiry:string})=>entry.expired?`${prefix} licence ${entry.label||entry.number||"record"} is expired (${entry.expiry}).`:"";
export function printIdentity(preferences:PilotPreferences,scope:LogbookPrintScope,licences:Array<Record<string,unknown>>=[]){
  const easa=licenceForScope(preferences,licences,"EASA"),ull=licenceForScope(preferences,licences,"ULL");
  if(scope==="easa")return{address:easa.address,licence:easa.number,addressLabel:"Holder's address",licenceLabel:"Holder's licence number",warnings:[expiryWarning("EASA",easa)].filter(Boolean)};
  if(scope==="ull")return{address:ull.address,licence:ull.number,addressLabel:"Holder's address",licenceLabel:"Holder's licence number",warnings:[expiryWarning("ULL",ull)].filter(Boolean)};
  const addresses=[easa.address?`EASA: ${easa.address}`:"",ull.address?`ULL: ${ull.address}`:""].filter(Boolean).join("\n");
  const numbers=[easa.number?`EASA: ${easa.number}`:"",ull.number?`ULL: ${ull.number}`:""].filter(Boolean).join("\n");
  return{address:addresses,licence:numbers,addressLabel:"Holder's addresses",licenceLabel:"Holder's licence numbers",warnings:[expiryWarning("EASA",easa),expiryWarning("ULL",ull)].filter(Boolean)};
}

export function pilotInCommandName(row:Record<string,unknown>,pilotName:string){
  const role=String(row.role??"").trim().toUpperCase();
  const instructor=clean(row.instructor);
  const commander=clean(row.commander);
  const verifier=clean(row.verification_name);
  if(role==="DUAL"&&instructor)return instructor;
  if(["SPIC","PICUS"].includes(role)&&verifier)return verifier;
  if(commander)return commander;
  if(["PIC","SOLO","INSTRUCTOR","EXAMINER"].includes(role))return pilotName.trim();
  return "";
}
