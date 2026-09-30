import { resolveFlightEntryAircraftProfileDefaults,type FlightEntryAircraftProfileInput } from "./flight-form-rules.ts";
import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";

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
