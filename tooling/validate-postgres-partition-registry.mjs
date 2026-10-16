import {createHash} from "node:crypto";
import {readFileSync,readdirSync,lstatSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const canonicalRegistry=path.join(root,"tooling/postgres-partition-registry.json");
const canonicalDirectory=path.join(root,"tests/integration");
const declaredPartitions=new Map([
  ["shared-core",{flags:["FLYTALLY_POSTGRES_INTEGRATION"],schema:"verified-disposable-pg16/private-schemas-or-nondestructive",locked:[]}],
  ["shared-restore",{flags:["FLYTALLY_POSTGRES_INTEGRATION","FLYTALLY_D2_FULL_V20_DISPOSABLE"],schema:"fresh-owned-public/destructive-bootstrap",locked:["postgres-v380-full-v20-restore.test.ts"]}],
  ["v21-migration",{flags:["FLYTALLY_POSTGRES_INTEGRATION","FLYTALLY_V21_RELEASE_DISPOSABLE"],schema:"fresh-owned-public/zero-tables",locked:["postgres-currency-v21-release.test.ts"]}],
  ["d3b-migration-chain",{flags:["FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE"],schema:"fresh-owned-private-schema",locked:["postgres-v380-d3b-migrations-v1-v20-trash.test.ts"]}],
  ["d3b-races",{flags:["FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE"],schema:"fresh-owned-private-schema",locked:["postgres-v380-d3b-real-trash-races.test.ts"]}],
  ["real-v20-catalog",{flags:["FLYTALLY_D3B_FULL_V20_DISPOSABLE"],schema:"fresh-owned-public/real-v1-through-v20-migrations",locked:["v380-d3b-full-v20-catalog.test.ts","v380-d3b-zero-delete-counterexample.test.ts"]}],
]);
const hash=(body)=>createHash("sha256").update(body).digest("hex");
// Git stores text with LF while Git for Windows may check out CRLF. Pin the
// exact canonical Git text, not platform-specific working-tree line endings.
// All other bytes remain significant. Invalid UTF-8 and bare CR fail closed.
const canonicalTestSource=(bytes)=>{
  const content=bytes.toString("utf8");
  if(!Buffer.from(content,"utf8").equals(bytes)||/\r(?!\n)/.test(content)){
    throw new Error("PARTITION_REGISTRY_DRIFT: invalid UTF-8 or bare carriage return in test source");
  }
  return content.replaceAll("\r\n","\n");
};
const testCount=(body)=>[...body.matchAll(/(?:^|\n)\s*test\s*\(\s*["'`]/g)].length;
const onlyKeys=(value,expected,label)=>{
  if(!value||typeof value!=="object"||Array.isArray(value)||
    Object.keys(value).sort().join("|")!==[...expected].sort().join("|")){
    throw new Error("PARTITION_REGISTRY_DRIFT: "+label+" shape differs from reviewed contract");
  }
};
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

export function validatePostgresPartitionRegistry({
  registryPath=canonicalRegistry,
  directory=canonicalDirectory,
}={}){
  const registry=JSON.parse(readFileSync(registryPath,"utf8"));
  onlyKeys(registry,["schemaVersion","stage","sourceDirectory","hashAlgorithm","expectedFiles","expectedTests","partitions"],"registry");
  if(registry.schemaVersion!==1||registry.stage!=="M1-INVENTORY-ONLY-NO-EXECUTION"||
     registry.sourceDirectory!=="tests/integration"||
     registry.hashAlgorithm!=="sha256-utf8-canonical-lf"||
     registry.expectedFiles!==42||registry.expectedTests!==163||
     !Array.isArray(registry.partitions)||registry.partitions.length!==declaredPartitions.size){
    throw new Error("PARTITION_REGISTRY_DRIFT: unsupported registry metadata or inventory total");
  }
  const actual=readdirSync(directory)
    .filter(name=>name.endsWith(".test.ts")).sort();
  const seen=new Set();
  const seenPartitions=new Set();
  let cases=0;
  for(const partition of registry.partitions){
    onlyKeys(partition,["id","purposeFlags","schemaOwnership","expectedTests","files"],"partition");
    const approved=declaredPartitions.get(partition.id);
    if(!approved||seenPartitions.has(partition.id)||
       !equal(partition.purposeFlags,approved.flags)||
       partition.schemaOwnership!==approved.schema||
       !Array.isArray(partition.files)||partition.files.length===0){
      throw new Error("PARTITION_REGISTRY_DRIFT: unapproved partition or fixture scope");
    }
    seenPartitions.add(partition.id);
    let partitionCases=0;
    const names=[];
    for(const entry of partition.files){
      onlyKeys(entry,["file","sha256","expectedTests"],"entry");
      if(typeof entry.file!=="string"||
         !/^[a-z0-9][a-z0-9.-]*\.test\.ts$/.test(entry.file)||
         seen.has(entry.file)||typeof entry.sha256!=="string"||
         !/^[a-f0-9]{64}$/.test(entry.sha256)||
         !Number.isSafeInteger(entry.expectedTests)||entry.expectedTests<1){
        throw new Error("PARTITION_REGISTRY_DRIFT: duplicate, unknown or malformed test entry");
      }
      seen.add(entry.file);names.push(entry.file);
      const file=path.join(directory,entry.file);
      let source;
      try {
        if(!lstatSync(file).isFile())throw new Error("not a regular file");
        source=readFileSync(file);
      }catch{
        throw new Error("PARTITION_REGISTRY_DRIFT: missing/nonregular test file "+entry.file);
      }
      const canonical=canonicalTestSource(source);
      if(hash(canonical)!==entry.sha256){
        throw new Error("PARTITION_REGISTRY_DRIFT: SHA-256 mismatch for "+entry.file);
      }
      const count=testCount(canonical);
      if(count!==entry.expectedTests){
        throw new Error("PARTITION_REGISTRY_DRIFT: declared test count mismatch for "+entry.file);
      }
      partitionCases+=count;
    }
    if(names.some((x,i)=>i>0&&names[i-1]>=x)||
       partitionCases!==partition.expectedTests){
      throw new Error("PARTITION_REGISTRY_DRIFT: unordered test list or partition test count");
    }
    const protectedNames=[...approved.locked].sort();
    if(partition.id==="shared-core"){
      if(names.some(name=>[...declaredPartitions.values()].some(v=>v.locked.includes(name)))){
        throw new Error("PARTITION_REGISTRY_DRIFT: purpose-bound file moved into shared-core");
      }
    }else if(!equal([...names].sort(),protectedNames)){
      throw new Error("PARTITION_REGISTRY_DRIFT: protected partition membership changed");
    }
    cases+=partitionCases;
  }
  if(seenPartitions.size!==declaredPartitions.size||
     seen.size!==registry.expectedFiles||cases!==registry.expectedTests||
     !equal([...seen].sort(),actual)){
    throw new Error("PARTITION_REGISTRY_DRIFT: actual integration directory differs from pinned inventory");
  }
  return {status:"PASS",files:seen.size,tests:cases,partitions:seenPartitions.size,
    registrySha256:hash(readFileSync(registryPath)),note:"SOURCE INVENTORY ONLY; PostgreSQL NOT RUN"};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  try{
    const report=validatePostgresPartitionRegistry();
    console.log("postgres_registry_status="+report.status);
    console.log("files="+report.files+" tests="+report.tests+" partitions="+report.partitions);
    console.log("registry_sha256="+report.registrySha256);
    console.log("postgres_execution=NOT RUN");
  }catch(error){
    console.error(error instanceof Error?error.message:String(error));
    process.exitCode=2;
  }
}
