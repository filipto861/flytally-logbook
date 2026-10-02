import { allowedFlightContexts,type CanonicalFlightAircraftContext,type FlightAircraftAuthorityProfileInput } from "./flight-aircraft-context-authority.ts";
import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";
import { aircraftCategoryCapabilities } from "./aircraft-category.ts";
import { defaultEngineType,ENGINE_TYPES,OPERATION_TYPES } from "./easa-logbook.ts";
import { roleCrewSaveError,roleCrewSpec } from "./role-crew.ts";

export const GPS_IMPORT_ROLES=["PIC","DUAL"] as const;
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
    return{error:"GPS import currently supports PIC and DUAL. Other roles remain unavailable until their Role/Crew authority is implemented."};
  }
  return{role:role as GpsImportRole};
}

export type GpsImportCommonRoleCrew={
  role:GpsImportRole;
  commander:string;
  instructor:string;
  verificationName:string;
  verificationReference:string;
};

export const GPS_IMPORT_ROLE_CREW_MODES=["INHERIT","OVERRIDE"] as const;
export type GpsImportRoleCrewMode=(typeof GPS_IMPORT_ROLE_CREW_MODES)[number];

export type GpsImportPartRoleCrewEnvelope={
  mode:unknown;
  role?:unknown;
  commander?:unknown;
  instructor?:unknown;
  verificationName?:unknown;
  verificationReference?:unknown;
  rolePresent?:boolean;
  commanderPresent?:boolean;
  instructorPresent?:boolean;
  verificationNamePresent?:boolean;
  verificationReferencePresent?:boolean;
};

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

export function resolveGpsImportCommonRoleCrew(
  submitted:{role:unknown;commander?:unknown;instructor?:unknown;verificationName?:unknown;verificationReference?:unknown},
  evidence:unknown,
):
  |{context:GpsImportCommonRoleCrew;error?:undefined}
  |{context?:undefined;error:string}{
  const roleResult=validateGpsImportRole(submitted.role);if(!roleResult.role)return{error:roleResult.error};
  const role=roleResult.role,commander=clean(submitted.commander,100),instructor=clean(submitted.instructor,100),verificationName=clean(submitted.verificationName,160),verificationReference=clean(submitted.verificationReference,160);
  if(role==="PIC"){
    if(commander||instructor||verificationName||verificationReference)return{error:"PIC GPS import does not accept additional Role/Crew evidence in the common context."};
    return{context:{role,commander:"",instructor:"",verificationName:"",verificationReference:""}};
  }
  if(commander||verificationName||verificationReference)return{error:"DUAL GPS import accepts only the Instructor / PIC field in the common Role/Crew context."};
  const spec=roleCrewSpec(role,String(evidence??""));if(!spec)return{error:"Select a valid GPS pilot role."};
  const crewError=roleCrewSaveError(spec,{instructor,verificationName:"",verificationReference:""});if(crewError)return{error:crewError};
  return{context:{role,commander:"",instructor,verificationName:"",verificationReference:""}};
}

export function resolveGpsImportPartRoleCrew(
  submitted:GpsImportPartRoleCrewEnvelope,
  evidence:unknown,
  common:GpsImportCommonRoleCrew,
):
  |{mode:GpsImportRoleCrewMode;context:GpsImportCommonRoleCrew;error?:undefined}
  |{mode?:undefined;context?:undefined;error:string}{
  const mode=upper(submitted.mode);
  if(!GPS_IMPORT_ROLE_CREW_MODES.includes(mode as GpsImportRoleCrewMode)){
    return{error:"Select whether this flight inherits the common Role/Crew context or uses a complete override."};
  }
  const presentFields=[
    submitted.rolePresent,
    submitted.commanderPresent,
    submitted.instructorPresent,
    submitted.verificationNamePresent,
    submitted.verificationReferencePresent,
  ];
  if(mode==="INHERIT"){
    if(presentFields.some(Boolean))return{error:"Inherited Role/Crew must not submit per-flight override fields."};
    return{mode:"INHERIT",context:{...common}};
  }

  if(!submitted.rolePresent)return{error:"A Role/Crew override must include its own Role."};
  const roleResult=validateGpsImportRole(submitted.role);if(!roleResult.role)return{error:roleResult.error};
  const role=roleResult.role;
  if(submitted.commanderPresent||submitted.verificationNamePresent||submitted.verificationReferencePresent){
    return{error:`${role} GPS Role/Crew override contains fields that are not applicable to this supported role.`};
  }
  if(role==="PIC"){
    if(submitted.instructorPresent)return{error:"PIC GPS Role/Crew override must contain only its own Role."};
  }else if(!submitted.instructorPresent){
    return{error:"DUAL GPS Role/Crew override must include its own Instructor / PIC field."};
  }

  const resolved=resolveGpsImportCommonRoleCrew({
    role,
    commander:submitted.commander,
    instructor:submitted.instructor,
    verificationName:submitted.verificationName,
    verificationReference:submitted.verificationReference,
  },evidence);
  if(!resolved.context)return{error:resolved.error};
  return{mode:"OVERRIDE",context:resolved.context};
}

const PART_ROLE_CREW_SUFFIXES=new Set([
  "mode",
  "role",
  "commander",
  "instructor",
  "verificationName",
  "verificationReference",
]);
const PART_COMMON_ONLY_SUFFIXES=new Set([
  "registration",
  "aircraftType",
  "aircraftClass",
  "evidence",
  "regulatoryCategory",
  "balloonClass",
  "balloonGroup",
  "balloonOperation",
  "operationType",
  "engineType",
  "billingBasis",
  "billingShare",
  "task",
]);

export function validateGpsImportPartEnvelopeKeys(keys:Iterable<string>,partCount:number):{error?:string}{
  for(const key of keys){
    const roleCrew=key.match(/^part_(\d+)_roleCrew_(.+)$/);
    if(roleCrew){
      const index=Number(roleCrew[1]),suffix=roleCrew[2];
      if(!Number.isSafeInteger(index)||index<0||index>=partCount)return{error:"Role/Crew override count does not match the reviewed track split."};
      if(!PART_ROLE_CREW_SUFFIXES.has(suffix))return{error:`Flight ${index+1} contains an unknown Role/Crew override field.`};
      continue;
    }
    const commonOnly=key.match(/^part_(\d+)_(registration|aircraftType|aircraftClass|evidence|regulatoryCategory|balloonClass|balloonGroup|balloonOperation|operationType|engineType|billingBasis|billingShare|task)$/);
    if(commonOnly){
      const index=Number(commonOnly[1]);
      if(!Number.isSafeInteger(index)||index<0||index>=partCount)return{error:"Per-flight common-context field count does not match the reviewed track split."};
      if(PART_COMMON_ONLY_SUFFIXES.has(commonOnly[2]))return{error:`Flight ${index+1} cannot override aircraft, operation, billing or other common GPS context.`};
    }
  }
  return{};
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
