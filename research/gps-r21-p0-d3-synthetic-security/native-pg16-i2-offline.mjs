/**
 * I2-A: offline-only trust boundary for independently captured Windows metadata.
 * No OS calls, disk writes, process spawning, sockets, or SQL.
 * Caller-supplied claims are NOT independently verified and must never authorize
 * starting/stopping PostgreSQL. This module is a contract, not an OS adapter.
 */
import {validateNativeRunPaths,validateOwnedPostmaster,validateRunOwnershipForCleanup}
  from "./native-pg16-guards.mjs";

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export const REQUIRED_OS_EVIDENCE=[
  "collector","collectionMode","processToken","paths","binaryFiles",
  "serviceExclusion","captureId"
];

export function validateOfflineWindowsEvidence(e){
  if(!e||typeof e!=="object"||Array.isArray(e))return {ok:false,reason:"missing-evidence"};
  if(REQUIRED_OS_EVIDENCE.some(k=>!own(e,k)))return {ok:false,reason:"incomplete-evidence"};
  if(e.collector!=="independent-windows-adapter"||
     e.collectionMode!=="read-only"||
     typeof e.captureId!=="string"||!/^[0-9a-f]{32,}$/i.test(e.captureId))
    return {ok:false,reason:"untrusted-provenance"};
  const token=e.processToken;
  if(!token||token.elevation!=="not-elevated"||token.isAdminEffective!==false||
     token.identityVerified!==true)return {ok:false,reason:"token-unverified"};
  if(!Array.isArray(e.binaryFiles)||e.binaryFiles.length!==5||
     !["initdb","pg_ctl","psql","postgres","pg_controldata"].every(n=>
       e.binaryFiles.some(b=>b?.name===n&&b?.version==="16.15"&&b?.absolutePathVerified===true&&b?.isTrustedFile===true)))
    return {ok:false,reason:"binaries-unverified"};
  const services=e.serviceExclusion;
  if(!services||services.pg16Running!==true||services.pg18Running!==true||
     services.noExistingServiceTargetConfirmed!==true)
    return {ok:false,reason:"service-isolation-unverified"};
  if(!validateNativeRunPaths(e.paths))return {ok:false,reason:"paths-unverified"};
  // Even a successful result is only consistency of caller-supplied facts.
  return {ok:true,reason:"offline-contract-only",permitsRuntime:false};
}

export function evaluateOfflineStopEvidence(e){
  if(!e||e.collectionMode!=="read-only"||
     e.processIndependentlyVerified!==true||
     !validateOwnedPostmaster(e.postmaster||{})||
     !validateRunOwnershipForCleanup(e.cleanup||{}))
    return {ok:false,permitsStop:false,permitsDelete:false};
  return {ok:true,permitsStop:false,permitsDelete:false};
}

export function refuseNativeRuntime(){
  throw new Error("I2-A offline contract only; native cluster runtime and teardown are unavailable.");
}
