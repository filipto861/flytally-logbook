import { resolveFlightEntryAircraftProfileDefaults,type FlightEntryAircraftProfileInput } from "./flight-form-rules.ts";
import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";
import { aircraftCategoryCapabilities } from "./aircraft-category.ts";
import { defaultEngineType,ENGINE_TYPES,OPERATION_TYPES } from "./easa-logbook.ts";

export const GPS_IMPORT_ROLES=["PIC"] as const;
export type GpsImportRole=(typeof GPS_IMPORT_ROLES)[number];

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();

export function resolveGpsImportAircraftContext(input:FlightEntryAircraftProfileInput):
  |{profile:CanonicalAircraftProfileRegulatoryFields;error?:undefined}
  |{profile?:undefined;error:string}{
  const resolved=resolveFlightEntryAircraftProfileDefaults(input);
  if(!resolved.profile)return{error:resolved.error||"Selected aircraft profile needs configuration before GPS import."};
  return{profile:resolved.profile};
}

export function validateGpsImportRole(value:unknown):
  |{role:GpsImportRole;error?:undefined}
  |{role?:undefined;error:string}{
  const role=upper(value);
  if(!GPS_IMPORT_ROLES.includes(role as GpsImportRole)){
    return{error:"GPS import currently supports PIC only. Use Manual entry for other roles until Role/Crew parity is available."};
  }
  return{role:role as GpsImportRole};
}

export function validateGpsImportSubmittedAircraftContext(
  submitted:{evidence:unknown;aircraftClass:unknown},
  profile:CanonicalAircraftProfileRegulatoryFields,
):{error?:string}{
  const evidence=upper(submitted.evidence),aircraftClass=upper(submitted.aircraftClass);
  if(evidence!==profile.evidence||aircraftClass!==profile.aircraftClass){
    return{error:"GPS import must use the selected aircraft profile logbook and class. Resolve the aircraft profile before importing this track."};
  }
  return{};
}


export function gpsImportRequiresOperationEngine(profile:CanonicalAircraftProfileRegulatoryFields){
  return aircraftCategoryCapabilities({
    evidence:profile.evidence,
    aircraftClass:profile.aircraftClass,
    regulatoryCategory:profile.regulatoryCategory,
  }).showOperationEngineControls;
}

export function resolveGpsImportOperationEngine(
  submitted:{operationType:unknown;engineType:unknown},
  profile:CanonicalAircraftProfileRegulatoryFields,
):
  |{operationType:"SP"|"MP";engineType:"SE"|"ME";explicit:boolean;error?:undefined}
  |{operationType?:undefined;engineType?:undefined;explicit?:undefined;error:string}{
  if(!gpsImportRequiresOperationEngine(profile)){
    return{
      operationType:"SP",
      engineType:defaultEngineType(profile.aircraftClass),
      explicit:false,
    };
  }
  const operationType=upper(submitted.operationType),engineType=upper(submitted.engineType);
  if(!OPERATION_TYPES.includes(operationType as (typeof OPERATION_TYPES)[number])){
    return{error:"Select whether this GPS flight was single-pilot or multi-pilot."};
  }
  if(!ENGINE_TYPES.includes(engineType as (typeof ENGINE_TYPES)[number])){
    return{error:"Select whether this GPS flight used a single-engine or multi-engine aircraft configuration."};
  }
  return{
    operationType:operationType as "SP"|"MP",
    engineType:engineType as "SE"|"ME",
    explicit:true,
  };
}


function explicitCounter(value:unknown,label:string){
  const raw=String(value??"").trim();
  if(!/^\d{1,2}$/.test(raw))return{error:`Enter explicit ${label} from 0 to 99.`} as const;
  const count=Number(raw);
  if(!Number.isInteger(count)||count<0||count>99)return{error:`Enter explicit ${label} from 0 to 99.`} as const;
  return{value:count} as const;
}

function explicitDuration(value:unknown,label:string){
  const raw=String(value??"").trim();
  const match=raw.match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return{error:`Enter explicit ${label} as H:MM, including 0:00 when none.`} as const;
  const hours=Number(match[1]),minutes=Number(match[2]);
  if(minutes>59||hours>24||(hours===24&&minutes!==0))return{error:`Enter explicit ${label} as H:MM, including 0:00 when none.`} as const;
  return{value:hours*60+minutes} as const;
}

export function resolveGpsBasicSourceEvidence(
  submitted:{landingsDay:unknown;landingsNight:unknown;nightTime:unknown;ifrTime:unknown},
  blockMinutes:number|null,
):
  |{landingsDay:number;landingsNight:number;starts:number;nightMinutes:number;ifrMinutes:number;error?:undefined}
  |{error:string}{
  const day=explicitCounter(submitted.landingsDay,"day landings"),night=explicitCounter(submitted.landingsNight,"night landings");
  if("error" in day)return day;if("error" in night)return night;
  const nightTime=explicitDuration(submitted.nightTime,"Night time"),ifrTime=explicitDuration(submitted.ifrTime,"IFR time");
  if("error" in nightTime)return nightTime;if("error" in ifrTime)return ifrTime;
  if(blockMinutes!==null&&blockMinutes>0&&(nightTime.value>blockMinutes||ifrTime.value>blockMinutes)){
    return{error:"Night and IFR time cannot exceed BLOCK time."};
  }
  return{
    landingsDay:day.value,
    landingsNight:night.value,
    starts:day.value+night.value,
    nightMinutes:nightTime.value,
    ifrMinutes:ifrTime.value,
  };
}
