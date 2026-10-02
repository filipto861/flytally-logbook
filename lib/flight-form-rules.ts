import { validateAircraftProfile,type CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";

export type FlightEntryAircraftProfileInput={
  aircraft_make?:unknown;
  aircraft_model?:unknown;
  evidence?:unknown;
  aircraft_class?:unknown;
  regulatory_category?:unknown;
  balloon_class?:unknown;
  balloon_group?:unknown;
  part_fcl_credit_class?:unknown;
  part_fcl_credit_basis?:unknown;
  part_fcl_credit_from?:unknown;
};

export type FlightEntryAircraftProfileDefaults=
  |{profile:CanonicalAircraftProfileRegulatoryFields;error?:undefined}
  |{profile?:undefined;error:string};

const upper=(value:unknown)=>String(value??"").trim().toUpperCase();

export function normalizeRegistration(value:unknown){return upper(value)}

export function normalizeChoice<T extends readonly string[]>(value:unknown,allowed:T,fallback:""|T[number]=""):string{const normalized=upper(value);return allowed.includes(normalized as T[number])?normalized:String(fallback)}

export function resolveFlightEntryAircraftProfileDefaults(input:FlightEntryAircraftProfileInput):FlightEntryAircraftProfileDefaults{
  const rawEvidence=upper(input.evidence),rawClass=upper(input.aircraft_class);
  const validated=validateAircraftProfile({
    aircraftMake:input.aircraft_make,
    aircraftModel:input.aircraft_model,
    evidence:rawEvidence,
    aircraftClass:rawClass,
    regulatoryCategory:input.regulatory_category,
    balloonClass:input.balloon_class,
    balloonGroup:input.balloon_group,
    partFclCreditClass:input.part_fcl_credit_class,
    partFclCreditBasis:input.part_fcl_credit_basis,
    partFclCreditFrom:input.part_fcl_credit_from,
  });
  if(!validated.profile)return{error:validated.error||"Aircraft profile needs configuration."};
  if(validated.profile.evidence!==rawEvidence||validated.profile.aircraftClass!==rawClass){
    return{error:"Aircraft profile needs configuration before its logbook and class defaults can be applied."};
  }
  return{profile:validated.profile};
}

export function shouldApplyAircraftProfileDefaults(editing:boolean,initialRegistration:unknown,nextRegistration:unknown){
  return !editing||normalizeRegistration(initialRegistration)!==normalizeRegistration(nextRegistration);
}
