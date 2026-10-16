// PR340 owned local PostgreSQL16 acceptance executor. No production or shared database is used.
// THIS MODULE executes the tests. It never consumes caller-supplied PASS files.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash,randomUUID} from "node:crypto";
import {validatePostgresPartitionRegistry} from "./validate-postgres-partition-registry.mjs";
import {parseStrictPartitionTap} from "./postgres-partition-tap.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const sha=s=>createHash("sha256").update(s).digest("hex");
const performance=new Set(["postgres-v169-production-hardening.test.ts",
  "postgres-v230-large-logbook-performance.test.ts"]);
const flags=["FLYTALLY_POSTGRES_INTEGRATION","FLYTALLY_D2_FULL_V20_DISPOSABLE",
  "FLYTALLY_V21_RELEASE_DISPOSABLE","FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE",
  "FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE","FLYTALLY_D3B_FULL_V20_DISPOSABLE"];
const allowedHost="127.0.0.1";
function proc(exe,args,{env=process.env,timeout=60000,cwd=root,input}={}){
  const r=spawnSync(exe,args,{env,cwd,input,encoding:"utf8",timeout,maxBuffer:64*1024*1024,
    windowsHide:true,shell:false});
  if(r.error||r.signal||r.status!==0)throw Error("PR340 owned PG16 command failed ("+
    path.basename(exe)+"; exit="+r.status+"): "+String(r.stderr??r.error??r.signal).slice(0,1100));
  return String(r.stdout??"").trim();
}
function ownEnv(extra={}){
  const env={...process.env};
  for(const k of Object.keys(env)){
    if(/^PG[A-Z0-9_]+$/.test(k)||k==="DATABASE_URL"||flags.includes(k))delete env[k];
  }
  return {...env,...extra};
}
function pg16Bin(){
  if(process.platform!=="win32")throw Error("Windows local PG16 required");
  const dir=path.join(process.env.ProgramFiles??"C:/Program Files","PostgreSQL","16","bin");
  return Object.fromEntries(["initdb","pg_ctl","createdb","psql"].map(name=>[name,path.join(dir,name+".exe")]));
}
function ownedPort(){
  // Windows PowerShell on the owner host allocates ephemeral TCP ports with the OS.
  // A short PowerShell probe returns a reserved ephemeral port without guessing it.
  const script="$s=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'),0);"+
    "$s.Start();try{$s.LocalEndpoint.Port}finally{$s.Stop()}";
  const port=Number(proc("powershell.exe",["-NoProfile","-Command",script],{timeout:15000}));
  if(!Number.isSafeInteger(port)||port<1025||port>65535||[5432,55432].includes(port)){
    throw Error("Unsafe ephemeral PG port");
  }
  return port;
}
function splitGroups(part){
  const perf=part.id==="shared-core"?part.files.filter(x=>performance.has(x.file)):[];
  const rest=part.id==="shared-core"?part.files.filter(x=>!performance.has(x.file)):part.files;
  if(part.id==="shared-core"&&(perf.length!==2||perf.reduce((n,x)=>n+x.expectedTests,0)!==10)){
    throw Error("PR340 performance membership drift");
  }
  return [...perf.map(x=>({label:x.file.replace(".test.ts",""),expectedTests:x.expectedTests})),
    {label:"remaining",expectedTests:rest.reduce((n,x)=>n+x.expectedTests,0)}].filter(x=>x.expectedTests);
}
export function assertPr340AcceptancePreflight({candidate,env=process.env}={}){
  assert.equal(env.FLYTALLY_PR340_PARTITION_RELEASE,"1","Explicit isolated PR340 acceptance intent required");
  for(const name of ["CI","VERCEL","VERCEL_ENV"]){
    assert.equal(env[name],undefined,"Refuse CI/production marker "+name);
  }
  assert.match(candidate?.headSha??"",/^[a-f0-9]{40}$/);
  assert.deepEqual(candidate?.worktree?.files,[],"PR340 acceptance needs clean worktree");
  const actual=proc("git",["rev-parse","HEAD"]);
  const origin=proc("git",["rev-parse","refs/remotes/origin/fix/3.8.0-flights-exact-cost-summary"]);
  assert.equal(actual,candidate.headSha,"Source HEAD drift");
  assert.equal(origin,actual,"Candidate is not latest fetched PR340 origin");
  validatePostgresPartitionRegistry();
}
export function runOwnedPr340PostgresAcceptance({candidate,env=process.env}={}){
  assertPr340AcceptancePreflight({candidate,env});
  const registry=JSON.parse(readFileSync(path.join(root,"tooling/postgres-partition-registry.json"),"utf8"));
  const registrySha256=sha(readFileSync(path.join(root,"tooling/postgres-partition-registry.json")));
  assert.equal(registry.expectedTests,163);
  assert.equal(registry.partitions.length,6);
  const bins=pg16Bin();
  const parentPath=env.Path??env.PATH??"";
  const exeEnv=ownEnv({Path:path.dirname(bins.psql)+path.delimiter+parentPath,
    PATH:path.dirname(bins.psql)+path.delimiter+parentPath});
  const evidenceRoot=mkdtempSync(path.join(tmpdir(),"flytally-pr340-release-"));
  const observations=[];
  let completed=0;
  try{
    for(const part of registry.partitions){
      assertPr340AcceptancePreflight({candidate,env});
      const directory=path.join(evidenceRoot,part.id);
      mkdirSync(directory,{recursive:true});
      const data=path.join(directory,"pgdata");
      const log=path.join(directory,"postgres.log");
      const port=ownedPort(),url="postgresql://flytally@127.0.0.1:"+port+"/flytally_currency_test";
      const dbEnv={...exeEnv,DATABASE_URL:url,PGCONNECT_TIMEOUT:"5"};
      const childEnv={...dbEnv,...Object.fromEntries(part.purposeFlags.map(f=>[f,"1"]))};
      let startAttempted=false,stopVerified=false;
      try{
        proc(bins.initdb,["-D",data,"-U","flytally","-A","trust","--encoding=UTF8","--no-instructions"],
          {env:dbEnv,timeout:45000});
        startAttempted=true;
        proc(bins.pg_ctl,["-D",data,"-l",log,"-o","-h 127.0.0.1 -p "+port,"-w","-t","30","start"],
          {env:dbEnv,timeout:45000});
        proc(bins.createdb,["-h",allowedHost,"-p",String(port),"-U","flytally","flytally_currency_test"],
          {env:dbEnv});
        const observed=proc(bins.psql,["-X","-w","-A","-t","-v","ON_ERROR_STOP=1","-d",url,
          "-c","SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()||'|'||current_setting('server_version_num')"],
          {env:dbEnv});
        assert.match(observed,new RegExp("^flytally_currency_test\\|flytally\\|127\\.0\\.0\\.1\\|"+port+"\\|16[0-9]{4}$"),
          "Owned PG16 identity mismatch");
        let benchmarkProfile="postgres-default";
        if(part.id==="shared-core"){
          // Explicit reproducible *test* profile for 50k/100k sort/CTE queries.
          // No product SQL, threshold, other databases or production configuration changes.
          proc(bins.psql,["-X","-w","-v","ON_ERROR_STOP=1","-d",url,"-c",
            "ALTER DATABASE flytally_currency_test SET work_mem = '64MB'"],{env:dbEnv});
          assert.equal(proc(bins.psql,["-X","-w","-A","-t","-v","ON_ERROR_STOP=1","-d",url,
            "-c","SHOW work_mem"],{env:dbEnv}),"64MB");
          benchmarkProfile="controlled-local-pg16-work_mem-64MB";
        }
        if(part.id==="real-v20-catalog"){
          proc(process.execPath,[path.join(root,"tooling/bootstrap-pr340-real-v20-local.mjs")],
            {env:childEnv,timeout:180000});
        }
        const out=proc(process.execPath,[path.join(root,"tooling/run-pr340-partition-tests.mjs"),
          part.id,directory],{env:childEnv,timeout:900000});
        assert.match(out,new RegExp("partition="+part.id+" status=VALIDATED-ONLY passed="+part.expectedTests+"\\b"));
        const segments=splitGroups(part);
        let passed=0;
        const tap=[];
        for(const segment of segments){
          const stdout=readFileSync(path.join(directory,segment.label+".tap.txt"),"utf8");
          const stderr=readFileSync(path.join(directory,segment.label+".stderr.txt"),"utf8");
          assert.equal(stderr,"","Child stderr is not empty");
          const result=parseStrictPartitionTap(stdout,{expectedTests:segment.expectedTests});
          passed+=result.passed;
          tap.push({segment:segment.label,passed:result.passed,sha256:result.tapSha256});
        }
        assert.equal(passed,part.expectedTests);
        proc(bins.pg_ctl,["-D",data,"-m","fast","-w","-t","30","stop"],{env:dbEnv,timeout:45000});
        stopVerified=true;
        observations.push({partition:part.id,passed,databaseIdentity:observed,
          profile:benchmarkProfile,segments:tap,ownedClusterStopped:true});
        completed+=passed;
        process.stdout.write("PR340 owned PG16 "+part.id+" "+passed+"/"+part.expectedTests+
          " "+benchmarkProfile+" PASS\\n");
      }finally{
        if(startAttempted&&!stopVerified){
          try{
            proc(bins.pg_ctl,["-D",data,"-m","fast","-w","-t","30","stop"],
              {env:dbEnv,timeout:45000});
          }catch{process.stderr.write("PR340 WARNING: possibly running owned cluster retained: "+directory+"\\n");}
        }
      }
    }
    assert.equal(completed,163,"Incomplete PG16 partition acceptance");
    assert.equal(new Set(observations.map(x=>x.databaseIdentity)).size,6,"Database reused");
    assertPr340AcceptancePreflight({candidate,env});
    const observation={command:"trusted PR340 six-owned-PG16 partition TAP executor",
      coverage:"full",planned:163,passed:163,failed:0,skipped:0,notApplicable:0,retries:0,
      sourceGate:"postgres",registrySha256,profile:"controlled-local-pg16-shared-core-work_mem-64MB",
      partitions:observations,evidenceDirectory:evidenceRoot};
    writeFileSync(path.join(evidenceRoot,"verified-summary.json"),JSON.stringify({
      status:"LOCAL-PG16-ACCEPTANCE-PARTITIONS-VERIFIED",headSha:candidate.headSha,observation},null,2));
    return observation;
  }catch(error){
    process.stderr.write("PR340 PG16 FAILED; retained evidence: "+evidenceRoot+"\\n");
    throw error;
  }
}
