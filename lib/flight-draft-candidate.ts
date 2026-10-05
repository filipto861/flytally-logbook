import type { CanonicalAircraftProfileRegulatoryFields } from "./aircraft-profile-validation.ts";
import { gpsImportSourceRequirements } from "./gps-import-integrity.ts";

export const FLIGHT_DRAFT_SOURCES=["MANUAL","GPS_REVIEW"] as const;
export type FlightDraftSource=(typeof FLIGHT_DRAFT_SOURCES)[number];

export const FLIGHT_DRAFT_PROVENANCE=[
  "PILOT",
  "GPS_REVIEW",
  "AIRCRAFT_PROFILE",
  "COMMON_IMPORT",
  "UNRESOLVED",
] as const;
export type FlightDraftProvenance=(typeof FLIGHT_DRAFT_PROVENANCE)[number];

export type CandidateSemantic<T=unknown>=
  |{state:"provided";value:T;provenance:FlightDraftProvenance}
  |{state:"unresolved";reason:string;provenance:"UNRESOLVED"};

export type CandidateAircraftContext=
  |{
    state:"provided";
    evidence:unknown;
    aircraftClass:unknown;
    regulatoryCategory:unknown;
    balloonClass:unknown;
    balloonGroup:unknown;
    provenance:FlightDraftProvenance;
  }
  |{state:"unresolved";reason:string;provenance:"UNRESOLVED"};

export type FlightDraftCandidate={
  source:FlightDraftSource;
  date:unknown;
  registration:unknown;
  aircraftType:unknown;
  aircraftContext:CandidateAircraftContext;
  departure:unknown;
  arrival:unknown;
  offBlock:unknown;
  takeoff:unknown;
  landing:unknown;
  onBlock:unknown;
  starts:unknown;
  landingsDay:unknown;
  landingsNight:unknown;
  hasStructuredLandings:boolean;
  launches:unknown;
  launchMethod:unknown;
  hasLaunches:boolean;
  balloonOperation:unknown;
  movementEvidenceRecorded:unknown;
  takeoffsDay:unknown;
  takeoffsNight:unknown;
  approachesDay:unknown;
  approachesNight:unknown;
  operationType:CandidateSemantic;
  engineType:CandidateSemantic;
  operatorName:unknown;
  flightNumber:unknown;
  operationContext:unknown;
  nightTime:unknown;
  ifrTime:unknown;
  role:unknown;
  commander:unknown;
  instructor:unknown;
  verificationName:unknown;
  verificationReference:unknown;
  task:unknown;
  purposeCodes:unknown[];
  existingPurposeCodes:unknown[];
  purposeSelectionPresent:boolean;
  billingBasis:unknown;
  billingShare:unknown;
  note:unknown;
  provenance:{
    identity:FlightDraftProvenance;
    aircraftContext:FlightDraftProvenance;
    route:FlightDraftProvenance;
    timeline:FlightDraftProvenance;
    movements:FlightDraftProvenance;
    role:FlightDraftProvenance;
    operation:FlightDraftProvenance;
    engine:FlightDraftProvenance;
    billing:FlightDraftProvenance;
    task:FlightDraftProvenance;
    note:FlightDraftProvenance;
  };
};

const provided=(value:unknown,provenance:FlightDraftProvenance):CandidateSemantic=>({state:"provided",value,provenance});
const unresolved=(reason:string):CandidateSemantic=>({state:"unresolved",reason,provenance:"UNRESOLVED"});
const formValue=(form:FormData,name:string)=>form.get(name)??"";

export function manualFlightCandidate(form:FormData,existingPurposeCodes:unknown[]=[]):FlightDraftCandidate{
  return{
    source:"MANUAL",
    date:formValue(form,"date"),
    registration:formValue(form,"registration"),
    aircraftType:formValue(form,"aircraftType"),
    aircraftContext:{
      state:"provided",
      evidence:formValue(form,"evidence"),
      aircraftClass:formValue(form,"aircraftClass"),
      regulatoryCategory:formValue(form,"regulatoryCategory"),
      balloonClass:formValue(form,"balloonClass"),
      balloonGroup:formValue(form,"balloonGroup"),
      provenance:"PILOT",
    },
    departure:formValue(form,"departure"),
    arrival:formValue(form,"arrival"),
    offBlock:formValue(form,"offBlock"),
    takeoff:formValue(form,"takeoff"),
    landing:formValue(form,"landing"),
    onBlock:formValue(form,"onBlock"),
    starts:formValue(form,"starts"),
    landingsDay:formValue(form,"landingsDay"),
    landingsNight:formValue(form,"landingsNight"),
    hasStructuredLandings:form.has("landingsDay")||form.has("landingsNight"),
    launches:formValue(form,"launches"),
    launchMethod:formValue(form,"launchMethod"),
    hasLaunches:form.has("launches"),
    balloonOperation:formValue(form,"balloonOperation"),
    movementEvidenceRecorded:formValue(form,"movementEvidenceRecorded"),
    takeoffsDay:formValue(form,"takeoffsDay"),
    takeoffsNight:formValue(form,"takeoffsNight"),
    approachesDay:formValue(form,"approachesDay"),
    approachesNight:formValue(form,"approachesNight"),
    operationType:provided(formValue(form,"operationType"),"PILOT"),
    engineType:provided(formValue(form,"engineType"),"PILOT"),
    operatorName:formValue(form,"operatorName"),
    flightNumber:formValue(form,"flightNumber"),
    operationContext:formValue(form,"operationContext"),
    nightTime:formValue(form,"nightTime"),
    ifrTime:formValue(form,"ifrTime"),
    role:formValue(form,"role"),
    commander:formValue(form,"commander"),
    instructor:formValue(form,"instructor"),
    verificationName:formValue(form,"verificationName"),
    verificationReference:formValue(form,"verificationReference"),
    task:formValue(form,"task"),
    purposeCodes:form.getAll("purposeCode"),
    existingPurposeCodes,
    purposeSelectionPresent:form.has("purposeSelectionPresent")||form.has("purposeCode"),
    billingBasis:formValue(form,"billingBasis"),
    billingShare:formValue(form,"billingShare"),
    note:formValue(form,"note"),
    provenance:{
      identity:"PILOT",
      aircraftContext:"PILOT",
      route:"PILOT",
      timeline:"PILOT",
      movements:"PILOT",
      role:"PILOT",
      operation:"PILOT",
      engine:"PILOT",
      billing:"PILOT",
      task:"PILOT",
      note:"PILOT",
    },
  };
}

export type GpsReviewedPartCandidateInput={
  date:unknown;
  departure:unknown;
  arrival:unknown;
  offBlock:unknown;
  takeoff:unknown;
  landing:unknown;
  onBlock:unknown;
  starts:unknown;
  takeoffs?:unknown;
  landingsDay?:unknown;
  landingsNight?:unknown;
  movementEvidenceRecorded?:unknown;
  takeoffsDay?:unknown;
  takeoffsNight?:unknown;
  approachesDay?:unknown;
  approachesNight?:unknown;
  launchMethod?:unknown;
  launches?:unknown;
  nightTime?:unknown;
  ifrTime?:unknown;
  note?:unknown;
};

export type GpsFlightCandidateInput={
  registration:unknown;
  aircraftType:unknown;
  profile?:CanonicalAircraftProfileRegulatoryFields;
  profileError?:string;
  role:unknown;
  commander?:unknown;
  instructor?:unknown;
  verificationName?:unknown;
  verificationReference?:unknown;
  billingBasis:unknown;
  billingShare:unknown;
  task:unknown;
  balloonOperation?:unknown;
  reviewedPart:GpsReviewedPartCandidateInput;
  operationType?:unknown;
  engineType?:unknown;
};

export function gpsFlightCandidate(input:GpsFlightCandidateInput):FlightDraftCandidate{
  const profile=input.profile;
  const aircraftContext:CandidateAircraftContext=profile?{
    state:"provided",
    evidence:profile.evidence,
    aircraftClass:profile.aircraftClass,
    regulatoryCategory:profile.regulatoryCategory,
    balloonClass:profile.balloonClass,
    balloonGroup:profile.balloonGroup,
    provenance:"AIRCRAFT_PROFILE",
  }:{
    state:"unresolved",
    reason:input.profileError||"Selected aircraft profile is unresolved.",
    provenance:"UNRESOLVED",
  };
  const hasOperation=String(input.operationType??"").trim()!=="",hasEngine=String(input.engineType??"").trim()!=="",requirements=profile?gpsImportSourceRequirements(profile):null,review=input.reviewedPart,hasLandingEvidence=review.landingsDay!==undefined&&(requirements?.landingMode==="TOTAL"||review.landingsNight!==undefined),hasLaunchEvidence=review.launches!==undefined&&review.launchMethod!==undefined,hasPfDecision=review.movementEvidenceRecorded!==undefined,hasTakeoffEvidence=review.takeoffsDay!==undefined&&review.takeoffsNight!==undefined,hasApproachEvidence=review.approachesDay!==undefined&&review.approachesNight!==undefined,hasNightIfr=review.nightTime!==undefined&&review.ifrTime!==undefined;
  return{
    source:"GPS_REVIEW",
    date:input.reviewedPart.date,
    registration:input.registration,
    aircraftType:input.aircraftType,
    aircraftContext,
    departure:input.reviewedPart.departure,
    arrival:input.reviewedPart.arrival,
    offBlock:input.reviewedPart.offBlock,
    takeoff:input.reviewedPart.takeoff,
    landing:input.reviewedPart.landing,
    onBlock:input.reviewedPart.onBlock,
    starts:input.reviewedPart.starts,
    landingsDay:hasLandingEvidence?provided(review.landingsDay,"GPS_REVIEW"):unresolved("GPS review needs explicit landing evidence."),
    landingsNight:hasLandingEvidence?provided(requirements?.landingMode==="TOTAL"?0:review.landingsNight,"GPS_REVIEW"):unresolved("GPS review needs explicit day/night landing evidence."),
    hasStructuredLandings:Boolean(hasLandingEvidence),
    launches:requirements?.movementMode==="SAILPLANE_LAUNCH"?(hasLaunchEvidence?provided(review.launches,"GPS_REVIEW"):unresolved("GPS review needs explicit sailplane launch count.")):0,
    launchMethod:requirements?.movementMode==="SAILPLANE_LAUNCH"?(hasLaunchEvidence?provided(review.launchMethod,"GPS_REVIEW"):unresolved("GPS review needs explicit sailplane launch method.")):"",
    hasLaunches:requirements?.movementMode==="SAILPLANE_LAUNCH"&&hasLaunchEvidence,
    balloonOperation:input.balloonOperation??"",
    movementEvidenceRecorded:requirements?.movementMode==="FCL060_PF"?(hasPfDecision?provided(review.movementEvidenceRecorded,"GPS_REVIEW"):unresolved("GPS review needs an explicit PF movement-evidence decision.")):"",
    takeoffsDay:requirements?.movementMode==="EXPLICIT_TAKEOFFS"||String(review.movementEvidenceRecorded??"")==="yes"?(hasTakeoffEvidence?provided(review.takeoffsDay,"GPS_REVIEW"):unresolved("GPS review needs explicit day/night take-off evidence.")):0,
    takeoffsNight:requirements?.movementMode==="EXPLICIT_TAKEOFFS"||String(review.movementEvidenceRecorded??"")==="yes"?(hasTakeoffEvidence?provided(review.takeoffsNight,"GPS_REVIEW"):unresolved("GPS review needs explicit day/night take-off evidence.")):0,
    approachesDay:String(review.movementEvidenceRecorded??"")==="yes"?(hasApproachEvidence?provided(review.approachesDay,"GPS_REVIEW"):unresolved("GPS review needs explicit day/night approach evidence.")):0,
    approachesNight:String(review.movementEvidenceRecorded??"")==="yes"?(hasApproachEvidence?provided(review.approachesNight,"GPS_REVIEW"):unresolved("GPS review needs explicit day/night approach evidence.")):0,
    operationType:hasOperation?provided(input.operationType,"COMMON_IMPORT"):unresolved("GPS Operation is not explicitly captured yet."),
    engineType:hasEngine?provided(input.engineType,"COMMON_IMPORT"):unresolved("GPS Engine is not explicitly captured yet."),
    operatorName:"",
    flightNumber:"",
    operationContext:"",
    nightTime:requirements?.reviewNightIfr?(hasNightIfr?provided(review.nightTime,"GPS_REVIEW"):unresolved("GPS review needs explicit Night/IFR review state.")):"",
    ifrTime:requirements?.reviewNightIfr?(hasNightIfr?provided(review.ifrTime,"GPS_REVIEW"):unresolved("GPS review needs explicit Night/IFR review state.")):"",
    role:input.role,
    commander:input.commander??"",
    instructor:input.instructor??"",
    verificationName:input.verificationName??"",
    verificationReference:input.verificationReference??"",
    task:input.task,
    purposeCodes:[],
    existingPurposeCodes:[],
    purposeSelectionPresent:false,
    billingBasis:input.billingBasis,
    billingShare:input.billingShare,
    note:input.reviewedPart.note??"",
    provenance:{
      identity:"COMMON_IMPORT",
      aircraftContext:profile?"AIRCRAFT_PROFILE":"UNRESOLVED",
      route:"GPS_REVIEW",
      timeline:"GPS_REVIEW",
      movements:hasLandingEvidence&&requirements&&(requirements.movementMode==="NONE"||requirements.movementMode==="SAILPLANE_LAUNCH"||requirements.movementMode==="EXPLICIT_TAKEOFFS"&&hasTakeoffEvidence||requirements.movementMode==="FCL060_PF"&&hasPfDecision&&String(review.movementEvidenceRecorded??"")!=="yes"||requirements.movementMode==="FCL060_PF"&&hasPfDecision&&hasTakeoffEvidence&&hasApproachEvidence)?"GPS_REVIEW":"UNRESOLVED",
      role:"COMMON_IMPORT",
      operation:hasOperation?"COMMON_IMPORT":"UNRESOLVED",
      engine:hasEngine?"COMMON_IMPORT":"UNRESOLVED",
      billing:"COMMON_IMPORT",
      task:"COMMON_IMPORT",
      note:"GPS_REVIEW",
    },
  };
}

export function candidateSemanticValue(value:CandidateSemantic):unknown{
  return value.state==="provided"?value.value:undefined;
}
