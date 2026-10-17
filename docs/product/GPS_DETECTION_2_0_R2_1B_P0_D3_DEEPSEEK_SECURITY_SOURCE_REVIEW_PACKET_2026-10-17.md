# DeepSeek independent security review packet - GPS Detection 2.0 P0-D3

**Review requested / NOT RECEIVED.** Date 2026-10-17. All material in this packet is fictional/research source, no real GPS data, secrets or production credentials.
**Repository:** `filipto861/flytally-logbook`. **Pinned exact D3 source:** `3517cde1f5e000128c75b1298594a55764ab5f31`, Draft PR #351; the reviewer is NOT being asked to run any command or access any real database. This packet embeds the exact source files below so private GitHub access is NOT required.

## Assignment to independent reviewer (read-only)

Perform an **independent, adversarial** source-level security review of the five exact files below, not a product brainstorm. Evaluate PostgreSQL syntax/semantics, role enforcement, tenant isolation, refusal to use existing/production DB, cleanup, and missing S01-S23 threat cases. Question ChatGPT's preliminary judgments. **Do not claim PostgreSQL RLS PASS, reviewed code execution, actual production grants, physical wheel contact, or independent account consent.** No Docker, PostgreSQL or Neon execution authorized for the reviewer.

## Frozen constraints

- Research-only fictional alpha/beta/unrelated subjects and a synthetic DB named `r21_synthetic_lab`; absolutely no real account GPS, Neon, production DB, migrations, account identity, API route, data export, ML training or Training repository edits.
- R2.1a offline detector and R2.1b D4 robustness are separate, already source-contained research; no live GPS gate can be opened from those tests.
- Owner's ordinary development **must not require Docker**. Existing `run-local-gates.ps1` default `PostgresProvider=none` remains Docker-free; actual RLS then honestly reports **NOT RUN / OPEN**.
- Existing optional Docker+Postgres path is authored but actual PostgreSQL RLS **NOT RUN**. Owner clean prior `3f9db21f3945a4abc72b5ba19f09c25d00d`: **16/16 Node/mock/static tests and TypeScript PASS**; newer D3 head included docs-only updates. Never inherit PASS to new code or real DB.
- No native Postgres `initdb/pg_ctl/psql` toolchain found on owner PATH; no native disposable-cluster runner exists yet. No automatic download/installation or fallbacks to existing/local/shared DB.
- Independent previous architecture review was **PARTIAL** and did not inspect this D3 source; this is a new request and must be classified as PENDING until the reviewer actually responds.

## First-order reviewer questions (answer GO/NO-GO independently)

1. **Identity / least privilege:** Does creating `NOLOGIN NOINHERIT NOBYPASSRLS` alpha/beta roles, then connecting as superuser and using `SET SESSION AUTHORIZATION`, legitimately test RLS policy enforcement? Exactly what *does it not* test? Is there any unintended bypass in the implementation?
2. **PostgreSQL SQL semantics:** Audit `FORCE ROW LEVEL SECURITY`, policy subquery to `flights`, FK/role/context, `row_security=off`, owner table grants, `SECURITY DEFINER`, copy behavior and unexpected error masking. Identify any SQL that would likely fail incorrectly on PostgreSQL 16. Give an adversarial test demonstrating each concern.
3. **Runner safety:** Audit Docker context checks, local context/host ambiguity, preflight, image selection, environment inheritance, `--network none`, ephemeral `tmpfs`, published ports, timeouts, `psql` command error detection, failure output, and `finally` cleanup. Distinguish genuine exploitable production-risk from availability/testability defects.
4. **Missing S01-S23:** Which threat cases are actually exercised against SQL, only mocked, only static, and not authored at all? Prioritize missing effective grants catalog, alternate roles/default permissions, `TEMP`/DDL, SQL injection, revoked grant race, pooled/driver reuse, crash/secret/log safety, cross-owner/copied exports.
5. **Safe future Windows-native proof without mandatory Docker:** Is an optional `initdb` + `pg_ctl` + `psql` throwaway cluster meaningfully safer or merely different? Require exact data-directory/process/bind/port/credential/role attestation and fail-closed cleanup (Windows specifics, no default DB). Should we implement it now, defer pending real binaries, or keep RLS OPEN? There is no permission to use an existing server.
6. **Release/real-data GO criteria:** List independent, concrete evidence needed after synthetic PASS before *one owner's* real persisted GPS can ever be read for a private, non-public diagnostic, without assuming product-owner authority extends to other people's data.

## Required review output

Return a table **Finding ID | Severity | Specific file/behavior | Exploit or false-positive mechanism | Reproduction test design (synthetic only) | Safe narrow fix | Confidence**, plus a **coverage matrix S01-S23** separating `STATIC`, `MOCK`, `ACTUAL SQL AUTHOR_ONLY`, `NOT IMPLEMENTED`, and `EXECUTED PASS` (none for RLS until evidence).
Conclude with separate decisions for:
- Current D3 fixture/runner source acceptability (fix-before-testing vs safe-to-test on disposable PostgreSQL).
- Windows native provider (approve design only / implement opt-in / reject).
- Real GPS data source access (must remain **NO-GO**).
- Minimal recommended next PR scope and test gates, without Docker as a mandatory everyday dependency.

**Cite source line numbers/unique code snippets where possible.** If a source issue cannot be confirmed without PostgreSQL execution, label it **HYPOTHESIS / NEEDS DB VERIFICATION**. Do not silently upgrade confidence.

## ChatGPT pre-review observations — challenge these rather than accepting

- Existing owner-unfiltered `SELECT` and opposite-owner predicates are present; true RLS outcomes not executed.
- `SET SESSION AUTHORIZATION` impersonates a test role in a privileged connection, not a real client login or Neon HTTP transaction. Subject roles are `NOLOGIN`.
- Existing negative probes cover selected DML/DDL/role/sequence/function access, but not the full S01-S23 matrix. `S14 row_security=off` is not a transactional read-only proof.
- In-band SQL `current_database()` and custom `r21.synthetic_only` guard cannot by themselves attest an independent disposable cluster. Correct sandbox selection is a runner/operator property.
- `COPY TO STDOUT` may legitimately export rows the role can SELECT; demonstrating only authorized synthetic IDs is different from preventing exfiltration via an authorized client.
- No RLS claim can be supported from Node/static test PASS, and neither D3 nor D4 measures actual touchdown truth.

## Authoritative reference points for checking semantics

- https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- https://www.postgresql.org/docs/16/sql-set-session-authorization.html
- https://www.postgresql.org/docs/16/sql-set-role.html
- https://www.postgresql.org/docs/16/app-initdb.html
- https://www.postgresql.org/docs/16/app-pg-ctl.html

## Exact source appendices from GitHub pinned SHA

### Appendix 1: `research/gps-r21-p0-d3-synthetic-security/schema.sql` (blob SHA `8ec0aa192e2af2e0ca52ba24ce90314de2cdcd0a`)

````sql
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
REVOKE ALL ON SCHEMA r21_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA r21_lab TO r21_subject_alpha,r21_subject_beta;
GRANT SELECT ON r21_lab.flights,r21_lab.tracks TO r21_subject_alpha,r21_subject_beta;
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
````

### Appendix 2: `research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs` (blob SHA `bf059f458fc4f95984d179940cb31d6be4fef3a0`)

````javascript
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
const IMAGE="postgres:16-alpine",ALPHA="r21_subject_alpha",BETA="r21_subject_beta",OTHER="r21_unrelated";
const fail=(message)=>{throw new Error(message)};
if(process.argv.slice(2).join(" ")!=="--synthetic-only")fail("Explicit --synthetic-only acknowledgement required. Nothing ran.");
for(const key of ["DATABASE_URL","DIRECT_URL","NEON_DATABASE_URL","PGHOST","PGSERVICE","PGPORT","PGUSER","PGPASSWORD"]){
  if(process.env[key])fail("Ambient "+key+" set; refusing synthetic DB proof.");
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
if(!context.ok||!(/^(?:npipe:\/\/\/\/\.\/pipe\/|unix:\/\/|tcp:\/\/(?:localhost|127\.0\.0\.1):)/).test(context.output)){
  fail("Docker context is not demonstrably local; refusing even synthetic DB creation.");
}
const image=docker(["image","inspect",IMAGE,"--format","{{.Id}}"]);
if(!image.ok)fail("Docker image postgres:16-alpine not locally available. Manually pull first; no DB touched.");
if(!docker(["info","--format","{{.ServerVersion}}"]).ok)fail("Docker daemon unavailable.");
const name="flytally-r21-synthetic-"+randomUUID().slice(0,12);
const start=docker(["run","-d","--rm","--network","none","--name",name,
  "--label","flytally.purpose=synthetic-rls-research",
  "--tmpfs","/var/lib/postgresql/data:rw,nosuid,noexec,size=256m",
  "--tmpfs","/var/run/postgresql:rw,nosuid,size=16m",
  "--tmpfs","/tmp:rw,nosuid,size=16m",
  "-e","POSTGRES_PASSWORD=SYNTHETIC_NOT_A_SECRET","-e","POSTGRES_DB=r21_synthetic_lab",IMAGE]);
if(!start.ok)fail("Could not start isolated synthetic DB: "+start.error.slice(0,200));
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
  value("S22 shared-flight participant lacks source ownership","SELECT count(*) FROM r21_lab.tracks WHERE flight_id=201;",0);
  value("S07 both tables have forced RLS","SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='r21_lab' AND c.relname IN ('tracks','flights') AND c.relrowsecurity AND c.relforcerowsecurity;",2,null);
  value("S11 null altitude remains distinguishable from zero","SELECT count(*) FROM r21_lab.tracks WHERE payload->0->>'alt' IS NULL;",1);
  value("S23 fresh beta session not contaminated by alpha","SELECT count(*) FROM r21_lab.tracks;",1,BETA);
  deny("S06 INSERT denied","INSERT INTO r21_lab.tracks(id,flight_id,owner_role,payload) VALUES(999,101,'r21_subject_alpha','[]');");
  deny("S06 UPDATE denied","UPDATE r21_lab.tracks SET payload='[]' WHERE id=1001;");
  deny("S06 DELETE denied","DELETE FROM r21_lab.tracks WHERE id=1001;");
  deny("S06 TRUNCATE denied","TRUNCATE r21_lab.tracks;");
  deny("S06 CREATE TABLE denied","CREATE TABLE r21_lab.injected(id integer);");
  deny("S06 sequence nextval denied","SELECT nextval('r21_lab.internal_sequence');");
  deny("S07 SET ROLE beta denied","SET ROLE r21_subject_beta;");
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
  const removed=docker(["rm","-f",name]);
  if(!removed.ok){process.stderr.write("FAIL: synthetic container cleanup, manually inspect Docker.\n");process.exitCode=1;}
  else process.stdout.write("Disposable synthetic PostgreSQL container removed.\n");
}
````

### Appendix 3: `research/gps-r21-p0-d3-synthetic-security/run-local-gates.ps1` (blob SHA `ee2faaff21014b0b95ca6e31532e3f0a9207eedb`)

````powershell
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
````

### Appendix 4: `research/gps-r21-p0-d3-synthetic-security/mock-authorization.ts` (blob SHA `616d883c239d4e5cc789c02bb24706bdca926aae`)

````typescript
/**
 * SYNTHETIC security design fixture ONLY, not app authentication or a grant issuer.
 * No real users, tokens, cookies, database queries, or claims of consent.
 */
export type MockSubject="r21_subject_alpha"|"r21_subject_beta";
export type MockGrant={
  subject:MockSubject;
  trackIds:readonly number[];
  expiresAtMs:number;
  revoked:boolean;
};
export type MockRequest={
  principal:MockSubject|null;
  trackId:number;
  trackOwner:MockSubject;
  nowMs:number;
};
export type MockDecision={status:"ALLOW"}|{status:"DENY";reason:"NOT_AUTHORIZED"};

/** Deliberately opaque DENY: do not disclose whether another subject/track exists. */
export function evaluateSyntheticGrant(grant:MockGrant|null,request:MockRequest):MockDecision{
  if(!grant||!request.principal||grant.revoked||
     !Number.isSafeInteger(request.trackId)||!Number.isFinite(request.nowMs)||
     !Number.isFinite(grant.expiresAtMs)||grant.expiresAtMs<=request.nowMs||
     grant.subject!==request.principal||request.trackOwner!==request.principal||
     !grant.trackIds.includes(request.trackId)){
    return{status:"DENY",reason:"NOT_AUTHORIZED"};
  }
  return{status:"ALLOW"};
}

/** Selector callback may only be reached with a positively validated mock grant.
 * This is NOT a DB-enforced policy, does not replace Postgres RLS, and never
 * authorizes access to a real FlyTally record. */
export function withSyntheticAuthorization<T>(
  grant:MockGrant|null,request:MockRequest,select:()=>T
):{status:"DENY";reason:"NOT_AUTHORIZED"}|{status:"ALLOW";result:T}{
  const d=evaluateSyntheticGrant(grant,request);
  if(d.status==="DENY")return d;
  return{status:"ALLOW",result:select()};
}
````

### Appendix 5: `tests/gps-r21-p0-d3-synthetic-security.test.ts` (blob SHA `c9906ae1044dc1df9eefdfb212a6d6b0edc7380b`)

````typescript
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
````

## Evidence statement

GitHub connector fetched all five source files using commit ref `3517cde1f5e000128c75b1298594a55764ab5f31` while composing this packet. No commands/tests/DB calls were executed during its preparation. Review is **NOT RECEIVED** until product owner returns independent review feedback.
