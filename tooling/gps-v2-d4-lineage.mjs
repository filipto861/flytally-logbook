#!/usr/bin/env node
/**
 * D4.1 local-only, read-only research summary.
 * Accepts one explicitly provided local KML; NEVER prints source, filename,
 * coordinates, UTC, altitude, registration, or original GPS data.
 */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {inspectD4MultiGxLineage} from "../research/gps-detection-r21/multi-gx-track-lineage.ts";

const argv=process.argv.slice(2);
const reportFailure=(status,reason)=>{
  process.stdout.write(JSON.stringify({status,reason,physicalContact:"UNRESOLVED",
    actualLandings:"UNAVAILABLE"},null,2)+"\n");
  process.exitCode=2;
};
if(argv.length!==4||argv[0]!=="--file"||argv[2]!=="--id"||
  !argv[1]||!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(argv[3])){
  reportFailure("UNAVAILABLE","INVALID_CONTEXT");
} else if(extname(argv[1]).toLowerCase()!==".kml") {
  reportFailure("UNAVAILABLE","UNSUPPORTED_SOURCE");
} else {
  try {
    if(statSync(argv[1]).size>2_000_000) {
      reportFailure("UNAVAILABLE","SOURCE_LIMIT");
    } else {
      const s=readFileSync(argv[1],"utf8");
      const r=inspectD4MultiGxLineage(s);
      if(r.status==="UNAVAILABLE") {
        process.stdout.write(JSON.stringify({
          sample:argv[3],status:r.status,reason:r.reason,
          actualLandings:r.actualLandings,
          physicalContact:r.physicalContact,
        },null,2)+"\n");
        process.exitCode=2;
      } else {
        const collisions=r.blockedEdgeReasons.filter(e=>
          e.reasons.includes("TIMESTAMP_COLLISION")).length;
        const conflictFixes=r.canonical.filter(e=>e.altitudeConflict).length;
        const collapsedFixes=r.canonical.reduce((sum,e)=>sum+e.collapsed.length,0);
        process.stdout.write(JSON.stringify({
          sample:argv[3],revision:r.revision,
          status:r.status,reason:null,
          sourceBlocks:r.blockCount,rawFixes:r.rawFixCount,
          canonicalFixes:r.canonicalFixCount,
          collapsedFixes,conflictFixes,
          blockedEvidenceEdges:r.blockedEdges.length,
          blockedTimestampEdges:collisions,
          sourceRuns:r.unblockedSourceRuns.length,
          actualLandings:"UNAVAILABLE",physicalContact:"UNRESOLVED",
          canAffectCanonicalFlight:false,
        },null,2)+"\n");
      }
    }
  } catch {
    // Never echo raw exception text: it may contain sensitive local paths.
    reportFailure("UNAVAILABLE","LOCAL_SOURCE_UNREADABLE");
  }
}
