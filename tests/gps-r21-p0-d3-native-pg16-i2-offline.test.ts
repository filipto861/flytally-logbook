import test from "node:test";
import assert from "node:assert/strict";
import {
 validateOfflineWindowsEvidence,evaluateOfflineStopEvidence,refuseNativeRuntime
} from "../research/gps-r21-p0-d3-synthetic-security/native-pg16-i2-offline.mjs";
const profile=String.raw`C:\Users\owner`;
const root=profile+String.raw`\AppData\Local\FlyTallySyntheticPG16`;
const run=root+String.raw`\flytally-r21-123e4567-e89b-42d3-a456-426614174000`;
const pgdata=run+String.raw`\pgdata`;
const names=["initdb","pg_ctl","psql","postgres","pg_controldata"];
const checked=[profile,profile+String.raw`\AppData`,profile+String.raw`\AppData\Local`,root,run,pgdata];
const good=()=>({
 collector:"independent-windows-adapter",
 collectionMode:"read-only",
 captureId:"a".repeat(32),
 processToken:{elevation:"not-elevated",isAdminEffective:false,identityVerified:true},
 binaryFiles:names.map(name=>({name,version:"16.15",absolutePathVerified:true,isTrustedFile:true})),
 serviceExclusion:{pg16Running:true,pg18Running:true,noExistingServiceTargetConfirmed:true},
 paths:{root,runDir:run,pgdata,ownerProfile:profile,
  entries:checked.map(path=>({path,exists:true,isReparsePoint:false,aclTrusted:true,trustedOwner:true}))}
});
test("I2-A refuses incomplete/unverified Windows evidence",()=>{
 const x=good();
 assert.equal(validateOfflineWindowsEvidence(x).ok,true);
 for(const key of ["collector","captureId","processToken","binaryFiles","serviceExclusion","paths"]){
   const y:any=structuredClone(x);delete y[key];
   assert.equal(validateOfflineWindowsEvidence(y).ok,false,key);
 }
});
test("I2-A rejects elevated token and incomplete independent OS assertions",()=>{
 const x=good();
 for(const mutation of [
  (y:any)=>y.processToken.elevation="elevated",
  (y:any)=>y.processToken.isAdminEffective=true,
  (y:any)=>y.processToken.identityVerified=false,
  (y:any)=>y.serviceExclusion.noExistingServiceTargetConfirmed=false,
  (y:any)=>y.binaryFiles[0].version="18.1",
  (y:any)=>y.binaryFiles[0].absolutePathVerified=false,
  (y:any)=>y.paths.entries[1].isReparsePoint=true,
  (y:any)=>y.paths.entries[2].aclTrusted=false
 ]){
   const y:any=structuredClone(x);mutation(y);
   assert.equal(validateOfflineWindowsEvidence(y).ok,false);
 }
});
test("I2-A evidence never grants native runtime, stop or deletion",()=>{
 const accepted=validateOfflineWindowsEvidence(good());
 assert.equal(accepted.permitsRuntime,false);
 assert.deepEqual(evaluateOfflineStopEvidence({}),{ok:false,permitsStop:false,permitsDelete:false});
 assert.throws(refuseNativeRuntime,/unavailable/);
});
