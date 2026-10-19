#!/usr/bin/env node
/**
 * OWNER-LOCAL and READ-ONLY. Prints aggregate source altitude quality only.
 * Never prints source filename/path, UTC, coordinates, raw altitude values,
 * registration, relative fix indexes, raw exception or local binding hash.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {inspectD43R2AltitudeQuality} from
 "../research/gps-detection-r21/stage-d43-r2-altitude-quality.ts";

function unavailable(reason){
 process.stdout.write(JSON.stringify({
  status:"UNAVAILABLE",reason,physicalContact:"UNRESOLVED",
  actualLandings:"UNAVAILABLE",recencyEvidence:"UNAVAILABLE",
  canAffectCanonicalFlight:false,
 })+"\n");
 process.exitCode=2;
}
const args=process.argv.slice(2);
const basic=args.length===4||args.length===6;
if(!basic||args[0]!=="--file"||args[2]!=="--id"||
   !args[1]||!/^sample\d{2,3}$/.test(args[3])||
   (args.length===6&&(
     args[4]!=="--cuts"||!/^[1-9]\d*(?:,[1-9]\d*){0,18}$/.test(args[5])
   ))){
 unavailable("INVALID_CONTEXT");
}else if(extname(args[1]).toLowerCase()!==".kml"){
 unavailable("UNSUPPORTED_SOURCE");
}else{
 try{
  if(statSync(args[1]).size>2_000_000)unavailable("SOURCE_LIMIT");
  else{
   const cuts=args.length===6?args[5].split(",").map(Number):[];
   const result=inspectD43R2AltitudeQuality({
    sourceText:readFileSync(args[1],"utf8"),splitCuts:cuts,
   });
   if(result.status==="UNAVAILABLE")unavailable(result.reason);
   else process.stdout.write(JSON.stringify({
    sample:args[3],status:result.status,revision:result.revision,
    sourceParserRevision:result.sourceParserRevision,
    sourceCoverageRevision:result.sourceCoverageRevision,
    horizontalReferenceRevision:result.horizontalReferenceRevision,
    ...result.quality,
    physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
    recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,
   },null,2)+"\n");
  }
 }catch{
  unavailable("LOCAL_SOURCE_UNREADABLE");
 }
}
