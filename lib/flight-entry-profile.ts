export type FlightAircraftCategory="aeroplane"|"ull"|"sailplane"|"other";

export type FlightEntryProfile={
  category:FlightAircraftCategory;
  label:string;
  selected:boolean;
  context:string;
  showStandardExperience:boolean;
  showRegulatoryMovements:boolean;
};

const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const AEROPLANE_CLASSES=new Set(["SEP","TMG","MEP","SET"]);

export function flightAircraftCategory(input:{aircraftClass?:unknown;evidence?:unknown}):FlightAircraftCategory{
  const aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  if(aircraftClass==="GLIDER")return "sailplane";
  if(aircraftClass==="ULL"||evidence==="ULL")return "ull";
  if(AEROPLANE_CLASSES.has(aircraftClass))return "aeroplane";
  return "other";
}

const LABELS:Record<FlightAircraftCategory,string>={aeroplane:"Aeroplane",ull:"ULL",sailplane:"Sailplane",other:"Aircraft"};

export function flightEntryProfile(input:{hasAircraft:boolean;aircraftClass?:unknown;evidence?:unknown}):FlightEntryProfile{
  const category=flightAircraftCategory(input),label=LABELS[category],aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  const context=[label,evidence,aircraftClass].filter((value,index,items)=>Boolean(value)&&items.indexOf(value)===index).join(" · ");
  return {
    category,
    label,
    selected:input.hasAircraft,
    context,
    showStandardExperience:input.hasAircraft,
    // Preserve the existing EASA movement-entry behaviour in v1.61. Category-specific
    // regulatory semantics are intentionally deferred to the category releases.
    showRegulatoryMovements:input.hasAircraft&&evidence==="EASA",
  };
}
