export const REGULATORY_AIRCRAFT_CATEGORIES=["AEROPLANE","HELICOPTER","BALLOON","SAILPLANE","ULL","OTHER"] as const;
export type RegulatoryAircraftCategory=(typeof REGULATORY_AIRCRAFT_CATEGORIES)[number];

export const EASA_AIRCRAFT_PROFILE_CLASSES=["SEP","TMG","MEP","SET","HELICOPTER","BALLOON","OTHER","GLIDER"] as const;
export type EasaAircraftProfileClass=(typeof EASA_AIRCRAFT_PROFILE_CLASSES)[number];

export type FlightAircraftCategory="aeroplane"|"helicopter"|"balloon"|"ull"|"sailplane"|"other";
export type CategoryTimeEntryMode="STANDARD"|"SAILPLANE_LAUNCH";
export type CategoryMovementEvidenceMode="FCL060_PF"|"SFCL_LAUNCH"|"SFCL_TMG"|"BFCL_TAKEOFF_LANDING"|"NONE";
export type CategoryRecencyFamily="PART_FCL_A"|"PART_FCL_H"|"PART_SFCL"|"PART_BFCL"|"ULL"|"NONE";

export type AircraftCategoryCapabilities={
  regulatoryCategory:RegulatoryAircraftCategory;
  category:FlightAircraftCategory;
  label:string;
  isTmg:boolean;
  timeEntryMode:CategoryTimeEntryMode;
  movementEvidenceMode:CategoryMovementEvidenceMode;
  recencyFamily:CategoryRecencyFamily;
  requiresTypeSpecificRecency:boolean;
  supportsFcl060MovementEvidence:boolean;
};

const LABELS:Record<FlightAircraftCategory,string>={
  aeroplane:"Aeroplane",
  helicopter:"Helicopter",
  balloon:"Balloon",
  ull:"ULL",
  sailplane:"Sailplane",
  other:"Aircraft",
};

const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const REGULATORY_CATEGORY_SET=new Set<string>(REGULATORY_AIRCRAFT_CATEGORIES);
const AEROPLANE_CLASSES=new Set(["SEP","TMG","MEP","SET"]);

export function explicitRegulatoryAircraftCategory(value:unknown):RegulatoryAircraftCategory|undefined{
  const normalized=clean(value);
  return REGULATORY_CATEGORY_SET.has(normalized)?normalized as RegulatoryAircraftCategory:undefined;
}

/**
 * Conservative compatibility resolver for records that predate explicit regulatory_category.
 * TMG intentionally remains Part-FCL aeroplane unless an explicit SAILPLANE snapshot exists.
 */
export function legacyRegulatoryAircraftCategory(input:{aircraftClass?:unknown;evidence?:unknown}):RegulatoryAircraftCategory{
  const aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  if(aircraftClass==="ULL"||evidence==="ULL")return "ULL";
  if(aircraftClass==="GLIDER")return "SAILPLANE";
  if(aircraftClass==="HELICOPTER")return "HELICOPTER";
  if(aircraftClass==="BALLOON")return "BALLOON";
  if(AEROPLANE_CLASSES.has(aircraftClass))return "AEROPLANE";
  return "OTHER";
}

export function resolveRegulatoryAircraftCategory(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):RegulatoryAircraftCategory{
  return explicitRegulatoryAircraftCategory(input.regulatoryCategory)??legacyRegulatoryAircraftCategory(input);
}

export function flightAircraftCategoryFor(regulatoryCategory:RegulatoryAircraftCategory):FlightAircraftCategory{
  if(regulatoryCategory==="AEROPLANE")return "aeroplane";
  if(regulatoryCategory==="HELICOPTER")return "helicopter";
  if(regulatoryCategory==="BALLOON")return "balloon";
  if(regulatoryCategory==="SAILPLANE")return "sailplane";
  if(regulatoryCategory==="ULL")return "ull";
  return "other";
}

/**
 * Canonical v2.0 category capability contract.
 * It describes how an already-resolved category is represented; it never grants privileges,
 * rewrites stored regulatory data, or converts evidence between regulatory systems.
 */
export function aircraftCategoryCapabilities(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):AircraftCategoryCapabilities{
  const regulatoryCategory=resolveRegulatoryAircraftCategory(input);
  const category=flightAircraftCategoryFor(regulatoryCategory);
  const aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  const isTmg=aircraftClass==="TMG";

  let timeEntryMode:CategoryTimeEntryMode="STANDARD";
  let movementEvidenceMode:CategoryMovementEvidenceMode="NONE";
  let recencyFamily:CategoryRecencyFamily="NONE";
  let requiresTypeSpecificRecency=false;

  if(regulatoryCategory==="AEROPLANE"){
    recencyFamily="PART_FCL_A";
    if(evidence==="EASA")movementEvidenceMode="FCL060_PF";
  }else if(regulatoryCategory==="HELICOPTER"){
    recencyFamily="PART_FCL_H";
    requiresTypeSpecificRecency=true;
    if(evidence==="EASA")movementEvidenceMode="FCL060_PF";
  }else if(regulatoryCategory==="SAILPLANE"){
    recencyFamily="PART_SFCL";
    if(isTmg){
      movementEvidenceMode="SFCL_TMG";
    }else{
      timeEntryMode="SAILPLANE_LAUNCH";
      movementEvidenceMode="SFCL_LAUNCH";
    }
  }else if(regulatoryCategory==="BALLOON"){
    recencyFamily="PART_BFCL";
    movementEvidenceMode="BFCL_TAKEOFF_LANDING";
  }else if(regulatoryCategory==="ULL"){
    recencyFamily="ULL";
  }

  return {
    regulatoryCategory,
    category,
    label:LABELS[category],
    isTmg,
    timeEntryMode,
    movementEvidenceMode,
    recencyFamily,
    requiresTypeSpecificRecency,
    supportsFcl060MovementEvidence:movementEvidenceMode==="FCL060_PF",
  };
}
