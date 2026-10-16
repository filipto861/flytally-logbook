import {readFileSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {parseStrictPartitionTap} from "./postgres-partition-tap.mjs";
import {validatePostgresPartitionRegistry} from "./validate-postgres-partition-registry.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const [partitionId,outDir]=process.argv.slice(2);
try{
  validatePostgresPartitionRegistry();
  const registry=JSON.parse(readFileSync(join(root,"tooling/postgres-partition-registry.json"),"utf8"));
  const selected=registry.partitions.find(p=>p.id===partitionId);
  if(!selected||selected.id==="real-v20-catalog"||!outDir)throw Error("Unknown, unreviewed, or blocked partition");
  const args=["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON","--test","--test-reporter=tap",
    "--experimental-strip-types",...selected.files.map(f=>join(root,"tests/integration",f.file))];
  const run=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:"utf8",timeout:240000,
    maxBuffer:64*1024*1024,shell:false});
  const stdout=run.stdout??"",stderr=run.stderr??"";
  writeFileSync(resolve(outDir,"tap.txt"),stdout,"utf8");
  writeFileSync(resolve(outDir,"stderr.txt"),stderr,"utf8");
  if(run.error||run.signal||run.status!==0||stderr!=="")throw Error("Child failure: "+String(run.error??run.signal??run.status)+" (see retained evidence)");
  const evidence=parseStrictPartitionTap(stdout,{expectedTests:selected.expectedTests});
  console.log("partition="+partitionId+" passed="+evidence.passed+" tap_sha256="+evidence.tapSha256);
  console.log("release_status=NOT RUN");
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=2}
