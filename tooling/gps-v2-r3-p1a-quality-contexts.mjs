#!/usr/bin/env node
/**
 * OWNER-LOCAL ONLY: R3 P1A quality-context counts. Neither contact nor events.
 * In-memory source-local indexes are NOT output. No raw track or path in errors.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {parseKml} from "../lib/track-processing.ts";
import {R3_P1A_REVISION,R3_P1A_FROZEN_LEGACY_REFERENCE,inspectR3P1AQualityContexts} from
 "../research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts";
import {inspectD43R2LegacyShapeAudit} from
 "../research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts";
function unavailable(reason){
 process.stdout.write(JSON.stringify({
  status:"UNAVAILABLE",reason,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false,
 })+"\n");
 process.exitCode=2;
}
const args=process.argv.slice(2),n=args.length;
if((n!==4&&n!==6)||args[0]!=="--file"||args[2]!=="--id"||
 !args[1]||!/^sample\d{2,3}$/.test(args[3])||
 (n===6&&(args[4]!=="--cuts"||!/^[1-9]\d*(?:,[1-9]\d*){0,18}$/.test(args[5]))))
 unavailable("INVALID_CONTEXT");
else if(extname(args[1]).toLowerCase()!==".kml")
 unavailable("UNSUPPORTED_SOURCE");
else{
 try{
  if(statSync(args[1]).size>2_000_000)unavailable("SOURCE_LIMIT");
  else{
   const sourceText=readFileSync(args[1],"utf8");
   const splitCuts=n===6?args[5].split(",").map(Number):[];
   const result=inspectR3P1AQualityContexts({
    sourceText,canonicalPoints:parseKml(sourceText),
    splitCuts,expectedRevision:R3_P1A_REVISION,
   });
   if(result.status==="UNAVAILABLE")unavailable(result.reason);
   else{
    const legacy=inspectD43R2LegacyShapeAudit({sourceText,splitCuts});
    if(legacy.status!=="LEGACY_SOURCE_SHAPE_COMPARISON_ONLY"||
       legacy.legacyReference!==R3_P1A_FROZEN_LEGACY_REFERENCE)
     unavailable("FROZEN_REFERENCE_UNAVAILABLE");
    else{
     const windows=result.contexts.reduce((n,c)=>n+c.affectedGeometryWindows,0);
     if(windows!==legacy.comparison.inSpanDerivativeRejectedWindows)
      unavailable("FROZEN_REJECTION_COUNT_PARITY_MISMATCH");
     else process.stdout.write(JSON.stringify({
      sample:args[3],status:result.status,
      revision:result.revision,
      sourceQualityContexts:result.contexts.length,
      frozenLegacyRejectedGeometryWindows:legacy.comparison.inSpanDerivativeRejectedWindows,
      sharedEdgeWindows:windows,
      longIntervalContextCount:result.contexts.filter(
       c=>c.coverage==="LONG_INTERVALS_UNASSESSED").length,
      referenceStatus:"FROZEN_REJECTION_COUNT_PARITY_VERIFIED",
      contact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
      canAffectCanonicalFlight:false,
     },null,2)+"\n");
    }
   }
  }
 }catch{
  unavailable("LOCAL_SOURCE_UNREADABLE");
 }
}
