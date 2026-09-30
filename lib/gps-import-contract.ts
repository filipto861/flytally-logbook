import { resolveFlightEntryAircraftProfileDefaults,type FlightEntryAircraftProfileInput } from "./flight-form-rules.ts";
import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";

export const GPS_IMPORT_SUPPORTED_ROLES=["PIC"] as const;
export type GpsImportSupportedRole=(typeof GPS_IMPORT_SUPPORTED_ROLES)[number];

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();

export type GpsImportAircraftContextResult=
  |{profile:CanonicalAircraftProfileRegulatoryFields;error?:undefined}
  |{profile?:undefined;error:string};

export function resolveGpsImportAircraftContext(input:FlightEntryAircraftProfileInput):GpsImportAircraftContextResult{
  const resolved=resolveFlightEntryAircraftProfileDefaults(input);
  if(!resolved.profile)return{error:resolved.error||"Aircraft profile needs configuration before GPS import."};
  return{profile:resolved.profile};
}

export function parseGpsImportRole(value:unknown):{role:GpsImportSupportedRole;error?:undefined}|{role?:undefined;error:string}{
  const role=upper(value);
  if(role==="PIC")return{role:"PIC"};
  return{error:"GPS import currently supports PIC only. Use Manual entry for other roles."};
}
