import {
  EASA_AIRCRAFT_PROFILE_CLASSES,
  explicitRegulatoryAircraftCategory,
  type EasaAircraftProfileClass,
  type RegulatoryAircraftCategory,
} from "./aircraft-category.ts";

export const AIRCRAFT_PROFILE_CLASSES=EASA_AIRCRAFT_PROFILE_CLASSES;
export type AircraftProfileClass=EasaAircraftProfileClass|"ULL";
export type AircraftRegulatoryCategory=RegulatoryAircraftCategory;

const upper=(value:string)=>String(value??"").trim().toUpperCase();

export function aircraftProfileRegulatoryCategory(evidenceInput:string,aircraftClassInput:string,currentInput=""):AircraftRegulatoryCategory{
  const evidence=upper(evidenceInput),aircraftClass=upper(aircraftClassInput),current=explicitRegulatoryAircraftCategory(currentInput);
  if(evidence==="ULL")return "ULL";
  if(aircraftClass==="GLIDER")return "SAILPLANE";
  if(aircraftClass==="HELICOPTER")return "HELICOPTER";
  if(aircraftClass==="BALLOON")return "BALLOON";
  if(["SEP","MEP","SET"].includes(aircraftClass))return "AEROPLANE";
  if(aircraftClass==="TMG")return current==="SAILPLANE"?"SAILPLANE":"AEROPLANE";
  if(aircraftClass==="OTHER"&&current&&["AEROPLANE","SAILPLANE","OTHER"].includes(current))return current;
  return "OTHER";
}

export type NormalizedAircraftProfileContext={
  evidence:"ULL"|"EASA";
  aircraftClass:AircraftProfileClass;
  regulatoryCategory:AircraftRegulatoryCategory;
};

export function normalizeAircraftProfileContext(evidenceInput:string,aircraftClassInput:string,regulatoryCategoryInput=""):{context?:NormalizedAircraftProfileContext;error?:string}{
  const evidence=upper(evidenceInput);
  if(evidence!=="ULL"&&evidence!=="EASA")return{error:"Select a valid normal logbook."};
  if(evidence==="ULL")return{context:{evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"}};
  const aircraftClass=upper(aircraftClassInput);
  if(!AIRCRAFT_PROFILE_CLASSES.includes(aircraftClass as EasaAircraftProfileClass))return{error:"Select a valid EASA aircraft class or category."};
  return{context:{evidence:"EASA",aircraftClass:aircraftClass as AircraftProfileClass,regulatoryCategory:aircraftProfileRegulatoryCategory("EASA",aircraftClass,regulatoryCategoryInput)}};
}
