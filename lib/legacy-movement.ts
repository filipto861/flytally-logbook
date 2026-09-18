export type MovementCompatibilityInput={
  evidence:unknown;
  movementEvidenceRecorded:unknown;
  legacyMovementCandidate:unknown;
  starts?:unknown;
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
  ullMovementInferred:boolean;
};

const count=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const enabled=(value:unknown)=>typeof value==="boolean"?value:["1","true","yes","on"].includes(String(value??"").trim().toLowerCase());
const evidence=(value:unknown)=>String(value??"").trim().toUpperCase();

/**
 * Preserve structured movement evidence exactly. For certified EASA flights that
 * pre-date the structured PF counters, conservatively reconstruct one take-off
 * and one approach for each historically recorded landing. ULL records historically
 * stored native starts and landings instead of FCL.060 PF counters; when both exist,
 * they provide a conservative total-movement compatibility record. Night PF counters
 * are never inferred from native ULL totals. A structured-era EASA record with PF
 * movement evidence explicitly left off is never inferred.
 */
export function resolveMovementCompatibility(input:MovementCompatibilityInput):MovementCompatibilityResult{
  const explicit=enabled(input.movementEvidenceRecorded),takeoffsDay=count(input.takeoffsDay),takeoffsNight=count(input.takeoffsNight),approachesDay=count(input.approachesDay),approachesNight=count(input.approachesNight);
  if(explicit)return{movementEvidenceRecorded:true,takeoffsDay,takeoffsNight,approachesDay,approachesNight,legacyMovementInferred:false,ullMovementInferred:false};

  const landingsDay=count(input.landingsDay),landingsNight=count(input.landingsNight),landingTotal=landingsDay+landingsNight,source=evidence(input.evidence);
  if(source==="ULL"){
    const starts=count(input.starts),usable=starts>0&&landingTotal>0;
    return{movementEvidenceRecorded:usable,takeoffsDay:usable?starts:0,takeoffsNight:0,approachesDay:usable?landingTotal:0,approachesNight:0,legacyMovementInferred:false,ullMovementInferred:usable};
  }

  const legacy=enabled(input.legacyMovementCandidate)&&source==="EASA"&&landingTotal>0;
  if(!legacy)return{movementEvidenceRecorded:false,takeoffsDay,takeoffsNight,approachesDay,approachesNight,legacyMovementInferred:false,ullMovementInferred:false};

  return{movementEvidenceRecorded:true,takeoffsDay:landingsDay,takeoffsNight:landingsNight,approachesDay:landingsDay,approachesNight:landingsNight,legacyMovementInferred:true,ullMovementInferred:false};
}
