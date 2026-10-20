/**
 * LOCAL-ONLY read-only owner diagnostics for GPS T&G legacy altitude predicates.
 * Usage: node tooling/gps-d1-local-altitude-summary.mjs <local .kml/.gpx/.csv>
 * Outputs anonymous aggregate counts; never writes flight, DB, raw KML or GPS fixes.
 * Requires Node 24 for native TypeScript import support.
 */
import {readFile,stat} from "node:fs/promises";
import path from "node:path";
import {parseTrackFile} from "../lib/track-processing.ts";
import {summarizeLegacyAltitudeDiagnostics} from "../research/gps-detector-accuracy/d1-altitude-diagnostics.ts";

function refuse(){
  console.error("D1 refused: local offline source/permission/format unavailable. No private path or source content printed.");
  process.exitCode=1;
}
if(process.env.CI||process.env.VERCEL||process.env.VERCEL_ENV||process.env.GITHUB_ACTIONS){
  refuse();
}else if(process.argv.length!==3||process.argv[2].startsWith("-")){
  console.error("Usage: node tooling/gps-d1-local-altitude-summary.mjs <local KML/GPX/CSV path>");
  process.exitCode=2;
}else{
  try{
    const input=process.argv[2];
    const extension=path.extname(input).toLowerCase();
    if(![".kml",".gpx",".csv"].includes(extension)||/^[a-z]+:\/\//i.test(input))throw Error("unsupported");
    const info=await stat(input);
    if(!info.isFile()||info.size===0||info.size>32*1024*1024)throw Error("invalid source");
    const original=await readFile(input,"utf8");
    const points=parseTrackFile(original,"input"+extension);
    if(points.length<2)throw Error("insufficient parsed source");
    const report=summarizeLegacyAltitudeDiagnostics(points);
    console.log(JSON.stringify(report,null,2));
  }catch{
    refuse();
  }
}
