import {
  validateStoredAircraftProfile,
  type AircraftBalloonClass,
  type AircraftBalloonGroup,
  type CanonicalAircraftProfileRegulatoryFields,
} from "./aircraft-profile-validation.ts";
import type { AircraftProfileClass,AircraftRegulatoryCategory } from "./aircraft-profile-context.ts";

export type FlightAircraftAuthorityProfileInput={
  aircraft_type?:unknown;
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

export type CanonicalFlightAircraftContext={
  evidence:"ULL"|"EASA";
  aircraftClass:AircraftProfileClass;
  regulatoryCategory:AircraftRegulatoryCategory;
  balloonClass:AircraftBalloonClass;
  balloonGroup:AircraftBalloonGroup;
  aircraftType:string;
};

export type FlightAircraftContextSnapshotInput={
  evidence?:unknown;
  aircraftClass?:unknown;
  regulatoryCategory?:unknown;
  balloonClass?:unknown;
  balloonGroup?:unknown;
  aircraftType?:unknown;
};

export type FlightAircraftContextSnapshot={
  evidence:string;
  aircraftClass:string;
  regulatoryCategory:string;
  balloonClass:string;
  balloonGroup:string;
  aircraftType:string;
};

export type FlightAircraftContextAuthority="PROFILE"|"SNAPSHOT";

export type AllowedFlightContextsResult=
  |{profile:CanonicalAircraftProfileRegulatoryFields;contexts:CanonicalFlightAircraftContext[];error?:undefined}
  |{profile?:undefined;contexts?:undefined;error:string};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const normalizedRegistration=(value:unknown)=>upper(value);

function contextFor(
  profile:CanonicalAircraftProfileRegulatoryFields,
  aircraftType:string,
  regulatoryCategory:AircraftRegulatoryCategory,
):CanonicalFlightAircraftContext{
  return{
    evidence:profile.evidence,
    aircraftClass:profile.aircraftClass,
    regulatoryCategory,
    balloonClass:profile.balloonClass,
    balloonGroup:profile.balloonGroup,
    aircraftType,
  };
}

function orderedCategories(profile:CanonicalAircraftProfileRegulatoryFields):AircraftRegulatoryCategory[]{
  if(profile.aircraftClass==="TMG"){
    return[
      profile.regulatoryCategory,
      ...(["AEROPLANE","SAILPLANE"] as const).filter(category=>category!==profile.regulatoryCategory),
    ];
  }
  if(profile.aircraftClass==="OTHER"){
    return[
      profile.regulatoryCategory,
      ...(["AEROPLANE","SAILPLANE","OTHER"] as const).filter(category=>category!==profile.regulatoryCategory),
    ];
  }
  return[profile.regulatoryCategory];
}

/**
 * Returns every aircraft context a valid profile may legitimately produce for one flight.
 *
 * Evidence, class, balloon class/group and aircraft type stay profile-owned.
 * Only TMG and OTHER may expose more than one regulatory category.
 */
export function allowedFlightContexts(input:FlightAircraftAuthorityProfileInput):AllowedFlightContextsResult{
  const validated=validateStoredAircraftProfile({
    aircraftMake:input.aircraft_make,
    aircraftModel:input.aircraft_model,
    evidence:input.evidence,
    aircraftClass:input.aircraft_class,
    regulatoryCategory:input.regulatory_category,
    balloonClass:input.balloon_class,
    balloonGroup:input.balloon_group,
    partFclCreditClass:input.part_fcl_credit_class,
    partFclCreditBasis:input.part_fcl_credit_basis,
    partFclCreditFrom:input.part_fcl_credit_from,
  });
  if(!validated.profile)return{error:validated.error||"Aircraft profile needs configuration."};

  const aircraftType=text(input.aircraft_type).slice(0,80);
  return{
    profile:validated.profile,
    contexts:orderedCategories(validated.profile).map(category=>contextFor(validated.profile,aircraftType,category)),
  };
}

/**
 * Normalizes a persisted/submitted context only for semantic comparison.
 *
 * It deliberately does not validate or derive missing historical values. In particular,
 * a legacy blank regulatory category remains blank so unchanged SNAPSHOT rows can pass
 * through without being rewritten by today's rules.
 */
export function normalizeFlightAircraftContextSnapshot(input:FlightAircraftContextSnapshotInput):FlightAircraftContextSnapshot{
  return{
    evidence:upper(input.evidence),
    aircraftClass:upper(input.aircraftClass),
    regulatoryCategory:upper(input.regulatoryCategory),
    balloonClass:upper(input.balloonClass),
    balloonGroup:upper(input.balloonGroup),
    aircraftType:text(input.aircraftType).slice(0,80),
  };
}

export function sameFlightAircraftContextSnapshot(
  left:FlightAircraftContextSnapshotInput,
  right:FlightAircraftContextSnapshotInput,
){
  const a=normalizeFlightAircraftContextSnapshot(left),b=normalizeFlightAircraftContextSnapshot(right);
  return a.evidence===b.evidence
    &&a.aircraftClass===b.aircraftClass
    &&a.regulatoryCategory===b.regulatoryCategory
    &&a.balloonClass===b.balloonClass
    &&a.balloonGroup===b.balloonGroup
    &&a.aircraftType===b.aircraftType;
}

export function isAllowedFlightContext(
  submitted:FlightAircraftContextSnapshotInput,
  allowed:readonly CanonicalFlightAircraftContext[],
){
  const candidate=normalizeFlightAircraftContextSnapshot(submitted);
  return allowed.some(context=>sameFlightAircraftContextSnapshot(candidate,context));
}

export function classifySnapshotAircraftContextChange(
  stored:FlightAircraftContextSnapshotInput,
  submitted:FlightAircraftContextSnapshotInput,
):"UNCHANGED"|"CHANGED"{
  return sameFlightAircraftContextSnapshot(stored,submitted)?"UNCHANGED":"CHANGED";
}

export type AuthorizedProfileFlightContext=
  |{
    profile:CanonicalAircraftProfileRegulatoryFields;
    context:CanonicalFlightAircraftContext;
    contexts:CanonicalFlightAircraftContext[];
    error?:undefined;
  }
  |{profile?:undefined;context?:undefined;contexts?:undefined;error:string};

/**
 * Applies PROFILE authority to one submitted flight context.
 *
 * The caller owns aircraft lookup/ownership/selectability. This pure boundary only accepts
 * a context that the complete canonical profile can legitimately produce.
 */
export function authorizeProfileFlightContext(
  profileInput:FlightAircraftAuthorityProfileInput,
  submitted:FlightAircraftContextSnapshotInput,
):AuthorizedProfileFlightContext{
  const allowed=allowedFlightContexts(profileInput);
  if(!allowed.profile||!allowed.contexts)return{error:allowed.error||"Aircraft profile needs configuration."};
  const context=allowed.contexts.find(item=>sameFlightAircraftContextSnapshot(item,submitted));
  if(!context)return{error:"Aircraft profile changed or this flight context is no longer available. Reload the form and try again."};
  return{profile:allowed.profile,context,contexts:allowed.contexts};
}

export type AuthorizedUnchangedSnapshotFlightContext=
  |{context:FlightAircraftContextSnapshot;error?:undefined}
  |{context?:undefined;error:string};

/**
 * F3.3 SNAPSHOT gate.
 *
 * Unchanged historical context passes through without today's profile validator. A changed
 * context is deliberately not interpreted as authority; the explicit correction workflow owns it.
 */
export function authorizeUnchangedSnapshotFlightContext(
  stored:FlightAircraftContextSnapshotInput,
  submitted:FlightAircraftContextSnapshotInput,
):AuthorizedUnchangedSnapshotFlightContext{
  if(classifySnapshotAircraftContextChange(stored,submitted)==="CHANGED"){
    return{error:"This edit changes the stored aircraft context. Restore the stored context before saving."};
  }
  return{context:normalizeFlightAircraftContextSnapshot(stored)};
}

/**
 * Authority is derived only from operation type plus stored registration versus the final
 * submitted registration. Intermediate UI selections never grant PROFILE authority.
 */
export function resolveFlightAircraftContextAuthority(input:{
  mode:"CREATE"|"UPDATE";
  storedRegistration?:unknown;
  submittedRegistration?:unknown;
}):{
  authority:FlightAircraftContextAuthority;
  storedRegistration:string;
  submittedRegistration:string;
}{
  const storedRegistration=normalizedRegistration(input.storedRegistration);
  const submittedRegistration=normalizedRegistration(input.submittedRegistration);
  return{
    authority:input.mode==="UPDATE"&&storedRegistration===submittedRegistration?"SNAPSHOT":"PROFILE",
    storedRegistration,
    submittedRegistration,
  };
}
