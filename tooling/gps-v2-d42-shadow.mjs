#!/usr/bin/env node
/**
 * D4.2A local read-only shadow diagnostics. No GPS track, path, UTC,
 * coordinates, elevation, registration, source fingerprint or contact claim
 * is printed. This CLI neither reads app DB nor updates logbook state.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {inspectD42Shadow} from "../research/gps-detection-r21/stage-d42-shadow.ts";

function fail(reason){
 process.stdout.write(JSON.stringify({status:"UNAVAILABLE",reason,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE"},null,2)+"\n");
 process.exitCode=2;
}
const argv=process.argv.slice(2);
if(argv.length!==4||argv[0]!=="--file"||argv[2]!=="--id"||
 !argv[1]||!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(argv[3])){
 fail("INVALID_CONTEXT");
}else if(extname(argv[1]).toLowerCase()!==".kml"){
 fail("UNSUPPORTED_SOURCE");
}else{
 try{
  if(statSync(argv[1]).size>2_000_000){fail("SOURCE_LIMIT");}
  else{
   const result=inspectD42Shadow({sourceText:readFileSync(argv[1],"utf8")});
   if(result.status==="UNAVAILABLE"){fail(result.reason);}
   else{
    const counts=items=>Object.fromEntries([
     "DEPARTURE_REVIEW_POINT","ARRIVAL_REVIEW_POINT","STOP_GO_REVIEW_POINT"
    ].map(kind=>[kind,items.filter(e=>e.kind===kind).length]));
    const inconclusive=result.candidates.filter(e=>e.disposition==="INCONCLUSIVE");
    process.stdout.write(JSON.stringify({
     sample:argv[3],status:result.status,revision:result.revision,
     referenceRevision:result.referenceRevision,
     sourceBlocks:result.sourceBlocks,canonicalFixes:result.canonicalFixes,
     blockedSourceEdges:result.blockedEdges,
     hypotheticalBaseByKind:counts(result.hypotheticalBase),
     researchCandidatesByKind:counts(result.candidates),
     suppressedByBoundaryByKind:counts(result.suppressedByBoundary),
     inconclusiveCount:inconclusive.length,
     inconclusiveUnobservedContinuity:inconclusive.filter(e=>
      e.reason==="UNOBSERVED_CONTINUITY").length,
     cadence:result.cadence,
     physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
     canAffectCanonicalFlight:false,
    },null,2)+"\n");
   }
  }
 }catch{
  // No raw exception text; filesystem errors can disclose full local paths.
  fail("LOCAL_SOURCE_UNREADABLE");
 }
}
