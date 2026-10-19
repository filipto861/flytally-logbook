#!/usr/bin/env node
/** Owner-local, read-only D4.3-R1 research summary.
 * No source text, route, UTC, coordinate, altitude, filename, local path,
 * registration, raw exception or SHA-256 source token is ever printed.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {inspectD43R1Coverage} from "../research/gps-detection-r21/stage-d43-r1-coverage.ts";

function unavailable(reason){
 process.stdout.write(JSON.stringify({status:"UNAVAILABLE",reason,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE"})+"\n");
 process.exitCode=2;
}
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=="--file"||args[2]!=="--id"||
 !args[1]||!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(args[3])){
 unavailable("INVALID_CONTEXT");
}else if(extname(args[1]).toLowerCase()!==".kml"){
 unavailable("UNSUPPORTED_SOURCE");
}else{
 try{
  if(statSync(args[1]).size>2_000_000)unavailable("SOURCE_LIMIT");
  else{
   const coverage=inspectD43R1Coverage({sourceText:readFileSync(args[1],"utf8")});
   if(coverage.status==="UNAVAILABLE")unavailable(coverage.reason);
   else{
    const c=coverage.coverage,reasonCounts={};
    for(const edge of c.issueEdges)
     for(const reason of edge.reasons)
      reasonCounts[reason]=(reasonCounts[reason]??0)+1;
    const summary={
     sample:args[3],status:coverage.status,revision:coverage.revision,
     sourceParserRevision:coverage.sourceParserRevision,
     referenceRevision:coverage.referenceRevision,
     interpretation:c.interpretation,
     sourceBlocks:c.sourceBlocks,rawFixes:c.rawFixes,
     canonicalFixes:c.canonicalFixes,adjacentFixPairs:c.adjacentFixPairs,
     betweenFixPairsUnobserved:c.betweenFixPairsUnobserved,
     sourceBlockedEdges:c.sourceBlockedEdges,
     manualFlightSplitEdges:c.manualFlightSplitEdges,
     independentlyInvalidTimeEdges:c.independentlyInvalidTimeEdges,
     independentlyInvalidSpeedEdges:c.independentlyInvalidSpeedEdges,
     v2UsableVelocityEdges:c.v2UsableVelocityEdges,
     medianBetweenFixSeconds:c.sourceCadenceMedianSeconds,
     maxWithinBlockSeconds:c.sourceCadenceMaxSeconds,
     longestWithinBlockSeconds:c.longestWithinBlockIntervals.map(x=>x.durationSeconds),
     issueReasonCounts:reasonCounts,
     candidateAnalysis:"NOT_PERFORMED",unknownManeuvers:"UNAVAILABLE",
     actualLandings:"UNAVAILABLE",physicalContact:"UNRESOLVED",
     canAffectCanonicalFlight:false,
    };
    process.stdout.write(JSON.stringify(summary,null,2)+"\n");
   }
  }
 }catch{
  unavailable("LOCAL_SOURCE_UNREADABLE");
 }
}
