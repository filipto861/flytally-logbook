# FlyTally GPS Detection 2.0 P0-D3 E1a — Independent DeepSeek implementation review

**Prepared:** 2026-10-17. **INDEPENDENT REVIEW REQUESTED, NOT RECEIVED.**
**Read-only source review; NO Docker, PostgreSQL, Neon, external DB, API, real GPS, Node or PowerShell execution authorized to reviewer.**

Repo `filipto861/flytally-logbook` ONLY (NOT `flytally-training`).
Frozen E1a PR #357 [Draft](https://github.com/filipto861/flytally-logbook/pull/357), branch `fix/gps-r21-p0-d3-e1a-mock-docker`.
**Pinned complete GitHub HEAD:** `49366538b78d6ffa8772f461c1470b5563367d59`; **pinned locally tested executable revision:** `54ea8aeea4c848a4d79cfdf6f11fd5cdae4e242e`.
Four GitHub commits between the code-test SHA and pinned HEAD are docs-only (ROADMAP, FEATURES, CHANGELOG and E1a contract), confirmed via GitHub compare. Never claim new HEAD directly test-executed.

## 1. Task to DeepSeek

Conduct **independent adversarial implementation review** of E1a, not a speculative redesign. Evaluate actual Docker/SQL isolation failure modes and the validity of the *current* tests by reading the seven exact source files appended below. Cite file and line/snippet. Source-review confidence is distinct from empirical runtime evidence. **Challenge ChatGPT and earlier DeepSeek E1 conclusions**; reject unsupported severity.

A focused acceptance decision is wanted: `SAFE TO PROCEED TO OWNER-OPTIONAL DISPOSABLE POSTGRES RUNTIME PREPARATION` vs `FIX BEFORE ANY DOCKER`; no permission for anyone to run it yet. If more hardening is required, propose **one minimal, prioritized patch** with deterministic no-Docker tests. Avoid recursively adding review iterations for low-risk hypothetical cases.

## 2. Frozen evidence, priorities and boundaries

- User owner's Windows PowerShell on **clean E1a exact source SHA `54ea8aeea4c848a4d79cfdf6f11fd5cdae4e242e`**: targeted Node tests **34/34 PASS** (10 dynamic injected fake-Docker cases + 24 earlier mock/static cases), TypeScript `tsc --noEmit` **PASS**. Two `node --check` syntax checks PASS on earlier clean `850318d16051eee123057e2d466f5f9b0254ab7f` and guard/runner .mjs files unchanged between; **NOT re-run** on `54ea8aee`. All **owner-local**, not CI.
- Actual **Docker container execution NOT RUN**. Actual PostgreSQL SQL, role catalog behavior, RLS policy filtering, cleanup and port isolation on user Docker Desktop **NOT RUN**; P0-D3 security gate **OPEN**. Previous source-level reviews E1-F01–F10 did not execute Docker/PG.
- **Real GPS, user/other-owner tracks, Neon/production DB, auth, migrations, server routes, production feature flags, data export, model training, merge/deploy: NO-GO.** A synthetic `SET SESSION AUTHORIZATION` with `NOLOGIN` roles is NOT real trusted LOGIN, HTTP/Neon subject, revoke/consent, or no-write transactional proof.
- No Docker requirement for ordinary development, and no automatic installation. No fallback to ambient/shared/local/Neon/prod database; PostgreSQL provider absent on owner PATH previously.
- Current `run-local-gates.ps1` pins original D3 branch; do NOT bypass its branch/SHA guard on stacked E1a branch.
- Product priority: correctness/security > ease; source-backed > assumption; fail closed; exact evidence, small scope; preserve canonical main and historical frozen decisions. Do not modify `flytally-training`.

## 3. Key adversarial questions

### A — Effective isolation guard: test false-PASS and false-FAIL

1. `validTmpfsOptions`: does `rw`+ `ro` contradictory token, unexpected tokens or `size=...` dialect permit false positives? Are normal Docker `HostConfig.Tmpfs` values stable enough on Linux engine / Docker Desktop Windows? Source accepts `size=256m` or exact decimal bytes, and rejects explicitly `exec`, `suid`, `dev`. Should it reject **all unsupported tokens**, require `nodev`, or keep current limited proof? Justify backward-compat and false-negative tradeoff.
2. `exactMounts`: array must have three unique tmpfs destinations; map must be exact paths with empty or validated option values. Could an unexpected mount representation or additional writable volume slip past `HostConfig.Mounts`, `VolumesFrom`, `Binds`, `cfg.Mounts` checks? When config is incomplete, is it rejected?
3. `inspectSyntheticContainer`: parse object identity/image/purpose, `HostConfig.NetworkMode=none`, no published ports, no host binds and nonprivileged. Can a malformed or adversarial JSON response throw outside a catch and skip cleanup? Note the runner uses `try/finally` after `docker run`; JSON objects are parsed from CLI.
4. Review the `--rm`, `--pull=never`, `--network none`, 3 tmpfs, local image-ID pin, and session env allowlist. Which claim is *actually* established by inspecting the daemon versus only specified? Distinguish local pipe/unix endpoint heuristic from physical daemon locality or image publisher signature.
5. Official PostgreSQL Docker image has an entrypoint. E1a inspector executes *after* `docker run -d`, before **runner-issued** `psql`. Is there a meaningful pre-inspect side effect/volume risk despite synthetic-only, explicit tmpfs/no-bind/no-port args? Would `docker create→inspect→start` meaningfully improve safety or overcomplicate a disposable research harness?

### B — Correctness of cleanup (highest priority)

6. E1a `cleanupSyntheticContainer`: `rm -f <full created ID>`; `docker ps -aq --no-trunc --filter id=<full ID>` reports 0 + empty. Docker documentation lists `id` as supported filter. Does this provide reasonable evidence of absence? Could it **false PASS** under CLI error, context/daemon switch, a racing new container, truncated output, `--rm` behavior, or an ID filter mismatch? Distinguish supported/documented from actual runtime-verified. Is `docker container inspect <ID>` stronger, weaker, or equivalent?
7. If `docker run` fails, starts a container yet returns invalid/empty stdout, fallback `rm -f <random name>` attempts cleanup but cannot verify absence; runner returns failure. Is this sufficient fail-closed without risk of deleting a preexisting resource? Is the random name and explicit purpose label enough? Any edge case bypassing finally?
8. What if `docker()` `spawnSync` returns `ok:false` with error output including secrets? Are known errors limited and output appropriately bounded? Does accidental logging expose synthetic PostgreSQL data, Docker metadata, or user credentials?

### C — Test credibility and database/security boundary

9. The 34 tests consist of 10 dynamic calls into the pure guard and 24 mock/static/early-refusal checks. Identify missing falsification cases worth a narrow new Node test vs unnecessary overengineering; distinguish **guard-level dynamic testing** from **full-runner executable orchestration**.
10. The SQL fixture uses `FORCE ROW LEVEL SECURITY` and synthetic `alpha,beta,gamma` `NOLOGIN` roles set by superuser `SET SESSION AUTHORIZATION`. Which SQL assertions could fail on PostgreSQL 16 due to SQL syntax/function privilege/role DDL? What do they measure only via object privilege rather than RLS? **No invented SQL PASS**.
11. `schema.sql` checks DB name and custom session marker set by runner. Those are not isolation/authorization proofs. Does runner guard (Docker context + immutable local image + no-port/mount + purpose label) adequately establish a *synthetic-only* environment for a discretionary owner opt-in, notwithstanding image and host provenance risks?
12. Are the postponed gates properly isolated: independently authenticated restricted LOGIN/driver connection; per-user consent; driver no-write/transaction; Postgres RLS; source fidelity; S20 telemetry / S21 CI artifacts; wheel-contact truth? Would any current E1a behavior silently open real-data access? Do not conflate mock evidence with production security.

## 4. Required reviewer deliverable

Return:
- A compact **finding table**: `ID | Severity (Blocker/High/Medium/Low) | file/line/snippet | proven source mechanism vs hypothesis | synthetic-only repro test design | minimal correction | confidence`.
- Clear disposition **ACCEPT / REJECT / PARTIAL** for earlier E1-F01..F10 repairs and whether earlier E1a fixes introduced a regression.
- Exact **coverage evidence matrix**: `SOURCE_ONLY`, `OWNER_NODE_PASS`, `DOCKER_RUNTIME_NOT_RUN`, `POSTGRES_SQL_NOT_RUN`, `REAL_LOGIN_DRIVER_NOT_PROVED`. Never mark any SQL/real data as PASS.
- Choose one answer:
  (a) **E1a source safe enough for a subsequent isolated synthetic PostgreSQL runtime opt-in**, conditional on a verified local environment and owner approval; or
  (b) **specific blockers remain before any Docker start**; list no more than the minimum required patch, not stylistic wishlist.
- Distinguish `E1a tests PASS` from `D3 full security gate OPEN`; state **real GPS NO-GO** even if later synthetic Postgres passes.
- **NO production code, credential, SQL run, Docker run, branch merge, deploy, or real GPS read**.

## 5. Authoritative documentation checked by ChatGPT (independently verify)

- Docker filter `id`, `--no-trunc`, all containers `-a`: https://docs.docker.com/reference/cli/docker/container/ls/
- Docker `inspect` formatted JSON: https://docs.docker.com/reference/cli/docker/inspect/
- Docker tmpfs `--tmpfs` vs `--mount` map/array and ephemerality limits: https://docs.docker.com/engine/storage/tmpfs/
- Docker context inspect and npipe example: https://docs.docker.com/reference/cli/docker/context/inspect/
- Docker `--rm` semantics: https://docs.docker.com/reference/cli/docker/container/run/
- PostgreSQL 16 RLS: https://www.postgresql.org/docs/16/ddl-rowsecurity.html

## 6. Complete pinned source appendices (no private GitHub connection needed)

### Appendix 1: `research/gps-r21-p0-d3-synthetic-security/container-guards.mjs` (Git blob `41cba5209cb52872576d9b9c797157b00bc2df32`)

```javascript
/** D3 E1a synthetic-only Docker checks. No docker process, SQL, network or file I/O.
 * Functions accept an injected Docker command callback for deterministic adversarial tests.
 * Not a physical host attestation, production trust boundary, image authenticity proof
 * or real GPS permission mechanism.
 */
const ID_PATTERN=/^[a-f0-9]{64}$/;
const TMPFS=[
  ["/var/lib/postgresql/data",256,true],
  ["/var/run/postgresql",16,false],
  ["/tmp",16,false],
];
const MIB=1024*1024;

export function validContainerId(id){
  return typeof id==="string"&&ID_PATTERN.test(id);
}

function validTmpfsOptions(value,mib,noexec){
  if(typeof value!=="string")return false;
  const parts=value.toLowerCase().split(",").map(x=>x.trim());
  if(parts.some(x=>!x)||new Set(parts).size!==parts.length)return false;
  if(!parts.includes("rw")||!parts.includes("nosuid"))return false;
  if(noexec&&!parts.includes("noexec"))return false;
  if(parts.includes("suid")||parts.includes("exec")||parts.includes("dev"))return false;
  const sizes=parts.filter(x=>x.startsWith("size="));
  if(sizes.length!==1)return false;
  const raw=sizes[0].slice(5);
  // Known host-config representations: original Docker run flag (256m) or
  // normalized positive bytes (268435456). Other formats fail closed.
  const actual=/^\d+m$/.test(raw)?Number(raw.slice(0,-1))*MIB:
    /^\d+$/.test(raw)?Number(raw):NaN;
  return Number.isSafeInteger(actual)&&actual===mib*MIB;
}

function exactMounts(mounts){
  const paths=TMPFS.map(x=>x[0]);
  if(Array.isArray(mounts)){
    if(mounts.length!==paths.length)return false;
    const destinations=new Set();
    for(const m of mounts){
      if(m===null||typeof m!=="object"||m.Type!=="tmpfs"||
          typeof m.Destination!=="string"||!paths.includes(m.Destination)||
          destinations.has(m.Destination))return false;
      destinations.add(m.Destination);
    }
    return paths.every(path=>destinations.has(path));
  }
  if(mounts===null||typeof mounts!=="object")return false;
  if(Object.keys(mounts).length!==paths.length)return false;
  return TMPFS.every(([path,mib,noexec])=>
    Object.hasOwn(mounts,path)&&
    (mounts[path]===""||validTmpfsOptions(mounts[path],mib,noexec)));
}

export function validateSyntheticContainer(cfg,{id,name,imageId}){
  if(!validContainerId(id)||typeof imageId!=="string"||
      !/^sha256:[a-f0-9]{64}$/.test(imageId)||
      typeof name!=="string"||!/^flytally-r21-synthetic-[a-f0-9]{12}$/.test(name)||
      !cfg||typeof cfg!=="object"||Array.isArray(cfg))return false;
  const host=cfg.HostConfig;
  if(!host||typeof host!=="object")return false;
  const tmpfs=host.Tmpfs;
  return cfg.Id===id&&cfg.Name==="/"+name&&cfg.Image===imageId&&
    cfg.State?.Running===true&&
    cfg.Config?.Labels?.["flytally.purpose"]==="synthetic-rls-research"&&
    host.NetworkMode==="none"&&host.PublishAllPorts===false&&
    host.Privileged===false&&
    (host.Binds==null||(Array.isArray(host.Binds)&&host.Binds.length===0))&&
    (host.Mounts==null||(Array.isArray(host.Mounts)&&host.Mounts.length===0))&&
    (host.VolumesFrom==null||(Array.isArray(host.VolumesFrom)&&host.VolumesFrom.length===0))&&
    (host.PortBindings==null||(typeof host.PortBindings==="object"&&
      !Array.isArray(host.PortBindings)&&Object.keys(host.PortBindings).length===0))&&
    tmpfs!==null&&typeof tmpfs==="object"&&!Array.isArray(tmpfs)&&
    Object.keys(tmpfs).length===TMPFS.length&&
    TMPFS.every(([path,mib,noexec])=>
      Object.hasOwn(tmpfs,path)&&validTmpfsOptions(tmpfs[path],mib,noexec))&&
    exactMounts(cfg.Mounts);
}

export function inspectSyntheticContainer(docker,{id,name,imageId}){
  if(!validContainerId(id)||typeof imageId!=="string"||
      !/^sha256:[a-f0-9]{64}$/.test(imageId))return false;
  const response=docker(["container","inspect","--format","{{json .}}",id]);
  if(!response.ok)return false;
  let cfg;
  try{cfg=JSON.parse(response.output);}catch{return false;}
  return validateSyntheticContainer(cfg,{id,name,imageId});
}

export function cleanupSyntheticContainer(docker,{id,name}){
  const hasId=validContainerId(id);
  // Never report ID-bound successful cleanup if Docker did not provide an ID.
  const removed=docker(["rm","-f",hasId?id:name]);
  if(!hasId)return {verified:false,removed:removed.ok};
  // Use the FULL created container ID, not Docker name matching or a regex.
  // An already auto-removed (--rm) container is acceptable ONLY if listing
  // succeeded and proves that this exact container ID is absent.
  const listing=docker(["ps","-aq","--no-trunc","--filter","id="+id]);
  return {verified:listing.ok&&listing.output==="",removed:removed.ok};
}
```

### Appendix 2: `research/gps-r21-p0-d3-synthetic-security/container-guards.d.mts` (Git blob `f6101bdab7847e47ba5c6e4ae722ce5b3db475ba`)

```typescript
/** Testable synthetic-only Docker configuration assertions (no real daemon I/O). */
export type DockerReply={ok:boolean;output:string;error?:string};
export type DockerCall=(args:string[])=>DockerReply;
export type SyntheticTarget={id:string|null;name:string;imageId:string};
export declare function validContainerId(id:unknown):boolean;
export declare function validateSyntheticContainer(
  config:unknown,target:SyntheticTarget
):boolean;
export declare function inspectSyntheticContainer(
  docker:DockerCall,target:SyntheticTarget
):boolean;
export declare function cleanupSyntheticContainer(
  docker:DockerCall,target:Pick<SyntheticTarget,"id"|"name">
):{verified:boolean;removed:boolean};
```

### Appendix 3: `research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs` (Git blob `d27a61b3cff68520c59a610310481de74fcfe5f0`)

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
import {validContainerId,inspectSyntheticContainer,cleanupSyntheticContainer} from "./container-guards.mjs";
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
let createdId=null;
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
  // Docker may start its synthetic PostgreSQL entrypoint BEFORE this check;
  // this verifies configuration before any RUNNER-ISSUED psql/schema operation.
  if(validContainerId(start.output))createdId=start.output;
  if(!start.ok)fail("Could not start isolated synthetic DB: "+start.error.slice(0,200));
  if(!createdId)fail("Disposable container ID was not verified; no SQL executed.");
  if(!inspectSyntheticContainer(docker,{id:createdId,name,imageId:image.output}))
    fail("Disposable Docker isolation configuration not verified; no runner SQL executed.");
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
  // --rm may already remove an exited container. Check the EXACT created ID,
  // not a name filter that could miss an orphan or match a reused name.
  const cleanup=cleanupSyntheticContainer(docker,{id:createdId,name});
  if(!cleanup.verified){
    process.stderr.write("FAIL: disposable synthetic container ID absence not verified; inspect Docker before retry.\n");
    process.exitCode=1;
  }else if(cleanup.removed){
    process.stdout.write("Disposable synthetic PostgreSQL container removed and ID absence verified.\n");
  }else{
    process.stdout.write("Disposable synthetic PostgreSQL container already absent; ID absence verified.\n");
  }
}
```

### Appendix 4: `tests/gps-r21-p0-d3-e1a-fake-docker.test.ts` (Git blob `5981cf24e66412fa0908f3af43a01bf92c98f687`)

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSyntheticContainer,inspectSyntheticContainer,cleanupSyntheticContainer,
  type DockerCall
} from "../research/gps-r21-p0-d3-synthetic-security/container-guards.mjs";

/** Dynamically falsifies real E1a guard functions using synthetic Docker replies.
 * No Docker executable, container, SQL, DB, credentials, network or GPS required.
 * This exercises parser/cleanup logic, not Docker daemon or RLS enforcement.
 */
const id="a".repeat(64);
const imageId="sha256:"+"b".repeat(64);
const name="flytally-r21-synthetic-012345abcdef";
const target={id,name,imageId};
const tmpfs={
  "/var/lib/postgresql/data":"rw,nosuid,noexec,size=256m",
  "/var/run/postgresql":"rw,nosuid,size=16m",
  "/tmp":"rw,nosuid,size=16m",
};
const paths=Object.keys(tmpfs);
const good=()=>({
  Id:id,Name:"/"+name,Image:imageId,
  State:{Running:true},
  Config:{Labels:{"flytally.purpose":"synthetic-rls-research"}},
  HostConfig:{
    NetworkMode:"none",PublishAllPorts:false,Privileged:false,
    Binds:null as string[] | null,PortBindings:null,Tmpfs:{...tmpfs},
    Mounts:null,VolumesFrom:null
  },
  Mounts:paths.map(Destination=>({Type:"tmpfs",Destination}))
});
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T;
const inspect=(payload:unknown,ok=true):DockerCall=>args=>{
  assert.deepEqual(args,["container","inspect","--format","{{json .}}",id]);
  return{ok,output:JSON.stringify(payload)};
};

test("E1a mock-Docker: valid array and documented --tmpfs map both attest",()=>{
  const base=good();
  assert.equal(inspectSyntheticContainer(inspect(base),target),true);
  const mapped={...base,Mounts:Object.fromEntries(paths.map(p=>[p,""]))};
  assert.equal(inspectSyntheticContainer(inspect(mapped),target),true);
  assert.equal(validateSyntheticContainer({...mapped,
    HostConfig:{...mapped.HostConfig,
      Tmpfs:Object.fromEntries(Object.entries(tmpfs).map(([k,v])=>[k,v.replace("size=16m","size=16777216").replace("size=256m","size=268435456")]))
    }
  },target),true);
});

test("E1a mock-Docker: duplicate allowed mount paths cannot replace missing mounts",()=>{
  const cfg=good();
  cfg.Mounts=paths.map(()=>({Type:"tmpfs",Destination:"/tmp"}));
  assert.equal(inspectSyntheticContainer(inspect(cfg),target),false);
  const missing=good();missing.Mounts=missing.Mounts.slice(0,2);
  assert.equal(validateSyntheticContainer(missing,target),false);
  const extra=good();extra.Mounts.push({Type:"tmpfs",Destination:"/unexpected"});
  assert.equal(validateSyntheticContainer(extra,target),false);
  const bind=good();bind.Mounts[0]={Type:"bind",Destination:paths[0]};
  assert.equal(validateSyntheticContainer(bind,target),false);
});

test("E1a mock-Docker: tmpfs map cannot include extra or malicious values",()=>{
  const base=good();
  const cfg={...base,Mounts:Object.fromEntries(paths.map(p=>[p,""]))};
  assert.equal(validateSyntheticContainer(cfg,target),true);
  const injected={...cfg,Mounts:{...cfg.Mounts,"/unexpected":""}};
  assert.equal(validateSyntheticContainer(injected,target),false);
  const bad={...cfg,Mounts:{...cfg.Mounts,"/tmp":"rw,suid,exec,size=16m"}};
  assert.equal(validateSyntheticContainer(bad,target),false);
});

test("E1a mock-Docker: HostConfig.Tmpfs options and sizes are fail-closed",()=>{
  for(const badValue of [
    "", "rw,suid,size=16m", "rw,nosuid,exec,size=16m",
    "rw,nosuid,size=0", "rw,nosuid,size=128m",
    "rw,nosuid", "rw,nosuid,size=16m,size=16m"
  ]){
    const cfg=good();
    cfg.HostConfig.Tmpfs["/tmp"]=badValue;
    assert.equal(validateSyntheticContainer(cfg,target),false,badValue);
  }
  const exec=good();
  exec.HostConfig.Tmpfs["/var/lib/postgresql/data"]="rw,nosuid,size=256m";
  assert.equal(validateSyntheticContainer(exec,target),false);
});

test("E1a mock-Docker: wrong identity, label, network, ports, binds fail",()=>{
  const cases=[
    (x:ReturnType<typeof good>)=>{x.Id="c".repeat(64);},
    (x:ReturnType<typeof good>)=>{x.Name="/another-container";},
    (x:ReturnType<typeof good>)=>{x.Image="sha256:"+"d".repeat(64);},
    (x:ReturnType<typeof good>)=>{x.State.Running=false;},
    (x:ReturnType<typeof good>)=>{x.Config.Labels["flytally.purpose"]="other";},
    (x:ReturnType<typeof good>)=>{x.HostConfig.NetworkMode="bridge";},
    (x:ReturnType<typeof good>)=>{x.HostConfig.PublishAllPorts=true;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Privileged=true;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Binds=["/home:/data"];},
    (x:ReturnType<typeof good>)=>{x.HostConfig.PortBindings={"5432/tcp":[{"HostPort":"5432"}]} as never;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.Mounts=[{Type:"bind"}] as never;},
    (x:ReturnType<typeof good>)=>{x.HostConfig.VolumesFrom=["unsafe"] as never;}
  ];
  for(const change of cases){const cfg=copy(good());change(cfg);assert.equal(validateSyntheticContainer(cfg,target),false);}
});

test("E1a mock-Docker: malformed or unavailable inspect never attests",()=>{
  const error: DockerCall=()=>({ok:false,output:""});
  const malformed:DockerCall=()=>({ok:true,output:"{invalid-json"});
  assert.equal(inspectSyntheticContainer(error,target),false);
  assert.equal(inspectSyntheticContainer(malformed,target),false);
  assert.equal(inspectSyntheticContainer(inspect({}),target),false);
  assert.equal(validateSyntheticContainer(null,target),false);
  assert.equal(validateSyntheticContainer(good(),{...target,imageId:"not-digest"}),false);
});

test("E1a mock-Docker: cleanup targets full ID and verifies successful empty ID filter",()=>{
  const calls:string[][]=[];
  const docker:DockerCall=args=>{
    calls.push(args);
    if(args[0]==="rm")return{ok:true,output:id};
    if(args[0]==="ps")return{ok:true,output:""};
    throw Error("unexpected fake Docker command");
  };
  assert.deepEqual(cleanupSyntheticContainer(docker,{id,name}),{verified:true,removed:true});
  assert.deepEqual(calls,[
    ["rm","-f",id],
    ["ps","-aq","--no-trunc","--filter","id="+id]
  ]);
});

test("E1a mock-Docker: auto-removed container can be acknowledged by ID only",()=>{
  const fake:DockerCall=args=>args[0]==="rm"?
    {ok:false,output:""}:{ok:true,output:""};
  assert.deepEqual(cleanupSyntheticContainer(fake,{id,name}),{verified:true,removed:false});
});

test("E1a mock-Docker: remaining ID or list/daemon failure MUST refuse cleanup",()=>{
  for(const ps of [{ok:true,output:id},{ok:false,output:""},{ok:true,output:"other"}]){
    const fake:DockerCall=args=>args[0]==="rm"?
      {ok:false,output:""}:ps;
    assert.deepEqual(cleanupSyntheticContainer(fake,{id,name}),{verified:false,removed:false});
  }
});

test("E1a mock-Docker: invalid start ID cannot produce a verified cleanup",()=>{
  const calls:string[][]=[];
  const fake:DockerCall=args=>{calls.push(args);return{ok:true,output:""};};
  assert.deepEqual(cleanupSyntheticContainer(fake,{id:null,name}),{verified:false,removed:true});
  assert.deepEqual(calls,[["rm","-f",name]]);
});
```

### Appendix 5: `tests/gps-r21-p0-d3-synthetic-security.test.ts` (Git blob `a273151e4b741faca12c18ce77a4db870273d38a`)

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
const guards=()=>readFileSync(join(dir,"container-guards.mjs"),"utf8");
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
  assert.match(s,/cleanupSyntheticContainer\(docker,\{id:createdId,name\}\)/);
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

test("P0-D3 reviewer F06 cleanup uses created immutable ID and refuses unverified absence",()=>{
  const s=runner(),g=guards();
  assert.ok(s.includes("cleanupSyntheticContainer(docker,{id:createdId,name})"));
  assert.ok(g.includes('const removed=docker(["rm","-f",hasId?id:name])'));
  assert.ok(g.includes('const listing=docker(["ps","-aq","--no-trunc","--filter","id="+id])'));
  assert.ok(g.includes('verified:listing.ok&&listing.output===""'));
  assert.ok(s.includes("container ID absence not verified"));
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


test("P0-D3 E1 effective container configuration is checked before runner-issued SQL",()=>{
  const s=runner(),g=guards();
  const inspected=s.indexOf("inspectSyntheticContainer(docker,{id:createdId,name,imageId:image.output})");
  const ready=s.indexOf("let ready=false;");
  const fixture=s.indexOf('readFileSync(join(ROOT,"schema.sql"),"utf8")');
  assert.ok(inspected>=0&&ready>inspected&&fixture>ready,"effective inspect must precede readiness and fixture");
  for(const field of [
    "cfg.Id===id","cfg.Name","cfg.Image===imageId",
    "cfg.State?.Running===true","synthetic-rls-research",
    'host.NetworkMode==="none"','host.PublishAllPorts===false',
    "host.Privileged===false","host.Binds==null",
    "host.PortBindings","host.Tmpfs","exactMounts(cfg.Mounts)"
  ])assert.ok(g.includes(field),field);
  assert.ok(s.includes('fail("Disposable Docker isolation configuration not verified; no runner SQL executed.")'));
});

test("P0-D3 E1 inspect parser is guarded, with no config leak or cleanup bypass",()=>{
  const s=runner(),g=guards();
  assert.ok(g.includes("try{cfg=JSON.parse(response.output);}catch{return false;}"));
  assert.ok(g.includes("return validateSyntheticContainer(cfg,{id,name,imageId})"));
  assert.ok(s.indexOf("inspectSyntheticContainer(docker")>s.indexOf("try{\n  // --pull=never"));
  assert.ok(s.includes("cleanupSyntheticContainer(docker,{id:createdId,name})"));
  assert.ok(s.includes("if(!cleanup.verified)"));
  assert.ok(!s.includes("console.log(inspected.output)"));
  assert.ok(!s.includes("process.stdout.write(inspected.output)"));
});
```

### Appendix 6: `research/gps-r21-p0-d3-synthetic-security/schema.sql` (Git blob `55e5fbd456cf9ca02888d99236cf023c59b1607b`)

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

### Appendix 7: `research/gps-r21-p0-d3-synthetic-security/run-local-gates.ps1` (Git blob `ee2faaff21014b0b95ca6e31532e3f0a9207eedb`)

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

**Evidence note:** seven files fetched by GitHub connector at exact `49366538b78d6ffa8772f461c1470b5563367d59`. Review answer **NOT RECEIVED** when this packet was authored; no additional tests/DB operations performed. D3 RLS remains OPEN.
