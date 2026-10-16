import {readFileSync} from "node:fs";
import {parseStrictPartitionTap} from "./postgres-partition-tap.mjs";
const [tapFile,count]=process.argv.slice(2);
try{
  if(!tapFile||!/^[1-9][0-9]*$/.test(count??""))throw Error("TAP file and expected count required");
  const report=parseStrictPartitionTap(readFileSync(tapFile,"utf8"),{expectedTests:Number(count)});
  console.log("partition_tap_status=VALIDATED-ONLY");
  console.log("partition_tap_cases="+report.passed);
  console.log("partition_tap_sha256="+report.tapSha256);
  console.log("postgres_release_evidence=NOT RUN");
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=2}
