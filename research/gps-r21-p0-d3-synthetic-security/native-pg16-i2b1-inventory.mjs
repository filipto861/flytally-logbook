/**
 * GPS R2.1b P0-D3 / I2-B1: read-only Windows host inventory contract.
 * Observations MUST NEVER be promoted into runtime, stop, delete or ACL trust.
 * This is not an implementation of the privileged native cluster adapter.
 */
import {ambientConnectionOverrides,validatePg16Versions} from "./native-pg16-guards.mjs";
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fileNames=["initdb","pg_ctl","psql","postgres","pg_controldata"];
const pathKeys=["userProfile","appData","localAppData","candidateRoot"];
const serviceKeys=["postgresql-x64-16","postgresql-x64-18"];

export function validateReadOnlyWindowsInventory(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  if(value.format!=="flytally-i2b1-windows-inventory-v1"||
     value.platform!=="win32"||value.readOnly!==true||
     value.runtimeAuthorization!==false||value.permitsClusterMutation!==false)return false;
  const token=value.effectiveToken;
  if(!token||typeof token!=="object"||typeof token.elevated!=="boolean"||
     token.source!=="WindowsPrincipal.IsInRole"||token.identityAttested!==false)return false;
  if(!value.binVersions||!validatePg16Versions(value.binVersions)||
     Object.keys(value.binVersions).length!==fileNames.length)return false;
  const statuses=value.serviceStatus;
  if(!statuses||typeof statuses!=="object"||Array.isArray(statuses)||
     Object.keys(statuses).length!==serviceKeys.length||
     !serviceKeys.every(k=>own(statuses,k)&&["Running","Stopped","Absent"].includes(statuses[k])))
    return false;
  const paths=value.pathObservations;
  if(!paths||typeof paths!=="object"||Array.isArray(paths)||
     Object.keys(paths).length!==pathKeys.length)return false;
  for(const k of pathKeys){
    const item=paths[k];
    if(!item||typeof item!=="object"||Array.isArray(item)||
       typeof item.exists!=="boolean"||item.aclTrusted!==false)return false;
    if(item.exists){
      if(typeof item.reparsePoint!=="boolean"||item.aclReadable!==true)return false;
    }else{
      if(item.reparsePoint!==null||item.aclReadable!==false)return false;
    }
  }
  return true;
}

export function evaluateReadOnlyInventory(value,environment={}){
  if(ambientConnectionOverrides(environment).length)
    return {accepted:false,reason:"ambient-overrides",permitsRuntime:false};
  if(!validateReadOnlyWindowsInventory(value))
    return {accepted:false,reason:"invalid-observation",permitsRuntime:false};
  if(value.effectiveToken.elevated)
    return {accepted:false,reason:"elevated-process",permitsRuntime:false};
  if(Object.values(value.pathObservations).some(p=>p.exists&&p.reparsePoint))
    return {accepted:false,reason:"reparse-path",permitsRuntime:false};
  return {accepted:true,reason:"read-only-inventory-only",permitsRuntime:false};
}
