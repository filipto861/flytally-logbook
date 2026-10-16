import {readFileSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {parseStrictPartitionTap} from "./postgres-partition-tap.mjs";
import {validatePostgresPartitionRegistry} from "./validate-postgres-partition-registry.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const [partitionId,outDir]=process.argv.slice(2);

// These two existing PG fixtures contain the observed 50k and 100k
// Pilot Insights latency assertions. Run them as single-file Node invocations
// without concurrent integration specs or changing thresholds/SQL.
const isolatedPerformance=new Set([
  "postgres-v169-production-hardening.test.ts",
  "postgres-v230-large-logbook-performance.test.ts",
]);

function execute(label,files,expectedTests,outDir){
  const args=["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON","--test","--test-reporter=tap",
    "--experimental-strip-types",...files.map(f=>join(root,"tests/integration",f.file))];
  const run=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:"utf8",timeout:240000,
    maxBuffer:64*1024*1024,shell:false});
  const stdout=run.stdout??"",stderr=run.stderr??"";
  writeFileSync(resolve(outDir,label+".tap.txt"),stdout,"utf8");
  writeFileSync(resolve(outDir,label+".stderr.txt"),stderr,"utf8");
  if(run.error||run.signal||run.status!==0||stderr!==""){
    throw Error("Child "+label+" failure: "+String(run.error??run.signal??run.status)+" (see retained evidence)");
  }
  const evidence=parseStrictPartitionTap(stdout,{expectedTests});
  console.log("partition="+partitionId+" segment="+label+" passed="+evidence.passed+
    " tap_sha256="+evidence.tapSha256);
  return evidence;
}

try{
  validatePostgresPartitionRegistry();
  const registry=JSON.parse(readFileSync(join(root,"tooling/postgres-partition-registry.json"),"utf8"));
  const selected=registry.partitions.find(p=>p.id===partitionId);
  if(!selected||selected.id==="real-v20-catalog"||!outDir)throw Error("Unknown, unreviewed, or blocked partition");

  const perf=selected.id==="shared-core"
    ?selected.files.filter(f=>isolatedPerformance.has(f.file)):[];
  const others=selected.id==="shared-core"
    ?selected.files.filter(f=>!isolatedPerformance.has(f.file)):selected.files;
  if(selected.id==="shared-core"&&(perf.length!==2||
    perf.reduce((n,f)=>n+f.expectedTests,0)!==10)){
    throw Error("Performance fixture membership drift");
  }
  const groups=[...perf.map(f=>({label:f.file.replace(".test.ts",""),files:[f]})),
    {label:"remaining",files:others}].filter(group=>group.files.length>0);
  let passed=0;
  for(const group of groups){
    const expectedTests=group.files.reduce((n,f)=>n+f.expectedTests,0);
    passed+=execute(group.label,group.files,expectedTests,outDir).passed;
  }
  if(passed!==selected.expectedTests)throw Error("Segment evidence count drift");
  console.log("partition="+partitionId+" status=VALIDATED-ONLY passed="+passed+
    " segments="+groups.length+" release_status=NOT RUN");
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=2}
