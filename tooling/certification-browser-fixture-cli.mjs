// Isolated browser-fixture bridge to the canonical TypeScript certification engine.
// Playwright transpilation cannot be trusted to preserve named .ts ESM exports from .mjs.
// Execute only in a separate native Node process with --experimental-strip-types.
import {readFileSync} from "node:fs";
import {flightCertificationHash,verifyFlightCertification} from "../lib/certification-integrity.ts";

if(process.env.FLYTALLY_AUTH_BROWSER!=="1"||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
  throw new Error("Browser certification fixture CLI requires isolated authenticated local mode.");
}
const mode=process.argv[2];
if(!["sign","verify"].includes(mode)||process.argv.length!==3){
  throw new Error("Browser certification fixture CLI accepts only sign or verify.");
}
const row=JSON.parse(readFileSync(0,"utf8"));
if(!row||typeof row!=="object"||Number(row.id)!==9903||
   Number(row.user_id)!==9001||Number(row.certification_version)!==8||
   Number(row.certified_by_user_id)!==9001||!row.certified_at){
  throw new Error("Unexpected browser certified flight fixture identity.");
}
if(mode==="sign"){
  if(row.certification_hash!=="PENDING_FIXTURE_SIGNATURE"){
    throw new Error("Browser fixture must be unsigned placeholder before signing.");
  }
  const digest=flightCertificationHash(row,9001,8);
  if(!/^[0-9a-f]{64}$/.test(digest))throw new Error("Invalid computed fixture digest.");
  process.stdout.write(digest);
}else{
  if(verifyFlightCertification(row,9001).status!=="verified"){
    throw new Error("Browser certified flight failed canonical verification.");
  }
  process.stdout.write("verified");
}
