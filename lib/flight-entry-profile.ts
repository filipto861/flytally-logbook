export type FlightAircraftCategory="aeroplane"|"helicopter"|"balloon"|"ull"|"sailplane"|"other";
export type RegulatoryAircraftCategory="AEROPLANE"|"HELICOPTER"|"BALLOON"|"SAILPLANE"|"ULL"|"OTHER";

export type FlightEntryProfile={
  category:FlightAircraftCategory;
  regulatoryCategory:RegulatoryAircraftCategory;
  label:string;
  selected:boolean;
  context:string;
  isTmg:boolean;
  showStandardExperience:boolean;
  showSailplaneExperience:boolean;
  showRegulatoryMovements:boolean;
};

const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const AEROPLANE_CLASSES=new Set(["SEP","TMG","MEP","SET"]);
const REGULATORY_CATEGORIES=new Set<RegulatoryAircraftCategory>(["AEROPLANE","HELICOPTER","BALLOON","SAILPLANE","ULL","OTHER"]);

export function regulatoryAircraftCategory(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):RegulatoryAircraftCategory{
  const explicit=clean(input.regulatoryCategory) as RegulatoryAircraftCategory;
  if(REGULATORY_CATEGORIES.has(explicit))return explicit;
  const aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  if(aircraftClass==="ULL"||evidence==="ULL")return "ULL";
  if(aircraftClass==="GLIDER")return "SAILPLANE";
  if(aircraftClass==="HELICOPTER")return "HELICOPTER";
  if(aircraftClass==="BALLOON")return "BALLOON";
  // Legacy TMG records stay in the existing Part-FCL aeroplane context unless an
  // explicit v1.62 regulatory category says otherwise. This avoids silently
  // reclassifying historical TMG evidence into SPL/SFCL calculations.
  if(AEROPLANE_CLASSES.has(aircraftClass))return "AEROPLANE";
  return "OTHER";
}

export function flightAircraftCategory(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):FlightAircraftCategory{
  const regulatoryCategory=regulatoryAircraftCategory(input);
  if(regulatoryCategory==="SAILPLANE")return "sailplane";
  if(regulatoryCategory==="HELICOPTER")return "helicopter";
  if(regulatoryCategory==="BALLOON")return "balloon";
  if(regulatoryCategory==="ULL")return "ull";
  if(regulatoryCategory==="AEROPLANE")return "aeroplane";
  return "other";
}

const LABELS:Record<FlightAircraftCategory,string>={aeroplane:"Aeroplane",helicopter:"Helicopter",balloon:"Balloon",ull:"ULL",sailplane:"Sailplane",other:"Aircraft"};

export function flightEntryProfile(input:{hasAircraft:boolean;regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):FlightEntryProfile{
  const regulatoryCategory=regulatoryAircraftCategory(input),category=flightAircraftCategory(input),label=LABELS[category],aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence),isTmg=aircraftClass==="TMG",sailplane=regulatoryCategory==="SAILPLANE";
  const context=[label,evidence,aircraftClass].filter((value,index,items)=>Boolean(value)&&items.indexOf(value)===index).join(" · ");
  return {
    category,
    regulatoryCategory,
    label,
    selected:input.hasAircraft,
    context,
    isTmg,
    // Balloons, helicopters and aeroplanes use the standard time / landing block.
    // A non-TMG sailplane uses launch/landing evidence instead. TMG keeps the standard controls.
    showStandardExperience:input.hasAircraft&&(!sailplane||isTmg),
    showSailplaneExperience:input.hasAircraft&&sailplane&&!isTmg,
    // FCL.060 movement evidence applies only to Part-FCL aeroplanes and helicopters.
    // Balloon take-offs/landings are stored as BFCL evidence but are not FCL.060 PF evidence.
    showRegulatoryMovements:input.hasAircraft&&["AEROPLANE","HELICOPTER"].includes(regulatoryCategory)&&evidence==="EASA",
  };
}
