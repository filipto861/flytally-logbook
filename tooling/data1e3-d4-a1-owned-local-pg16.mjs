// DATA-1E3: one owner-local Windows PostgreSQL16 cluster, only synthetic restore diagnostics.
// No caller DATABASE_URL, Neon credential, external database, production migration or deployment.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {existsSync,mkdtempSync,mkdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";
import {fileURLToPath} from "node:url";
import {commandLineContainsExactDataDirectory} from "./data1e3-d4-win-process-path.mjs";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const branchRef="refs/remotes/origin/test/logbook-data1e3-d4-a1-owned-pg16-20261030";
const role="data1e3_owner",database="data1e3_synthetic";
const forbiddenEnv=/^(?:PG[A-Z0-9_]*|DATABASE_URL|POSTGRES_URL|NEON[A-Z0-9_]*|VERCEL[A-Z0-9_]*|FLYTALLY_LOCAL_POSTGRES|FLYTALLY_AUTH_BROWSER|FLYTALLY_POSTGRES_INTEGRATION|CI)$/i;
const assertSha=(x)=>{assert.match(x,/^[a-f0-9]{40}$/,"Expected exact 40-character Git HEAD SHA");return x};
const actualSha=()=>cmd("git",["rev-parse","HEAD"],{cwd:repoRoot});
function cmd(executable,args,{cwd=repoRoot,env=process.env,timeout=60000,stdio="pipe"}={}){
  const r=spawnSync(executable,args,{cwd,env,encoding:"utf8",shell:false,windowsHide:true,
    timeout,maxBuffer:8*1024*1024,stdio});
  if(r.error||r.signal||r.status!==0)throw Error("LOCAL_D4_COMMAND_FAILED "+
    path.basename(executable)+" exit="+r.status+" signal="+(r.signal??"none")+
    " error="+(r.error?.code??"none")+" stderr="+String(r.stderr??"").slice(0,600));
  return String(r.stdout??"").trim();
}
function safeEnv(){
  const next={...process.env};
  for(const key of Object.keys(next))if(forbiddenEnv.test(key))delete next[key];
  next.PGCONNECT_TIMEOUT="5";
  return next;
}
function normalizePath(s){return path.normalize(realpathSync(s)).replace(/[\\/]$/,"").toLowerCase()}
function verifyRepository(expected){
  assert.equal(process.platform,"win32","Windows owner-local only");
  assert.match(process.version,/^v24\./,"Node24 required");
  for(const [k,v] of Object.entries(process.env))if(forbiddenEnv.test(k)&&v){
    throw Error("Inherited PostgreSQL/cloud/CI setting must be cleared: "+k);
  }
  assert.equal(actualSha(),expected,"Git HEAD differs from owner-authorized frozen SHA");
  assert.equal(cmd("git",["rev-parse","--verify",branchRef]),expected,
    "Fetched origin topic branch HEAD differs from frozen SHA");
  assert.equal(cmd("git",["status","--porcelain"]),"",
    "Require a clean checkout: refusing to use uncommitted source");
  const basedir=path.join(process.env.ProgramFiles??"C:\\Program Files","PostgreSQL","16","bin");
  const binaries=Object.fromEntries(["initdb","pg_ctl","createdb","psql","postgres"]
    .map(n=>[n,path.join(basedir,n+".exe")]));
  for(const [name,exe] of Object.entries(binaries))assert.ok(existsSync(exe),
    "Local native PostgreSQL16 missing executable "+name+": "+exe);
  return binaries;
}
async function allocatePort(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>{s.once("error",reject);s.listen(0,"127.0.0.1",resolve)});
  const addr=s.address(),port=typeof addr==="object"&&addr?addr.port:0;
  await new Promise((resolve,reject)=>s.close(e=>e?reject(e):resolve()));
  assert.ok(Number.isSafeInteger(port)&&port>=1025&&![5432,55432].includes(port),
    "Unsafe ephemeral postgres port");
  return port;
}
function physicalPid(bins,pid,data){
  assert.ok(Number.isSafeInteger(pid)&&pid>0,"No owned postgres PID");
  const script="$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+
    "'; if($null -eq $p){exit 4}; "+
    "$p|Select-Object ProcessId,ExecutablePath,CommandLine|ConvertTo-Json -Compress";
  const obj=JSON.parse(cmd("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],
    {timeout:20000}));
  assert.equal(obj.ProcessId,pid,"PostgreSQL PID changed");
  assert.equal(normalizePath(obj.ExecutablePath),normalizePath(bins.postgres),
    "Unexpected postgres executable");
  if(!commandLineContainsExactDataDirectory(obj.CommandLine,data)){
    // Only classification flags: never print OS username, full command line or data directory.
    const line=typeof obj.CommandLine==="string"?obj.CommandLine:"";
    console.error("D4_PG_CMDLINE_FORMAT_DIAGNOSTIC "+JSON.stringify({
      commandLineAvailable:line.length>0,
      containsDashD:/(?:^|\s)["']?-d["']?(?:\s|=)/i.test(line),
      hasForwardSlash:line.includes("/"),
      hasBackslash:line.includes("\\"),
      failClosed:true
    }));
    throw new Error("PostgreSQL command line does not contain exact owned data dir after Windows path normalization (fail closed)");
  }
}
function verifyIdentity(bins,pgEnv,url,data,port){
  const sql="SELECT row_to_json(t)::text FROM (SELECT current_database() AS db,"+
    "current_user AS role,host(inet_server_addr()) AS addr,inet_server_port() AS port,"+
    "current_setting('server_version_num') AS pgversion,"+
    "current_setting('data_directory') AS datadir,"+
    "current_setting('transaction_read_only') AS readonly) t";
  const rows=cmd(bins.psql,["-d",url,"-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",sql],{env:pgEnv});
  const row=JSON.parse(rows);
  assert.equal(row.db,database);assert.equal(row.role,role);assert.equal(row.addr,"127.0.0.1");
  assert.equal(row.port,port);assert.match(row.pgversion,/^16[0-9]{4}$/);
  assert.equal(normalizePath(row.datadir),normalizePath(data));
  assert.equal(row.readonly,"off");
  const lines=readFileSync(path.join(data,"postmaster.pid"),"utf8").split(/\r?\n/);
  const pid=Number(lines[0]);assert.equal(Number(lines[3]),port);
  assert.equal(normalizePath(lines[1]),normalizePath(data));
  physicalPid(bins,pid,data);
  return {db:row.db,role:row.role,port:row.port,pgversion:row.pgversion,pid};
}
async function main(){
  const args=process.argv.slice(2);
  const mode=args.includes("--probe")?"PROBE":args.includes("--execute")?"EXECUTE":null;
  assert.ok(mode&&args.filter(x=>x==="--probe"||x==="--execute").length===1,
    "Use exactly one of --probe or --execute");
  const shaArg=args.find(a=>a.startsWith("--expected-sha="));
  assert.ok(shaArg,"Provide --expected-sha=40-hex verified GitHub SHA");
  const expected=assertSha(shaArg.slice("--expected-sha=".length));
  const valid=new Set(["--probe","--execute",shaArg,"--allow-synthetic-writes","--confirm=DATA1E3-A1-LOCAL-ONLY"]);
  assert.ok(args.every(a=>valid.has(a)),"Unknown args refused");
  if(mode==="EXECUTE")assert.ok(args.includes("--allow-synthetic-writes")&&
    args.includes("--confirm=DATA1E3-A1-LOCAL-ONLY"),"Explicit synthetic-only execute intent required");
  else assert.ok(!args.includes("--allow-synthetic-writes")&&!args.some(a=>a.startsWith("--confirm=")),
    "Probe is strictly non-creating");
  const binaries=verifyRepository(expected);
  if(mode==="PROBE"){
    console.log(JSON.stringify({phase:"D4_A1_LOCAL_PG16_PROBE",status:"PASS",sha:expected,
      platform:process.platform,node:process.version,postgresBin:path.dirname(binaries.psql),
      action:"NO DB CREATED, NO CONNECTION, NO RESTORE"}));return;
  }
  const parent=mkdtempSync(path.join(tmpdir(),"flytally-data1e3-d4-a1-"));
  const parentReal=realpathSync(parent),data=path.join(parentReal,"pgdata");
  const sentinel=path.join(parentReal,".data1e3-owned");
  const ownershipToken=randomUUID();
  writeFileSync(sentinel,ownershipToken,{flag:"wx",mode:0o600});
  const base=realpathSync(tmpdir());
  assert.equal(path.dirname(parentReal).toLowerCase(),base.toLowerCase(),
    "Owned temporary directory is outside OS temp");
  const port=await allocatePort();
  const url="postgresql://"+role+"@127.0.0.1:"+port+"/"+database+"?sslmode=disable";
  const env=safeEnv();
  const binPath=path.dirname(binaries.psql),originalPath=env.Path??env.PATH??"";
  env.Path=binPath+path.delimiter+originalPath;env.PATH=env.Path;
  let startAttempted=false,stoppedVerified=false,initialVerified=false;
  let testStatus="NOT RUN",baselineStatus="NOT RUN",securityStatus="NOT RUN",failure=null,identity=null;
  try{
    cmd(binaries.initdb,["-D",data,"-U",role,"-A","trust","--encoding=UTF8","--no-instructions"],
      {env,timeout:90000});
    startAttempted=true;
    cmd(binaries.pg_ctl,["-D",data,"-l",path.join(parentReal,"postgres.log"),
      "-o","-h 127.0.0.1 -p "+port,"-w","-t","45","start"],{env,timeout:90000,stdio:"ignore"});
    cmd(binaries.createdb,["-h","127.0.0.1","-p",String(port),"-U",role,database],{env});
    identity=verifyIdentity(binaries,env,url,data,port);
    initialVerified=true;
    console.log(JSON.stringify({phase:"D4_ISOLATED_LOCAL_PG16_PREFLIGHT",status:"PASS",
      sha:expected,...identity,cluster:"newly-created OS-temp one-time cluster",
      syntheticOnly:true}));
    const test=spawnSync(process.execPath,["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--test","--experimental-strip-types",
      "tests/integration/postgres-security-restore.test.ts"],{
      cwd:repoRoot,env:{...env,DATABASE_URL:url,FLYTALLY_POSTGRES_INTEGRATION:"1"},
      encoding:"utf8",shell:false,windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});
    if(test.stdout)process.stdout.write(test.stdout);
    if(test.stderr)process.stderr.write(test.stderr);
    if(test.error||test.signal||test.status!==0){baselineStatus="FAIL";throw Error("D4_BASELINE_INTEGRATION_FAILED exit="+
      test.status+" signal="+(test.signal??"none")+" error="+(test.error?.code??"none"));}
    baselineStatus="PASS";
    console.log(JSON.stringify({phase:"D4_BASELINE_SOURCE_SQL_RESTORE",result:"PASS",
      note:"existing synthetic security/restore PostgreSQL tests; NOT full authenticated signed-v13 app restoration"}));
    const risk=spawnSync(process.execPath,["tooling/data1e3-d4-a1-source-sql-probe.mjs"],{
      cwd:repoRoot,env:{...env,DATABASE_URL:url,FLYTALLY_D4_A1_LOCAL_PROBE:"1",
        FLYTALLY_D4_A1_OWNED_PGDATA:data,FLYTALLY_D4_A1_OWNERSHIP_TOKEN:ownershipToken},encoding:"utf8",shell:false,windowsHide:true,
      timeout:120000,maxBuffer:4*1024*1024});
    if(risk.stdout)process.stdout.write(risk.stdout);
    if(risk.stderr)process.stderr.write(risk.stderr);
    if(risk.error||risk.signal)throw Error("D4_SOURCE_SQL_PROBE_EXECUTION_ERROR");
    if(risk.status===0){securityStatus="PASS";testStatus="PASS";}
    else throw Error("D4_A1_SOURCE_SQL_PROBE_FAIL exit="+risk.status);
    console.log(JSON.stringify({phase:"D4_A1_DB_ACCEPTANCE",status:"PASS",
      sourceDefinedTriggers:true,twoSession:true,fullCanonicalV21:false,authenticatedAppRestore:false}));
  }catch(e){failure=e instanceof Error?e.message:String(e);testStatus="FAIL";
    console.error("D4_LOCAL_PG16_ERROR "+failure);
  }finally{
    if(startAttempted){
      try{
        cmd(binaries.pg_ctl,["-D",data,"-m","immediate","-w","-t","45","stop"],
          {env,timeout:90000,stdio:"ignore"});
        const status=spawnSync(binaries.pg_ctl,["-D",data,"status"],{
          encoding:"utf8",env,windowsHide:true,shell:false,timeout:20000});
        assert.ok(!status.error&&!status.signal&&status.status!==null&&status.status!==0,
          "Postgres stopped state unverified");
        stoppedVerified=true;
      }catch(e){
        console.error("D4_WARNING_PG16_NOT_VERIFIED_STOPPED: owned directory retained "+parentReal);
        console.error(String(e instanceof Error?e.message:e).slice(0,500));
      }
    }else stoppedVerified=true;
    if(stoppedVerified&&existsSync(sentinel)&&readFileSync(sentinel,"utf8")===ownershipToken&&
      path.dirname(realpathSync(parentReal)).toLowerCase()===base.toLowerCase()){
      rmSync(parentReal,{recursive:true,force:false,maxRetries:3,retryDelay:600});
      console.log(JSON.stringify({phase:"D4_LOCAL_PG16_DISPOSAL",status:"PASS",
        onlyOwnedTempDirectory:true,postgresStopped:stoppedVerified}));
    }else{
      console.error("D4_CLEANUP_BLOCKED: never force-delete an unverified/running cluster "+parentReal);
      process.exitCode=1;
    }
  }
  console.log(JSON.stringify({phase:"D4_A1_OWNER_TEST_COMPLETE",testStatus,baselineStatus,securityStatus,
    isolation:initialVerified?"PASS":"NOT VERIFIED",cleanup:stoppedVerified?"STOPPED":"UNVERIFIED",
    sourceSha:expected,
    note:"A1 only: two real psql sessions with selected source-defined triggers; NOT full canonical v21 or authenticated application restore"}));
  if(failure)process.exitCode=1;
}
main().catch(e=>{console.error("D4_LOCAL_PG16_NOT_RUN "+String(e instanceof Error?e.message:e));process.exitCode=2});
