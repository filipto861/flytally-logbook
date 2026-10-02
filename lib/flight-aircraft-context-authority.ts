import {
  validateAircraftProfile,
  type AircraftBalloonClass,
  type AircraftBalloonGroup,
  type CanonicalAircraftProfileRegulatoryFields,
} from "./aircraft-profile-validation.ts";
import { normalizeAircraftProfileContext,type AircraftProfileClass,type AircraftRegulatoryCategory } from "./aircraft-profile-context.ts";

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
  const validated=validateAircraftProfile({
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

export function isUnchangedSnapshotSubmission(
  stored:FlightAircraftContextSnapshotInput,
  submitted:FlightAircraftContextSnapshotInput,
){
  if(sameFlightAircraftContextSnapshot(stored,submitted))return true;
  const storedSnapshot=normalizeFlightAircraftContextSnapshot(stored);
  if(storedSnapshot.regulatoryCategory)return false;
  const submittedSnapshot=normalizeFlightAircraftContextSnapshot(submitted);
  if(storedSnapshot.evidence!==submittedSnapshot.evidence
    ||storedSnapshot.aircraftClass!==submittedSnapshot.aircraftClass
    ||storedSnapshot.balloonClass!==submittedSnapshot.balloonClass
    ||storedSnapshot.balloonGroup!==submittedSnapshot.balloonGroup
    ||storedSnapshot.aircraftType!==submittedSnapshot.aircraftType)return false;
  const normalized=normalizeAircraftProfileContext(
    storedSnapshot.evidence,
    storedSnapshot.aircraftClass,
    "",
  );
  return Boolean(normalized.context&&submittedSnapshot.regulatoryCategory===normalized.context.regulatoryCategory);
}

export function validateSnapshotAircraftContextCorrection(
  input:FlightAircraftContextSnapshotInput,
):
  |{context:CanonicalFlightAircraftContext;error?:undefined}
  |{context?:undefined;error:string}{
  const snapshot=normalizeFlightAircraftContextSnapshot(input);
  const normalized=normalizeAircraftProfileContext(
    snapshot.evidence,
    snapshot.aircraftClass,
    snapshot.regulatoryCategory,
  );
  if(!normalized.context)return{error:normalized.error||"Select a valid aircraft context."};
  if(snapshot.regulatoryCategory!==normalized.context.regulatoryCategory){
    return{error:"Aircraft class/category and regulatory context do not match."};
  }
  const regulatoryCategory=normalized.context.regulatoryCategory;
  if(regulatoryCategory!=="BALLOON"){
    if(snapshot.balloonClass||snapshot.balloonGroup){
      return{error:"Balloon class/group can only be stored on a Balloon / Part-BFCL flight context."};
    }
    return{context:{
      evidence:normalized.context.evidence,
      aircraftClass:normalized.context.aircraftClass,
      regulatoryCategory,
      balloonClass:"",
      balloonGroup:"",
      aircraftType:snapshot.aircraftType,
    }};
  }
  if(!AIRCRAFT_BALLOON_CLASSES.includes(snapshot.balloonClass as Exclude<AircraftBalloonClass,"">)){
    return{error:"Select the Part-BFCL balloon class."};
  }
  const balloonClass=snapshot.balloonClass as Exclude<AircraftBalloonClass,"">;
  let balloonGroup:AircraftBalloonGroup="";
  if(balloonClass==="HOT_AIR_BALLOON"){
    if(!AIRCRAFT_BALLOON_GROUPS.includes(snapshot.balloonGroup as Exclude<AircraftBalloonGroup,"">)){
      return{error:"Select hot-air balloon group A, B, C or D."};
    }
    balloonGroup=snapshot.balloonGroup as Exclude<AircraftBalloonGroup,"">;
  }else if(snapshot.balloonGroup){
    return{error:"Hot-air balloon group is not applicable to this balloon class."};
  }
  return{context:{
    evidence:normalized.context.evidence,
    aircraftClass:normalized.context.aircraftClass,
    regulatoryCategory,
    balloonClass,
    balloonGroup,
    aircraftType:snapshot.aircraftType,
  }};
}

export function classifySnapshotAircraftContextChange(
  stored:FlightAircraftContextSnapshotInput,
  submitted:FlightAircraftContextSnapshotInput,
):"UNCHANGED"|"CHANGED"{
  return sameFlightAircraftContextSnapshot(stored,submitted)?"UNCHANGED":"CHANGED";
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
