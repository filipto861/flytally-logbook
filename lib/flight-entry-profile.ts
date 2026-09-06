import {
  aircraftCategoryCapabilities,
  resolveRegulatoryAircraftCategory,
  type FlightAircraftCategory,
  type RegulatoryAircraftCategory,
} from "./aircraft-category.ts";

export type {FlightAircraftCategory,RegulatoryAircraftCategory} from "./aircraft-category.ts";

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

export function regulatoryAircraftCategory(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):RegulatoryAircraftCategory{
  return resolveRegulatoryAircraftCategory(input);
}

export function flightAircraftCategory(input:{regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):FlightAircraftCategory{
  return aircraftCategoryCapabilities(input).category;
}

export function flightEntryProfile(input:{hasAircraft:boolean;regulatoryCategory?:unknown;aircraftClass?:unknown;evidence?:unknown}):FlightEntryProfile{
  const capabilities=aircraftCategoryCapabilities(input);
  const aircraftClass=clean(input.aircraftClass),evidence=clean(input.evidence);
  const context=[capabilities.label,evidence,aircraftClass].filter((value,index,items)=>Boolean(value)&&items.indexOf(value)===index).join(" · ");
  return {
    category:capabilities.category,
    regulatoryCategory:capabilities.regulatoryCategory,
    label:capabilities.label,
    selected:input.hasAircraft,
    context,
    isTmg:capabilities.isTmg,
    showStandardExperience:input.hasAircraft&&capabilities.timeEntryMode==="STANDARD",
    showSailplaneExperience:input.hasAircraft&&capabilities.timeEntryMode==="SAILPLANE_LAUNCH",
    showRegulatoryMovements:input.hasAircraft&&capabilities.supportsFcl060MovementEvidence,
  };
}
