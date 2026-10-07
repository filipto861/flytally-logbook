import { normalizeAircraftProfileContext,type AircraftProfileClass,type AircraftRegulatoryCategory } from "./aircraft-profile-context.ts";
import { validIsoDate } from "./rate-history.ts";

export const AIRCRAFT_BALLOON_CLASSES=["HOT_AIR_BALLOON","GAS_BALLOON","HOT_AIR_AIRSHIP","MIXED_BALLOON"] as const;
export const AIRCRAFT_BALLOON_GROUPS=["A","B","C","D"] as const;
export const PART_FCL_CREDIT_CLASSES=["SEP","TMG"] as const;
export const AIRCRAFT_DEFAULT_OPERATION_TYPES=["SP","MP"] as const;
export const AIRCRAFT_DEFAULT_ENGINE_TYPES=["SE","ME"] as const;

export type AircraftBalloonClass=(typeof AIRCRAFT_BALLOON_CLASSES)[number]|"";
export type AircraftBalloonGroup=(typeof AIRCRAFT_BALLOON_GROUPS)[number]|"";
export type PartFclCreditClass=(typeof PART_FCL_CREDIT_CLASSES)[number]|"";
export type AircraftDefaultOperationType=(typeof AIRCRAFT_DEFAULT_OPERATION_TYPES)[number]|"";
export type AircraftDefaultEngineType=(typeof AIRCRAFT_DEFAULT_ENGINE_TYPES)[number]|"";

export type AircraftProfileValidationInput={
  aircraftMake?:unknown;
  aircraftModel?:unknown;
  evidence?:unknown;
  aircraftClass?:unknown;
  regulatoryCategory?:unknown;
  balloonClass?:unknown;
  balloonGroup?:unknown;
  partFclCreditClass?:unknown;
  partFclCreditBasis?:unknown;
  partFclCreditFrom?:unknown;
};

export type CanonicalAircraftProfileRegulatoryFields={
  evidence:"ULL"|"EASA";
  aircraftClass:AircraftProfileClass;
  regulatoryCategory:AircraftRegulatoryCategory;
  balloonClass:AircraftBalloonClass;
  balloonGroup:AircraftBalloonGroup;
  partFclCreditClass:PartFclCreditClass;
  partFclCreditBasis:string;
  partFclCreditFrom:string;
};

export type AircraftProfileValidationResult=
  |{profile:CanonicalAircraftProfileRegulatoryFields;error?:undefined}
  |{profile?:undefined;error:string};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();

export function parseAircraftDefaultOperationType(value:unknown):
  |{value:AircraftDefaultOperationType;error?:undefined}
  |{value?:undefined;error:string}{
  const normalized=upper(value);
  if(!normalized)return{value:""};
  if(!AIRCRAFT_DEFAULT_OPERATION_TYPES.includes(normalized as Exclude<AircraftDefaultOperationType,"">)){
    return{error:"Default operation must be single-pilot, multi-pilot or not set."};
  }
  return{value:normalized as Exclude<AircraftDefaultOperationType,"">};
}

export function parseAircraftDefaultEngineType(value:unknown):
  |{value:AircraftDefaultEngineType;error?:undefined}
  |{value?:undefined;error:string}{
  const normalized=upper(value);
  if(!normalized)return{value:""};
  if(!AIRCRAFT_DEFAULT_ENGINE_TYPES.includes(normalized as Exclude<AircraftDefaultEngineType,"">)){
    return{error:"Default engine must be single-engine, multi-engine or not set."};
  }
  return{value:normalized as Exclude<AircraftDefaultEngineType,"">};
}

function explicitCategoryCompatible(evidence:string,aircraftClass:string,requested:string){
  if(!requested)return true;
  if(evidence==="ULL")return requested==="ULL";
  if(["SEP","MEP","SET"].includes(aircraftClass))return requested==="AEROPLANE";
  if(aircraftClass==="HELICOPTER")return requested==="HELICOPTER";
  if(aircraftClass==="BALLOON")return requested==="BALLOON";
  if(aircraftClass==="GLIDER")return requested==="SAILPLANE";
  if(aircraftClass==="TMG")return requested==="AEROPLANE"||requested==="SAILPLANE";
  if(aircraftClass==="OTHER")return requested==="AEROPLANE"||requested==="SAILPLANE"||requested==="OTHER";
  return false;
}

export function validateAircraftProfile(input:AircraftProfileValidationInput):AircraftProfileValidationResult{
  const make=text(input.aircraftMake),model=text(input.aircraftModel),requestedEvidence=upper(input.evidence),requestedClass=upper(input.aircraftClass),requestedCategory=upper(input.regulatoryCategory);

  if(requestedCategory&&!explicitCategoryCompatible(requestedEvidence,requestedClass,requestedCategory)){
    return{error:"Aircraft class/category and regulatory context do not match."};
  }

  const normalized=normalizeAircraftProfileContext(requestedEvidence,requestedClass,requestedCategory);
  if(!normalized.context)return{error:normalized.error||"Select a valid aircraft profile."};
  const{evidence,aircraftClass,regulatoryCategory}=normalized.context;

  if(evidence==="EASA"&&(!make||!model)){
    return{error:"An EASA aircraft profile requires both manufacturer (Make) and aircraft type/model."};
  }

  const balloonClassRaw=upper(input.balloonClass),balloonGroupRaw=upper(input.balloonGroup);
  if(regulatoryCategory!=="BALLOON"&&(balloonClassRaw||balloonGroupRaw)){
    return{error:"Balloon class/group can only be stored on a Balloon / Part-BFCL aircraft profile."};
  }

  let balloonClass:AircraftBalloonClass="",balloonGroup:AircraftBalloonGroup="";
  if(regulatoryCategory==="BALLOON"){
    if(!AIRCRAFT_BALLOON_CLASSES.includes(balloonClassRaw as Exclude<AircraftBalloonClass,"">)){
      return{error:"Select the Part-BFCL balloon class."};
    }
    balloonClass=balloonClassRaw as Exclude<AircraftBalloonClass,"">;
    if(balloonClass==="HOT_AIR_BALLOON"){
      if(!AIRCRAFT_BALLOON_GROUPS.includes(balloonGroupRaw as Exclude<AircraftBalloonGroup,"">)){
        return{error:"Select hot-air balloon group A, B, C or D."};
      }
      balloonGroup=balloonGroupRaw as Exclude<AircraftBalloonGroup,"">;
    }else if(balloonGroupRaw){
      return{error:"Hot-air balloon group is not applicable to this balloon class."};
    }
  }

  const creditRaw=upper(input.partFclCreditClass),creditBasis=text(input.partFclCreditBasis).slice(0,300),creditFrom=text(input.partFclCreditFrom).slice(0,10);
  if(creditRaw&&!PART_FCL_CREDIT_CLASSES.includes(creditRaw as Exclude<PartFclCreditClass,"">)){
    return{error:"Select a valid Part-FCL credit class."};
  }
  const partFclCreditClass=(creditRaw||"") as PartFclCreditClass;
  if(partFclCreditClass&&(!creditBasis||!validIsoDate(creditFrom))){
    return{error:"Part-FCL credit needs a basis/reference and a valid-from date."};
  }

  return{profile:{
    evidence,
    aircraftClass,
    regulatoryCategory,
    balloonClass,
    balloonGroup,
    partFclCreditClass,
    partFclCreditBasis:creditBasis,
    partFclCreditFrom:creditFrom,
  }};
}
