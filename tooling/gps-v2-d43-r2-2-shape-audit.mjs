#!/usr/bin/env node
/**
 * Owner-local only. Aggregate frozen legacy source-shape audit; not a detector.
 * Never prints source path/filename, GPS route, UTC, altitude, identity, raw
 * track, per-fix indices, source hash, exception, or alleged contacts.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {inspectD43R2LegacyShapeAudit} from
 "../research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts";
function unavailable(reason){
 process.stdout.write(JSON.stringify({
  status:"UNAVAILABLE",reason,physicalContact:"UNRESOLVED",
  actualLandings:"UNAVAILABLE",recencyEvidence:"UNAVAILABLE",
  canAffectCanonicalFlight:false,
 })+"\n");
 process.exitCode=2;
}
const args=process.argv.slice(2),n=args.length;
if((n!==4&&n!==6)||args[0]!=="--file"||args[2]!=="--id"||
   !args[1]||!/^sample\d{2,3}$/.test(args[3])||
   (n===6&&(
    args[4]!=="--cuts"||!/^[1-9]\d*(?:,[1-9]\d*){0,18}$/.test(args[5])
   ))){
 unavailable("INVALID_CONTEXT");
}else if(extname(args[1]).toLowerCase()!==".kml"){
 unavailable("UNSUPPORTED_SOURCE");
}else{
 try{
  if(statSync(args[1]).size>2_000_000)unavailable("SOURCE_LIMIT");
  else{
   const cuts=n===6?args[5].split(",").map(Number):[];
   const result=inspectD43R2LegacyShapeAudit({
    sourceText:readFileSync(args[1],"utf8"),splitCuts:cuts,
   });
   if(result.status==="UNAVAILABLE")unavailable(result.reason);
   else process.stdout.write(JSON.stringify({
    sample:args[3],status:result.status,revision:result.revision,
    legacyReference:result.legacyReference,
    sourceQualityRevision:result.sourceQualityRevision,
    ...result.comparison,
    physicalContact:result.physicalContact,actualLandings:result.actualLandings,
    recencyEvidence:result.recencyEvidence,
    canAffectCanonicalFlight:result.canAffectCanonicalFlight,
   },null,2)+"\n");
  }
 }catch{
  unavailable("LOCAL_SOURCE_UNREADABLE");
 }
}
