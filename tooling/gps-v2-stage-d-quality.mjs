#!/usr/bin/env node
/** Local, read-only event-quality probe: no route/absolute timestamp output. */
import {readFileSync,statSync} from "node:fs";
import {extname} from "node:path";
import {parseTrackFile} from "../lib/track-processing.ts";
import {compareGpsV2StageD} from "../research/gps-detection-r21/stage-d-comparator.ts";
import {inspectLegacyProposalQuality} from "../research/gps-detection-r21/stage-d-event-quality.ts";

function stop(message,code=2){
  process.stderr.write("Stage D2 quality: "+message+". No raw input printed.\n");
  process.exitCode=code;
}
const argv=process.argv.slice(2);
if(argv.length!==4 || argv[0]!=="--file" || argv[2]!=="--id" || !argv[1] || !argv[3]){
  stop("expected --file <local.kml|gpx|csv> --id <anonymous-id>");
} else {
  const path=argv[1];
  const ext=extname(path).toLowerCase();
  if(![".kml",".gpx",".csv"].includes(ext)) {
    stop("unsupported file format");
  } else {
    try{
      if(statSync(path).size>2_000_000){
        stop("file exceeds research size limit");
      } else {
        const sourceText=readFileSync(path,"utf8");
        const fileName="anonymous"+ext;
        const check=compareGpsV2StageD({
          sourceText,fileName,anonymousSampleId:argv[3],
        });
        if(check.status!=="DIAGNOSTIC_ONLY"){
          process.stdout.write(JSON.stringify({
            sample:check.sample,
            status:"UNAVAILABLE",
            reason:check.reason,
            quality:null,
          },null,2)+"\n");
          process.exitCode=2;
        } else {
          const quality=inspectLegacyProposalQuality(
            parseTrackFile(sourceText,fileName)
          );
          process.stdout.write(JSON.stringify({
            sample:check.sample,
            sourceStatus:check.v2.status,
            // These are diagnostics of hypotheses, not actual movement counts.
            actualTouchAndGoes:"UNKNOWN",
            actualFullStops:"UNKNOWN",
            quality,
          },null,2)+"\n");
          if(quality.status!=="DIAGNOSTIC_ONLY")process.exitCode=2;
        }
      }
    }catch{
      // Filesystem or parser errors can contain original GPS/source path.
      stop("input could not be inspected");
    }
  }
}
