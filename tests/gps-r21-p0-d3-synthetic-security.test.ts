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
