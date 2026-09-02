export const AIRCRAFT_PROFILE_CLASSES=["SEP","TMG","MEP","SET","OTHER","GLIDER"] as const;
export type AircraftProfileClass=(typeof AIRCRAFT_PROFILE_CLASSES)[number]|"ULL";
export type AircraftRegulatoryCategory="AEROPLANE"|"SAILPLANE"|"ULL"|"OTHER";

const upper=(value:string)=>String(value??"").trim().toUpperCase();

export function aircraftProfileRegulatoryCategory(evidenceInput:string,aircraftClassInput:string,currentInput=""):AircraftRegulatoryCategory{
  const evidence=upper(evidenceInput),aircraftClass=upper(aircraftClassInput),current=upper(currentInput);
  if(evidence==="ULL")return "ULL";
  if(aircraftClass==="GLIDER")return "SAILPLANE";
  if(["SEP","MEP","SET"].includes(aircraftClass))return "AEROPLANE";
  if(aircraftClass==="TMG")return current==="SAILPLANE"?"SAILPLANE":"AEROPLANE";
  if(aircraftClass==="OTHER"&&["AEROPLANE","SAILPLANE","OTHER"].includes(current))return current as AircraftRegulatoryCategory;
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
  if(!AIRCRAFT_PROFILE_CLASSES.includes(aircraftClass as (typeof AIRCRAFT_PROFILE_CLASSES)[number]))return{error:"Select a valid EASA aircraft class."};
  return{context:{evidence:"EASA",aircraftClass:aircraftClass as AircraftProfileClass,regulatoryCategory:aircraftProfileRegulatoryCategory("EASA",aircraftClass,regulatoryCategoryInput)}};
}
