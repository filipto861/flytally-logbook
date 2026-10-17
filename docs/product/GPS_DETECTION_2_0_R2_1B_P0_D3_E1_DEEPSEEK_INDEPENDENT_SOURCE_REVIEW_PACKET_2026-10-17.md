# E1 independent reviewer packet — pre-SQL Docker isolation attestation

**Review requested / NOT RECEIVED. Prepared 2026-10-17.**
**Repository:** `filipto861/flytally-logbook`.
**Pinned source:** `83eaec732b5a6190a959b0dfd356006939e70edf` (Draft PR #355, stacked on #354). All four exact GitHub files below are embedded; reviewer does **not** need private GitHub access. Source contains fictional Postgres GPS rows and an explicitly synthetic password only; no real GPS data, secret or production connection is provided.

## Independent reviewer assignment

Perform a **read-only, adversarial source-level review** of the E1 addition and its interaction with the earlier D3 runner. Do **not** use Docker, PostgreSQL, Neon, network or private GitHub; do **not** run the scripts. Do not equate source review, Node static tests or consensus with executed RLS enforcement.

Review the actual logic, including:
- Docker image pinning `image inspect -> sha256 -> docker run --pull=never image ID`, and preflight Docker context/daemon locality heuristic.
- E1 `docker container inspect --format '{{json .}}'` **before the first runner `psql` / `schema.sql`**, `cfg` parsing, ID/name/image/state/label, `HostConfig`, `Mounts`, port bindings, privileges, tmpfs paths/options, unseen volumes, side-channel outputs, and time-of-check/time-of-use.
- The two inspector representations documented by Docker: `--mount type=tmpfs` yields `Mounts: [{Type:'tmpfs', Destination:'/app',...}]`, while `--tmpfs /app` may yield `Mounts: {'/app':''}`. Is E1 handling correct and **overly strict or too permissive**?
- Official PostgreSQL container image startup behavior, inherited image `VOLUME`, daemon defaults, automatic initialization *before* runner's SQL/inspect checks, and cleanup when `docker run` succeeds/fails/partial output or `--rm` auto-removes.
- Existing `sql()/value()/deny()` fixture-privilege probes; how many are **actually SQL policy checks** and which are privilege-only negative probes? `NOLOGIN` roles plus privileged `SET SESSION AUTHORIZATION` must **not** be described as real login/Neon identity.
- Windows Docker Desktop `npipe:////./pipe/docker_engine` versus Docker server Linux engine, `unix` endpoints, `DOCKER_CONTEXT`/context inheritance, `docker ps` cleanup verification, shell/Node/PowerShell compatibility.

## Existing evidence and frozen constraints

- Owner already proved **clean exact code SHA `2e362aeeafe7d816c53c74c61d4c761927d56a22`**: `node --check` PASS; **24/24** D3 targeted Node **static/mock/early-refusal** tests PASS, 0 skipped; `npm run typecheck` PASS. This is owner-local **NOT CI**. Following documentation-only HEAD `83eaec732b5a6190a959b0dfd356006939e70edf` did not change executable files and was not retested.
- **Docker container actually running: NOT RUN. PostgreSQL statements/RLS: NOT RUN. Overall D3 security gate OPEN.**
- No installed/usable Postgres native `initdb/pg_ctl/psql` proven on owner PATH. No Docker required for ordinary FlyTally development; optional synthetic environment only, if separately approved and available.
- Existing `run-local-gates.ps1` pins a different D3 branch and default `PostgresProvider=none`; preserve the fail-closed guard. Never invoke it from this E1 branch by bypassing the branch check.
- Absolutely **NO-GO** for real GPS, Neon/production DB, migrations/roles/grants, live auth/API, individual owner trace, cross-account research, model training, deployment or main merge.
- Previous DeepSeek F01–F14 D3 review was **partial SOURCE ONLY** and completed before E1; **E1 independent external review is PENDING**. The reviewer must not implicitly inherit an earlier sign-off.

## ChatGPT preliminary code review — independently challenge each observation

| ID | Finding / hypothesis | Why it matters |
| --- | --- | --- |
| E1-R01 | `--tmpfs` `Mounts` map representation is **supported by Docker documentation** and E1 allows both map and array | This portion should not be condemned solely for using a map; actual Docker API output has not been measured |
| E1-R02 | E1 map branch checks only three **keys**, not their value representation or effective mount options; `HostConfig.Tmpfs` also checks path keys but not `nosuid/noexec/size` | Ask whether this can create a false-isolation PASS or mainly test robustness gaps; specify meaningful, stable checks and precise repro |
| E1-R03 | Network check examines `HostConfig.NetworkMode=none` but not the full inspected `NetworkSettings` or unexpected daemon connectivity | Distinguish default network namespace from guarantees about Docker daemon/locality and physical network path |
| E1-R04 | Preflight occurs **after container startup**; official Postgres entrypoint initializes a new DB before the runner's explicit schema. `inspect` before `psql` is true, "no database activity before inspect" is **not** true | Precise trust-boundary language. Is initialization safe for synthetic-only local image? |
| E1-R05 | Runner's targeted suite source-searches for guard strings and order. No Docker-free dynamic fake-Docker black-box tests exercise malformed JSON, wrong ID/label, injected volume, unexpected port, failed cleanup | Determine whether such a fake executable/fake Docker transcript test is worth implementing *before* actual Docker opt-in |
| E1-R06 | Cleanup `rm -f` + `ps -aq --filter name=^/NAME$` claims successful absence, but runner doesn't bind removal to the just-created **container ID** and relies on CLI list results | Could name reuse/race/context switching cause false PASS? Give synthetic reproduction without real production |
| E1-R07 | `docker run` image ID came from local tag, not a signed/reviewed image digest. `npipe/unix` endpoint is an unverified locality heuristic | Do not describe these as image authenticity or local-host attestation |
| E1-R08 | `cfg.Mounts` object/array, `HostConfig.Tmpfs` and `PortBindings` may differ by daemon API version/engine | Decide whether strict false-negative is safer than permissive normalization and explicitly preserve fail-closed behavior |

These are **source-derived concerns, not proven exploitable issues**; reviewer should reject unsupported ones rather than rubber-stamp.

## Required review output

Give an actionable table: **Finding | Severity | Exact file/line or snippet | Mechanism | Synthetic-only reproducibility | Narrow safe remediation | Evidence confidence**. For each E1 predicate classify `SOURCE_ASSERTED`, `OFFLINE_DYNAMIC_TESTED`, `DOCKER_RUNTIME_NOT_RUN`, or `NEEDS DB`. Specifically answer:

1. Is the E1 source acceptably **safe to test later on an isolated disposable PG16 container**, assuming explicit owner opt-in? Or **must fix before any Docker run**?
2. Which effective-inspect conditions are false positives/negatives in Docker Desktop on Windows, and how can we verify this without relaxing isolation?
3. Should the next **minimal** milestone be read-only documentation, one black-box mocked-`docker` Node test batch (with no daemon), or a narrowed code fix?
4. What exactly remains unproved for true Postgres role/RLS, real authenticated LOGIN/driver, and trusted per-owner GPS source? State separate GO/NO-GO decisions.

Maintain user priorities: correctness > convenience, fail-closed > guesses, stable production/no deploy, minimal blast radius and **Docker optional**.

## Grounding references for reviewer

- Docker tmpfs: https://docs.docker.com/engine/storage/tmpfs/
- Docker inspect: https://docs.docker.com/reference/cli/docker/inspect/
- Docker context inspect: https://docs.docker.com/reference/cli/docker/context/inspect/
- Docker `docker ps`: https://docs.docker.com/reference/cli/docker/container/ls/
- PostgreSQL 16 row security: https://www.postgresql.org/docs/16/ddl-rowsecurity.html

## Exact source appendices — fetched from pinned commit

### Appendix 1: `research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs` (Git blob SHA `9f7aebd4bd014226d1dd66efeb11062b72e7cd37`)

```javascript
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
```

### Appendix 2: `tests/gps-r21-p0-d3-synthetic-security.test.ts` (Git blob SHA `8064eed96d643fe94c333897fc4a138baa49d3eb`)

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {evaluateSyntheticGrant,withSyntheticAuthorization,type MockGrant,type MockRequest} from "../research/gps-r21-p0-d3-synthetic-security/mock-authorization.ts";

const grant:MockGrant={subject:"r21_subject_alpha",trackIds:[1001,1002],expiresAtMs:2000,revoked:false};
const req:MockRequest={principal:"r21_subject_alpha",trackId:1001,trackOwner:"r21_subject_alpha",nowMs:1000};
const denied={status:"DENY",reason:"NOT_AUTHORIZED"};

test("S01 mock authorization missing principal or grant fails before any read",()=>{
  let reads=0;
  assert.deepEqual(withSyntheticAuthorization(null,req,()=>++reads),denied);
  assert.deepEqual(withSyntheticAuthorization(grant,{...req,principal:null},()=>++reads),denied);
  assert.equal(reads,0);
});
test("S02 S09 revoked or expired mock grant never accesses synthetic source",()=>{
  let reads=0;
  for(const g of [{...grant,revoked:true},{...grant,expiresAtMs:1000}]){
    assert.deepEqual(withSyntheticAuthorization(g,req,()=>++reads),denied);
  }
  assert.deepEqual(withSyntheticAuthorization(grant,{...req,nowMs:2000},()=>++reads),denied);
  assert.equal(reads,0);
});
test("S03 wrong mock subject, swapped grant or track owner returns opaque deny",()=>{
  let reads=0;
  const wrong:MockRequest={...req,principal:"r21_subject_beta"};
  assert.deepEqual(withSyntheticAuthorization(grant,wrong,()=>++reads),denied);
  assert.deepEqual(withSyntheticAuthorization(grant,{...req,trackOwner:"r21_subject_beta"},()=>++reads),denied);
  assert.deepEqual(withSyntheticAuthorization({...grant,subject:"r21_subject_beta"},req,()=>++reads),denied);
  assert.equal(reads,0);
});
test("S04 S22 a fictional shared-flight participant does not own another's track",()=>{
  let reads=0;
  assert.deepEqual(withSyntheticAuthorization(grant,{...req,trackId:2001,trackOwner:"r21_subject_beta"},()=>++reads),denied);
  assert.equal(reads,0);
});
test("S01 scoped, non-expired fictional grant invokes selector exactly once",()=>{
  let reads=0;
  assert.deepEqual(withSyntheticAuthorization(grant,req,()=>++reads),{status:"ALLOW",result:1});
  assert.equal(reads,1);
});
test("S18 malformed, unlisted or fractional synthetic track id fails closed",()=>{
  for(const id of [9999,Number.NaN,1001.5,Number.MAX_SAFE_INTEGER+1]){
    assert.deepEqual(evaluateSyntheticGrant(grant,{...req,trackId:id}),denied);
  }
});
const dir=join(process.cwd(),"research","gps-r21-p0-d3-synthetic-security");
const schema=()=>readFileSync(join(dir,"schema.sql"),"utf8");
const runner=()=>readFileSync(join(dir,"run-synthetic-postgres.mjs"),"utf8");
test("P0-D3 fixture is synthetic, force-enables RLS on both owner relations",()=>{
  const s=schema();
  assert.match(s,/CREATE ROLE r21_subject_alpha NOLOGIN NOINHERIT NOBYPASSRLS/);
  assert.match(s,/CREATE ROLE r21_subject_beta NOLOGIN NOINHERIT NOBYPASSRLS/);
  assert.match(s,/ALTER TABLE r21_lab\.tracks FORCE ROW LEVEL SECURITY/);
  assert.match(s,/ALTER TABLE r21_lab\.flights FORCE ROW LEVEL SECURITY/);
  assert.match(s,/owner_role = CURRENT_USER::name/);
  assert.match(s,/REVOKE ALL ON FUNCTION r21_lab\.admin_count\(\) FROM PUBLIC/);
});
test("P0-D3 operator runner isolates Docker without ports, mounts or existing credentials",()=>{
  const s=runner();
  assert.match(s,/--network","none"/);
  assert.match(s,/--rm/);
  assert.match(s,/--tmpfs/);
  assert.match(s,/DATABASE_URL/);
  assert.match(s,/--synthetic-only/);
  assert.match(s,/image","inspect/);
  assert.match(s,/rm","-f",name/);
  assert.doesNotMatch(s,/from\s+["\x27][^"\x27]*(?:lib\/db|require-user)/);
});
test("P0-D3 test inventory includes omitted-WHERE and physical denial probes",()=>{
  const s=runner();
  for(const item of ["S05 alpha unfiltered SELECT","S06 INSERT denied","S06 UPDATE denied",
    "S06 DELETE denied","S06 TRUNCATE denied","S07 SET ROLE beta denied",
    "S19 SECURITY DEFINER call denied","S22 shared-flight participant",
    "S14 row_security off cannot bypass policy"]){
    assert.ok(s.includes(item),item);
  }
});

test("runner does not start Docker or DB without explicit --synthetic-only flag",()=>{
  const run=spawnSync(process.execPath,[join(dir,"run-synthetic-postgres.mjs")],{
    encoding:"utf8",timeout:5000,
    env:{...process.env,DATABASE_URL:"",DIRECT_URL:"",NEON_DATABASE_URL:"",PGHOST:"",PGSERVICE:"",PGUSER:"",PGPASSWORD:""}
  });
  assert.notEqual(run.status,0);
  assert.match(String(run.stderr),/Explicit --synthetic-only acknowledgement required/);
});
test("runner rejects any ambient production-like DATABASE_URL before Docker operation",()=>{
  const run=spawnSync(process.execPath,[join(dir,"run-synthetic-postgres.mjs"),"--synthetic-only"],{
    encoding:"utf8",timeout:5000,
    env:{...process.env,DATABASE_URL:"postgresql://example.invalid/forbidden",
      DIRECT_URL:"",NEON_DATABASE_URL:"",PGHOST:"",PGSERVICE:"",PGUSER:"",PGPASSWORD:""}
  });
  assert.notEqual(run.status,0);
  assert.match(String(run.stderr),/Ambient DATABASE_URL set/);
});
test("SQL fixtures reject execution without the disposable sandbox marker and DB name",()=>{
  assert.match(schema(),/current_database\(\) <> 'r21_synthetic_lab'/);
  assert.match(schema(),/current_setting\('r21\.synthetic_only',true\)/);
  assert.match(runner(),/POSTGRES_DB=r21_synthetic_lab/);
  assert.match(runner(),/DOCKER_HOST override refused/);
});

test("P0-D3 missing Docker executable is a specific early no-database failure",()=>{
  const run=spawnSync(process.execPath,[join(dir,"run-synthetic-postgres.mjs"),"--synthetic-only"],{
    encoding:"utf8",timeout:5000,
    // A deliberately empty search path simulates 'docker' not found. This runs
    // no containers, has no database URL and uses only the absolute Node binary.
    env:{NODE_ENV:"test",SystemRoot:process.env.SystemRoot??"",PATH:"",Path:"",
      USERPROFILE:process.env.USERPROFILE??"",HOME:process.env.HOME??""}
  });
  assert.notEqual(run.status,0);
  assert.match(String(run.stderr),/Docker CLI unavailable on PATH/);
  assert.doesNotMatch(String(run.stderr),/Docker context is not demonstrably local/);
});

const gates=()=>readFileSync(join(dir,"run-local-gates.ps1"),"utf8");
test("P0-D3 default local check omits Docker and records unexecuted RLS separately",()=>{
  const s=gates();
  assert.match(s,/\[string\] \$PostgresProvider = "none"/);
  assert.match(s,/if \(\$PostgresProvider -eq "none"\)/);
  assert.match(s,/NOT RUN - PostgreSQL role\/RLS tests/);
  assert.match(s,/OVERALL P0-D3 SECURITY GATE OPEN/);
  assert.match(s,/if \(-not \(Get-Command docker -ErrorAction SilentlyContinue\)\)/);
  assert.match(s,/Get-Command \$_ -ErrorAction SilentlyContinue/);
  assert.ok(s.indexOf('if ($PostgresProvider -eq "none")') < s.indexOf('Get-Command docker'));
});
test("P0-D3 optional local wrapper pins exact SHA and rejects dirty/wrong branch",()=>{
  const s=gates();
  assert.match(s,/\[ValidatePattern\('\^\[0-9a-fA-F\]\{40\}\$'\)\]/);
  assert.match(s,/git branch --show-current/);
  assert.match(s,/git rev-parse HEAD/);
  assert.match(s,/git status --porcelain/);
  assert.match(s,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Repository TypeScript typecheck FAILED" \}/);
  assert.match(s,/run-synthetic-postgres\.mjs --synthetic-only/);
  assert.doesNotMatch(s,/docker pull|npm run test:postgres/);
});

test("P0-D3 PowerShell 5.1 runner has ASCII-only source and safe quote boundaries",()=>{
  const s=gates();
  const invalid=[...s].filter(ch=>(ch.codePointAt(0)??0)>127);
  assert.deepEqual(invalid,[],"Windows PowerShell 5.1 must not misdecode UTF-8 non-ASCII without BOM");
  assert.match(s,/Write-Host "PASS - synthetic Node tests and TypeScript/);
  assert.match(s,/Write-Host "NOT RUN - PostgreSQL role\/RLS tests/);
  assert.match(s,/OVERALL P0-D3 SECURITY GATE OPEN - missing real PostgreSQL RLS evidence/);
});



test("P0-D3 reviewer F05 image is pinned to a local immutable ID and never implicitly pulled",()=>{
  const s=runner();
  assert.ok(s.includes('docker(["image","inspect",IMAGE,"--format","{{.Id}}"])'));
  assert.ok(s.includes('/^sha256:[a-f0-9]{64}$/'));
  assert.ok(s.includes('"--pull=never"'));
  assert.ok(s.includes('"POSTGRES_DB=r21_synthetic_lab",image.output]'));
  assert.ok(!s.includes('"POSTGRES_DB=r21_synthetic_lab",IMAGE]'));
});

test("P0-D3 reviewer F06 cleanup cannot falsely PASS if absence is unverified",()=>{
  const s=runner();
  assert.ok(s.includes('const removed=docker(["rm","-f",name])'));
  assert.ok(s.includes('const remaining=docker(["ps","-aq","--filter"'));
  assert.ok(s.includes('if(!remaining.ok||remaining.output!=="")'));
  assert.ok(s.includes("container absence not verified"));
  assert.ok(s.includes("container already absent; absence verified"));
});

test("P0-D3 reviewer F04 policy distinguishes authorized SELECT from RLS row filtering",()=>{
  const sql=schema(),s=runner();
  assert.ok(sql.includes("CREATE ROLE r21_subject_gamma NOLOGIN NOINHERIT NOBYPASSRLS"));
  assert.ok(sql.includes("GRANT USAGE ON SCHEMA r21_lab TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma"));
  assert.ok(sql.includes("GRANT SELECT ON r21_lab.flights,r21_lab.tracks TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma"));
  assert.ok(sql.includes("FOR SELECT TO r21_subject_alpha,r21_subject_beta"));
  assert.ok(!sql.includes("FOR SELECT TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma"));
  assert.ok(s.includes("S05 gamma has object SELECT permission"));
  assert.ok(s.includes("S05 gamma granted SELECT but default-denied by RLS"));
  assert.ok(s.includes("has_table_privilege(current_user"));
});

test("P0-D3 reviewer F08 TCP Docker contexts are rejected, not mistaken for local",()=>{
  const s=runner();
  assert.ok(s.includes("LOCAL_DOCKER_ENDPOINT="));
  assert.ok(s.includes("LOCAL_DOCKER_ENDPOINT.test(context.output)"));
  assert.ok(!s.includes("tcp:\\/\\/"));
  assert.ok(s.includes("Docker context is not demonstrably local"));
});

test("P0-D3 reviewer F10 checks role catalogs and representative DDL denials",()=>{
  const s=runner();
  for(const marker of [
    "pg_auth_members","NOT rolbypassrls",
    "S06 ALTER TABLE denied","S06 DROP TABLE denied",
    "S06 CREATE TEMP TABLE denied","S07 GRANT role beta denied",
    "S07 ALTER ROLE beta BYPASSRLS denied",
    "S19 definer EXECUTE privilege revoked for subject"
  ])assert.ok(s.includes(marker),marker);
});

test("P0-D3 reviewer F12 refuses PGOPTIONS before executing any Docker binary",()=>{
  const run=spawnSync(process.execPath,[join(dir,"run-synthetic-postgres.mjs"),"--synthetic-only"],{
    encoding:"utf8",timeout:5000,
    env:{NODE_ENV:"test",SystemRoot:process.env.SystemRoot??"",PATH:"",Path:"",
      USERPROFILE:process.env.USERPROFILE??"",HOME:process.env.HOME??"",
      PGOPTIONS:"-c statement_timeout=0"}
  });
  assert.notEqual(run.status,0);
  assert.match(String(run.stderr),/Ambient PGOPTIONS set/);
  assert.doesNotMatch(String(run.stderr),/Docker CLI unavailable on PATH/);
});


test("P0-D3 E1 effective container configuration is checked before any SQL",()=>{
  const s=runner();
  const inspected=s.indexOf('const inspected=docker(["container","inspect","--format","{{json .}}",name]);');
  const ready=s.indexOf("let ready=false;");
  const fixture=s.indexOf('readFileSync(join(ROOT,"schema.sql"),"utf8")');
  assert.ok(inspected>=0&&ready>inspected&&fixture>ready,"inspect must precede readiness probe and fixture");
  for(const field of [
    "cfg?.Id===start.output","cfg?.Name","cfg?.Image===image.output",
    "cfg?.State?.Running===true","synthetic-rls-research",
    'host?.NetworkMode==="none"','host?.PublishAllPorts===false',
    "host?.Privileged===false","host?.Binds==null",
    "host?.PortBindings","host?.Tmpfs",
    "m?.Type","m.Destination","mountsVerified"
  ])assert.ok(s.includes(field),field);
  assert.ok(s.includes('fail("Disposable Docker isolation configuration not verified; no SQL executed.")'));
});

test("P0-D3 E1 pre-SQL inspection must neither print Docker config nor skip cleanup",()=>{
  const s=runner();
  assert.ok(s.includes("try{cfg=JSON.parse(inspected.output);}catch{cfg=null;}"));
  assert.ok(s.includes("if(!inspected.ok||!isolationVerified)"));
  assert.ok(s.indexOf("const inspected=docker(")>s.indexOf("try{\n  // --pull=never"));
  assert.ok(s.includes('const removed=docker(["rm","-f",name]);'));
  assert.ok(s.includes('if(!remaining.ok||remaining.output!=="")'));
  assert.ok(!s.includes("console.log(inspected.output)"));
  assert.ok(!s.includes("process.stdout.write(inspected.output)"));
});
```

### Appendix 3: `research/gps-r21-p0-d3-synthetic-security/schema.sql` (Git blob SHA `55e5fbd456cf9ca02888d99236cf023c59b1607b`)

```sql
-- FlyTally GPS R2.1b-P0-D3: SYNTHETIC, THROWAWAY PostgreSQL PROOF ONLY.
-- NEVER execute against Neon, FlyTally production, or an existing user DB.
-- The runner runs this only in its own --network none, no-ports Docker container.
-- IDs, roles, and GPS payloads are fictitious; no actual flight data.
\set ON_ERROR_STOP on
DO $r21_guard$
BEGIN
  IF current_database() <> 'r21_synthetic_lab' OR
     current_setting('r21.synthetic_only',true) IS DISTINCT FROM 'NO_NETWORK_TEST_CONTAINER' THEN
    RAISE EXCEPTION 'Synthetic-only PostgreSQL fixture: runner marker missing';
  END IF;
END
$r21_guard$;
CREATE SCHEMA r21_lab;
CREATE ROLE r21_subject_alpha NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r21_subject_beta NOLOGIN NOINHERIT NOBYPASSRLS;
-- Gamma deliberately has SELECT privileges without an applicable RLS policy.
CREATE ROLE r21_subject_gamma NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE r21_unrelated NOLOGIN NOINHERIT NOBYPASSRLS;
REVOKE TEMPORARY ON DATABASE r21_synthetic_lab FROM PUBLIC;
CREATE TABLE r21_lab.flights (
  id integer PRIMARY KEY,
  owner_role name NOT NULL,
  UNIQUE (id, owner_role)
);
CREATE TABLE r21_lab.tracks (
  id integer PRIMARY KEY,
  flight_id integer NOT NULL,
  owner_role name NOT NULL,
  payload jsonb NOT NULL,
  FOREIGN KEY (flight_id,owner_role) REFERENCES r21_lab.flights(id,owner_role)
);
CREATE TABLE r21_lab.participants (
  flight_id integer NOT NULL REFERENCES r21_lab.flights(id),
  participant_role name NOT NULL
);
CREATE SEQUENCE r21_lab.internal_sequence;
CREATE FUNCTION r21_lab.admin_count() RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,r21_lab
  AS $$ SELECT count(*)::integer FROM r21_lab.tracks $$;
REVOKE ALL ON FUNCTION r21_lab.admin_count() FROM PUBLIC;
-- A superuser-owned SECURITY DEFINER would bypass RLS if granted EXECUTE.
-- This fixture is intentionally kept revoked as an adversarial negative object.
REVOKE ALL ON SCHEMA r21_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA r21_lab TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma;
GRANT SELECT ON r21_lab.flights,r21_lab.tracks TO r21_subject_alpha,r21_subject_beta,r21_subject_gamma;
INSERT INTO r21_lab.flights VALUES
  (101,'r21_subject_alpha'),(102,'r21_subject_alpha'),(201,'r21_subject_beta');
INSERT INTO r21_lab.tracks VALUES
  (1001,101,'r21_subject_alpha','[{"lat":0,"lon":0,"alt":null,"time":null}]'::jsonb),
  (1002,102,'r21_subject_alpha','[{"lat":0,"lon":0,"alt":0,"time":null}]'::jsonb),
  (2001,201,'r21_subject_beta','[{"lat":0,"lon":0,"alt":null,"time":null}]'::jsonb);
-- An alpha participant on beta's flight is NOT beta track ownership.
INSERT INTO r21_lab.participants VALUES (201,'r21_subject_alpha');
ALTER TABLE r21_lab.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.flights FORCE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE r21_lab.tracks FORCE ROW LEVEL SECURITY;
CREATE POLICY flights_by_login_role ON r21_lab.flights
  FOR SELECT TO r21_subject_alpha,r21_subject_beta
  USING (owner_role = CURRENT_USER::name);
CREATE POLICY tracks_by_login_role ON r21_lab.tracks
  FOR SELECT TO r21_subject_alpha,r21_subject_beta
  USING (
    owner_role = CURRENT_USER::name AND EXISTS (
      SELECT 1 FROM r21_lab.flights AS f
      WHERE f.id = r21_lab.tracks.flight_id
        AND f.owner_role = CURRENT_USER::name
    )
  );
-- The high-privilege setup role is used ONLY to create isolated fake fixtures.
-- Subject tests use SET SESSION AUTHORIZATION in fresh psql processes to verify
-- effective permissions. This models DB subject scoping, NOT identity issuance.
```

### Appendix 4: `research/gps-r21-p0-d3-synthetic-security/run-local-gates.ps1` (Git blob SHA `ee2faaff21014b0b95ca6e31532e3f0a9207eedb`)

```powershell
# R2.1b P0-D3 local security checks - Docker-optional, SYNTHETIC ONLY.
# Run from FlyTally Logbook repo root, e.g.:
# & .\research\gps-r21-p0-d3-synthetic-security\run-local-gates.ps1 -ExpectedSha <full-SHA>
# Default runs NO database, creates NO containers and uses NO secrets.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string] $ExpectedSha,

    [ValidateSet("none", "docker")]
    [string] $PostgresProvider = "none"
)

$ErrorActionPreference = "Stop"

$expectedBranch = "test/gps-r21-p0-d3-synthetic-security"
$actualBranch = (& git branch --show-current)
if ($LASTEXITCODE -ne 0 -or $actualBranch.Trim() -ne $expectedBranch) {
    throw "Expected isolated synthetic-security branch. Do not run from another branch."
}

$actualSha = (& git rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $actualSha.Trim() -ne $ExpectedSha) {
    throw "Unexpected HEAD. Inspect PR #351 and pin the exact current SHA."
}
$workingTree = (& git status --porcelain)
if ($LASTEXITCODE -ne 0 -or $workingTree) {
    throw "Working tree is not clean; aborting before any test."
}

Write-Host "Synthetic-only research verification, SHA $actualSha"
& npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts
if ($LASTEXITCODE -ne 0) { throw "Synthetic Node/static security tests FAILED" }

& npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Repository TypeScript typecheck FAILED" }

Write-Host "PASS - synthetic Node tests and TypeScript (owner-local; not CI)"

if ($PostgresProvider -eq "none") {
    $nativeTools = @("initdb", "pg_ctl", "psql")
    $nativeFound = @($nativeTools | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue })
    if ($nativeFound.Count -eq 3) {
        Write-Host "DISCOVERED - native PostgreSQL tools on PATH, but no independently verified disposable native cluster."
        Write-Host "NOT RUN - native PostgreSQL RLS (requires a separately reviewed safe ephemeral-cluster runner)."
    } else {
        Write-Host "NOT DETECTED - complete native PostgreSQL initdb/pg_ctl/psql toolchain on PATH."
    }
    Write-Host "NOT RUN - PostgreSQL role/RLS tests: no isolated DB provider selected."
    Write-Host "OVERALL P0-D3 SECURITY GATE OPEN - missing real PostgreSQL RLS evidence."
    return
}

# Explicit opt-in: optional Docker test provider, never used by the default flow.
# No fallback to an existing local PostgreSQL, application DATABASE_URL or Neon.
if ($PostgresProvider -ne "docker") {
    throw "Unsupported provider. No PostgreSQL test started."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI unavailable; RLS NOT RUN. Do not substitute another database."
}
& docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw "Docker engine unavailable; RLS NOT RUN" }
& docker image inspect postgres:16-alpine --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw "Local test image missing; RLS NOT RUN" }

# The runner additionally rejects ambient DATABASE_URL / PG* credentials,
# remote Docker contexts, missing flags and unsafe fixture initialization.
& node research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs --synthetic-only
if ($LASTEXITCODE -ne 0) { throw "Isolated synthetic PostgreSQL RLS proof FAILED" }

Write-Host "PASS - optional isolated synthetic PostgreSQL RLS probes"
Write-Host "R2.1b-P0-D3 SYNTHETIC LOCAL GATES PASS - NOT production/Neon authorization"
```

**Evidence boundary:** GitHub source files were read at exact pin `83eaec732b5a6190a959b0dfd356006939e70edf`. Packet authored but **no external E1 reviewer response received**, no tests or DB executed in preparation. PR #355 remains Draft.
