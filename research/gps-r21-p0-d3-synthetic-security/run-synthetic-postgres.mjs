#!/usr/bin/env node
/**
 * R2.1b P0-D3: disposable synthetic PostgreSQL RLS falsification ONLY.
 * NEVER loads an existing DB or any real user GPS.
 * Uses local Docker image postgres:16-alpine, with --network none and no ports.
 * SET SESSION AUTHORIZATION models role privileges, NOT real authentication.
 */
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
const ROOT=dirname(fileURLToPath(import.meta.url));
const IMAGE="postgres:16-alpine",ALPHA="r21_subject_alpha",BETA="r21_subject_beta",GAMMA="r21_subject_gamma",OTHER="r21_unrelated";
const fail=(message)=>{throw new Error(message)};
if(process.argv.slice(2).join(" ")!=="--synthetic-only")fail("Explicit --synthetic-only acknowledgement required. Nothing ran.");
// No ambient DB credentials or libpq settings, including PGOPTIONS/PGDATABASE.
// The subprocess environment is separately allowlisted and never passes these on.
for(const key of Object.keys(process.env)){
  if(["DATABASE_URL","DIRECT_URL","NEON_DATABASE_URL"].includes(key.toUpperCase())||
      /^PG[A-Z0-9_]*$/i.test(key)){
    if(process.env[key])fail("Ambient "+key+" set; refusing synthetic DB proof.");
  }
}
function docker(args,input){
  const r=spawnSync("docker",args,{encoding:"utf8",input,timeout:30000,maxBuffer:2*1024*1024,
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,HOME:process.env.HOME,
      USERPROFILE:process.env.USERPROFILE,DOCKER_HOST:process.env.DOCKER_HOST}});
  return{ok:r.status===0&&!r.error,output:String(r.stdout??"").trim(),
    error:r.error?.message??String(r.stderr??"").trim()};
}
if(process.env.DOCKER_HOST)fail("DOCKER_HOST override refused: local Docker context only.");
const cli=docker(["--version"]);
if(!cli.ok)fail("Docker CLI unavailable on PATH. Install/start Docker Desktop before retrying; no database accessed.");
const context=docker(["context","inspect","--format","{{.Endpoints.docker.Host}}"]);
// TCP and SSH contexts are refused, including localhost proxies to remote hosts.
// A local socket/pipe is only a heuristic; never use real data/credentials here.
const LOCAL_DOCKER_ENDPOINT=/^(?:npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+|unix:\/\/\/[^\s]+)$/;
if(!context.ok||!LOCAL_DOCKER_ENDPOINT.test(context.output)){
  fail("Docker context is not demonstrably local; refusing even synthetic DB creation.");
}
const image=docker(["image","inspect",IMAGE,"--format","{{.Id}}"]);
if(!image.ok||!/^sha256:[a-f0-9]{64}$/.test(image.output))
  fail("Docker image postgres:16-alpine not locally resolved to an immutable ID; no DB touched.");
if(!docker(["info","--format","{{.ServerVersion}}"]).ok)fail("Docker daemon unavailable.");
const name="flytally-r21-synthetic-"+randomUUID().slice(0,12);
let pass=0,failed=0;
const record=(name,ok,detail="")=>{
  if(ok)pass++;else failed++;
  process.stdout.write((ok?"PASS ":"FAIL ")+name+(detail?" — "+detail:"")+"\n");
};
function sql(command,role=null){
  const prefix=role?"SET SESSION AUTHORIZATION "+role+";\n":"";
  return docker(["exec","-i",name,"psql","-X","-qAt","-v","ON_ERROR_STOP=1",
    "-v","VERBOSITY=sqlstate","-U","postgres","-d","r21_synthetic_lab"],prefix+command+"\n");
}
const value=(label,statement,expected,role=ALPHA)=>{
  const r=sql(statement,role);
  record(label,r.ok&&r.output===String(expected),r.ok?"bounded synthetic output":"unexpected database error");
};
const deny=(label,statement,role=ALPHA)=>{
  const r=sql(statement,role);
  record(label,!r.ok&&/(?:42501|permission denied|query would be affected by row-level security)/i.test(r.error),
    r.ok?"unexpectedly permitted":"expected privilege denial");
};
try{
  // --pull=never prevents any implicit network fetch if the pinned local ID vanishes.
  const start=docker(["run","-d","--rm","--pull=never","--network","none","--name",name,
    "--label","flytally.purpose=synthetic-rls-research",
    "--tmpfs","/var/lib/postgresql/data:rw,nosuid,noexec,size=256m",
    "--tmpfs","/var/run/postgresql:rw,nosuid,size=16m",
    "--tmpfs","/tmp:rw,nosuid,size=16m",
    "-e","POSTGRES_PASSWORD=SYNTHETIC_NOT_A_SECRET","-e","POSTGRES_DB=r21_synthetic_lab",image.output]);
  if(!start.ok)fail("Could not start isolated synthetic DB: "+start.error.slice(0,200));
  if(!/^[a-f0-9]{64}$/.test(start.output))
    fail("Disposable container ID was not verified; no SQL executed.");
  // Verify the EFFECTIVE Docker configuration, not merely authored run flags.
  // A mismatch aborts before even SELECT 1 or schema.sql. The inspect payload
  // (including environment) is never printed or retained.
  const inspected=docker(["container","inspect","--format","{{json .}}",name]);
  let cfg=null;
  if(inspected.ok){
    try{cfg=JSON.parse(inspected.output);}catch{cfg=null;}
  }
  const tmpfsPaths=["/var/lib/postgresql/data","/var/run/postgresql","/tmp"];
  const host=cfg?.HostConfig;
  // Docker inspect can represent --tmpfs paths as a map or mount records.
  // Accept only the three expected disposable paths and no host/volume mounts.
  const observedMounts=cfg?.Mounts;
  const mountsVerified=Array.isArray(observedMounts)
    ? observedMounts.length===tmpfsPaths.length&&
      observedMounts.every(m=>m?.Type==="tmpfs"&&tmpfsPaths.includes(m.Destination))
    : observedMounts!==null&&typeof observedMounts==="object"&&
      Object.keys(observedMounts).length===tmpfsPaths.length&&
      tmpfsPaths.every(path=>Object.hasOwn(observedMounts,path));
  const isolationVerified=
    cfg?.Id===start.output&&cfg?.Name==="/"+name&&cfg?.Image===image.output&&
    cfg?.State?.Running===true&&
    cfg?.Config?.Labels?.["flytally.purpose"]==="synthetic-rls-research"&&
    host?.NetworkMode==="none"&&host?.PublishAllPorts===false&&
    host?.Privileged===false&&
    (host?.Binds==null||(Array.isArray(host.Binds)&&host.Binds.length===0))&&
    (host?.PortBindings==null||Object.keys(host.PortBindings).length===0)&&
    host?.Tmpfs!=null&&Object.keys(host.Tmpfs).length===tmpfsPaths.length&&
    tmpfsPaths.every(path=>Object.hasOwn(host.Tmpfs,path))&&
    mountsVerified;
  if(!inspected.ok||!isolationVerified)
    fail("Disposable Docker isolation configuration not verified; no SQL executed.");
  let ready=false;
  for(let i=0;i<25;i++){
    if(docker(["exec",name,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","r21_synthetic_lab","-c","SELECT 1"]).ok){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  if(!ready)fail("Disposable Postgres not ready.");
  const created=sql("SET r21.synthetic_only = 'NO_NETWORK_TEST_CONTAINER';\n"+readFileSync(join(ROOT,"schema.sql"),"utf8"));
  if(!created.ok)fail("Synthetic SQL schema failed: "+created.error.slice(0,330));
  if(sql("SELECT current_database();").output!=="r21_synthetic_lab")fail("Unexpected database target.");
  process.stdout.write("SYNTHETIC ONLY: local isolated PostgreSQL, no production credentials, no ports.\n");
  value("S05 alpha unfiltered SELECT remains scoped","SELECT count(*) FROM r21_lab.tracks;",2);
  value("S05 beta unfiltered SELECT remains scoped","SELECT count(*) FROM r21_lab.tracks;",1,BETA);
  value("S05 alpha WHERE beta cannot read beta","SELECT count(*) FROM r21_lab.tracks WHERE owner_role='r21_subject_beta';",0);
  value("S05 beta WHERE alpha cannot read alpha","SELECT count(*) FROM r21_lab.tracks WHERE owner_role='r21_subject_alpha';",0,BETA);
  value("S05 WHERE TRUE still scoped","SELECT count(*) FROM r21_lab.tracks WHERE TRUE;",2);
  // Gamma has actual USAGE+SELECT but deliberately has NO applicable RLS policy.
  value("S05 gamma has object SELECT permission",
    "SELECT (has_schema_privilege(current_user,'r21_lab','USAGE') AND has_table_privilege(current_user,'r21_lab.tracks','SELECT'))::integer;",1,GAMMA);
  value("S05 gamma granted SELECT but default-denied by RLS","SELECT count(*) FROM r21_lab.tracks;",0,GAMMA);
  value("S22 shared-flight participant lacks source ownership","SELECT count(*) FROM r21_lab.tracks WHERE flight_id=201;",0);
  value("S07 both tables have forced RLS","SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='r21_lab' AND c.relname IN ('tracks','flights') AND c.relrowsecurity AND c.relforcerowsecurity;",2,null);
  value("S07 restricted roles have no login, bypass or superuser powers",
    "SELECT count(*) FROM pg_roles WHERE rolname IN ('r21_subject_alpha','r21_subject_beta','r21_subject_gamma','r21_unrelated') AND NOT rolsuper AND NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls;",4,null);
  value("S07 no inherited membership for restricted roles",
    "SELECT count(*) FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('r21_subject_alpha','r21_subject_beta','r21_subject_gamma','r21_unrelated'));",0,null);
  value("S19 definer EXECUTE privilege revoked for subject",
    "SELECT (NOT has_function_privilege(current_user,'r21_lab.admin_count()','EXECUTE'))::integer;",1);
  value("S11 null altitude remains distinguishable from zero","SELECT count(*) FROM r21_lab.tracks WHERE payload->0->>'alt' IS NULL;",1);
  value("S23 fresh beta session not contaminated by alpha","SELECT count(*) FROM r21_lab.tracks;",1,BETA);
  deny("S06 INSERT denied","INSERT INTO r21_lab.tracks(id,flight_id,owner_role,payload) VALUES(999,101,'r21_subject_alpha','[]');");
  deny("S06 UPDATE denied","UPDATE r21_lab.tracks SET payload='[]' WHERE id=1001;");
  deny("S06 DELETE denied","DELETE FROM r21_lab.tracks WHERE id=1001;");
  deny("S06 TRUNCATE denied","TRUNCATE r21_lab.tracks;");
  deny("S06 CREATE TABLE denied","CREATE TABLE r21_lab.injected(id integer);");
  deny("S06 ALTER TABLE denied","ALTER TABLE r21_lab.tracks ADD COLUMN injected integer;");
  deny("S06 DROP TABLE denied","DROP TABLE r21_lab.tracks;");
  deny("S06 CREATE TEMP TABLE denied","CREATE TEMP TABLE injected(id integer);");
  deny("S06 sequence nextval denied","SELECT nextval('r21_lab.internal_sequence');");
  deny("S07 SET ROLE beta denied","SET ROLE r21_subject_beta;");
  deny("S07 GRANT role beta denied","GRANT r21_subject_beta TO r21_subject_alpha;");
  deny("S07 ALTER ROLE beta BYPASSRLS denied","ALTER ROLE r21_subject_beta BYPASSRLS;");
  deny("S07 unrelated role denied","SELECT count(*) FROM r21_lab.tracks;",OTHER);
  deny("S07 participant relation denied","SELECT count(*) FROM r21_lab.participants;");
  deny("S19 SECURITY DEFINER call denied","SELECT r21_lab.admin_count();");
  deny("S14 row_security off cannot bypass policy","SET row_security=off; SELECT count(*) FROM r21_lab.tracks;");
  const copy=sql("COPY (SELECT id FROM r21_lab.tracks ORDER BY id) TO STDOUT;",ALPHA);
  record("S06 COPY may emit authorized IDs only",copy.ok&&copy.output==="1001\n1002");
  const count=sql("SELECT count(*) FROM r21_lab.tracks;");
  record("S06 no source track mutation",count.ok&&count.output==="3");
  if(failed)fail(String(failed)+" of "+String(failed+pass)+" synthetic DB assertions FAILED.");
  process.stdout.write("SYNTHETIC DB ROLE CHECKS PASS: "+String(pass)+" assertions; NOT full S01–S23 or real Neon proof.\n");
}finally{
  // --rm can auto-delete an exited container. rm may then return nonzero.
  // Never turn a daemon error into a false PASS: require a successful independent
  // absence check whether removal succeeded or not.
  const removed=docker(["rm","-f",name]);
  const remaining=docker(["ps","-aq","--filter","name=^/"+name+"$"]);
  if(!remaining.ok||remaining.output!==""){
    process.stderr.write("FAIL: disposable synthetic container absence not verified; inspect Docker before retry.\n");
    process.exitCode=1;
  }else if(removed.ok){
    process.stdout.write("Disposable synthetic PostgreSQL container removed and absence verified.\n");
  }else{
    process.stdout.write("Disposable synthetic PostgreSQL container already absent; absence verified.\n");
  }
}
