export type MovementCompatibilityInput={
  evidence:unknown;
  movementEvidenceRecorded:unknown;
  legacyMovementCandidate:unknown;
  landingsDay:unknown;
  landingsNight:unknown;
  takeoffsDay:unknown;
  takeoffsNight:unknown;
  approachesDay:unknown;
  approachesNight:unknown;
};

export type MovementCompatibilityResult={
  movementEvidenceRecorded:boolean;
  takeoffsDay:number;
  takeoffsNight:number;
  approachesDay:number;
  approachesNight:number;
  legacyMovementInferred:boolean;
};

const count=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const enabled=(value:unknown)=>typeof value==="boolean"?value:["1","true","yes","on"].includes(String(value??"").trim().toLowerCase());
const evidence=(value:unknown)=>String(value??"").trim().toUpperCase();

/**
 * Preserve structured movement evidence exactly. For certified EASA flights that
 * pre-date the structured PF counters, conservatively reconstruct one take-off
 * and one approach for each historically recorded landing. A structured-era
 * record with movement evidence explicitly left off is never inferred.
 */
export function resolveMovementCompatibility(input:MovementCompatibilityInput):MovementCompatibilityResult{
  const explicit=enabled(input.movementEvidenceRecorded),takeoffsDay=count(input.takeoffsDay),takeoffsNight=count(input.takeoffsNight),approachesDay=count(input.approachesDay),approachesNight=count(input.approachesNight);
  if(explicit)return{movementEvidenceRecorded:true,takeoffsDay,takeoffsNight,approachesDay,approachesNight,legacyMovementInferred:false};

  const landingsDay=count(input.landingsDay),landingsNight=count(input.landingsNight),legacy=enabled(input.legacyMovementCandidate)&&evidence(input.evidence)==="EASA"&&(landingsDay+landingsNight)>0;
  if(!legacy)return{movementEvidenceRecorded:false,takeoffsDay,takeoffsNight,approachesDay,approachesNight,legacyMovementInferred:false};

  return{movementEvidenceRecorded:true,takeoffsDay:landingsDay,takeoffsNight:landingsNight,approachesDay:landingsDay,approachesNight:landingsNight,legacyMovementInferred:true};
}
