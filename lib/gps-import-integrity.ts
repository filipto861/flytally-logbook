import {
  allowedFlightContexts,
  type CanonicalFlightAircraftContext,
  type FlightAircraftAuthorityProfileInput,
} from "./flight-aircraft-context-authority.ts";
import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";
import { aircraftCategoryCapabilities } from "./aircraft-category.ts";
import { defaultEngineType,ENGINE_TYPES,OPERATION_TYPES } from "./easa-logbook.ts";

export const GPS_IMPORT_ROLES=["PIC"] as const;
export type GpsImportRole=(typeof GPS_IMPORT_ROLES)[number];

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();

export function resolveGpsImportAircraftContext(input:FlightAircraftAuthorityProfileInput):
  |{profile:CanonicalAircraftProfileRegulatoryFields;contexts:CanonicalFlightAircraftContext[];error?:undefined}
  |{profile?:undefined;contexts?:undefined;error:string}{
  const resolved=allowedFlightContexts(input);
  if(!resolved.profile||!resolved.contexts)return{error:resolved.error||"Selected aircraft profile needs configuration before GPS import."};
  return{profile:resolved.profile,contexts:resolved.contexts};
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
  submitted:{evidence:unknown;aircraftClass:unknown;regulatoryCategory:unknown;aircraftType:unknown},
  allowed:readonly CanonicalFlightAircraftContext[],
):{context?:CanonicalFlightAircraftContext;error?:string}{
  const evidence=upper(submitted.evidence),aircraftClass=upper(submitted.aircraftClass),aircraftType=String(submitted.aircraftType??"").trim();
  const requestedCategory=upper(submitted.regulatoryCategory);
  const regulatoryCategory=requestedCategory||allowed.length===1?requestedCategory||allowed[0]?.regulatoryCategory||"":requestedCategory;
  if(!regulatoryCategory&&allowed.length>1){
    return{error:"Select the regulatory context for this GPS import."};
  }
  const context=allowed.find(item=>
    item.evidence===evidence
    &&item.aircraftClass===aircraftClass
    &&item.regulatoryCategory===regulatoryCategory
    &&item.aircraftType===aircraftType
  );
  if(!context){
    return{error:"GPS import aircraft context no longer matches the selected aircraft profile. Reload the aircraft and review the import."};
  }
  return{context};
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


export type GpsImportSourceRequirements={
  landingMode:"DAY_NIGHT"|"TOTAL";
  movementMode:"FCL060_PF"|"EXPLICIT_TAKEOFFS"|"SAILPLANE_LAUNCH"|"NONE";
  reviewNightIfr:boolean;
};

export function gpsImportSourceRequirements(profile:CanonicalAircraftProfileRegulatoryFields):GpsImportSourceRequirements{
  const capabilities=aircraftCategoryCapabilities({
    regulatoryCategory:profile.regulatoryCategory,
    aircraftClass:profile.aircraftClass,
    evidence:profile.evidence,
  });
  return{
    landingMode:capabilities.timeEntryMode==="SAILPLANE_LAUNCH"?"TOTAL":"DAY_NIGHT",
    movementMode:capabilities.movementEvidenceMode==="FCL060_PF"?"FCL060_PF":
      capabilities.movementEvidenceMode==="SFCL_TMG"||capabilities.movementEvidenceMode==="BFCL_TAKEOFF_LANDING"?"EXPLICIT_TAKEOFFS":
      capabilities.movementEvidenceMode==="SFCL_LAUNCH"?"SAILPLANE_LAUNCH":"NONE",
    reviewNightIfr:capabilities.timeEntryMode==="STANDARD",
  };
}
