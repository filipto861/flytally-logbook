# GPS Detection 2.0 — independent native Windows PostgreSQL 16 review packet

**Prepared:** 2026-10-17. **Reviewer response NOT RECEIVED**. This is a READ-ONLY independent architecture review request, NOT authorization to code or run SQL.
**Repo:** filipto861/flytally-logbook; native PG16 design in documentation-only Draft PR #359, stacked on synthetic Draft PR #357. Do not change flytally-training.
**Frozen baseline source revision:** 22d2d6dcca919dff3fbc2a2bde4a627bf520f1e9. PG16 design document is [here](GPS_DETECTION_2_0_R2_1B_P0_D3_NATIVE_PG16_READINESS_2026-10-17.md) and contains complete owner evidence and proposed safety contract.

## Verified owner environment

- C:\Program Files\PostgreSQL\16\bin includes **initdb, pg_ctl, psql, postgres, pg_controldata**. All five ran `--version` and reported **PostgreSQL 16.15**.
- PostgreSQL Windows services `postgresql-x64-16` and `postgresql-x64-18` are **BOTH RUNNING**. `Get-Process postgres` reported **17 processes**, but service-PID mapping, data directories and ports were NOT checked. NEVER assume existing instances can be reused, reconfigured or stopped.
- PostgreSQL 18 binaries also installed; NOT a PG16 evidence substitute. No PostgreSQL or Docker binary on PATH, Docker Desktop not detected. No inherited nonempty PG*/DATABASE_URL/DIRECT_URL/NEON_DATABASE_URL/DOCKER_* at original discovery.
- Last owner offline source check E1b clean exact `e14bc91314e2439859f3ea381d93abb7c43a25cd`: targeted Node 35/35 PASS, TypeScript PASS, two syntax checks PASS. **NO actual Docker/PG SQL/RLS ran**.

## Exact reviewer assignment

Give independent evidence-based GO TO IMPLEMENT vs FIX DESIGN verdict for a **separate, disposable PG16 Windows cluster**, and rank minimum blockers. No speculative or stylistic large refactor. These existing PG16/PG18 services are live and strictly OUT OF SCOPE.

Review these concrete design constraints and supply narrow corrections:

1. Initialize a fresh, never-existing random PGDATA outside git/Program Files/existing cluster paths using explicit PG16 `initdb.exe`, non-elevated Windows user and restricted ACL; no Windows service registration. Which Windows ACL/reparse-point/junction defenses are essential?
2. `initdb --auth-host=scram-sha-256 --pwfile=...` bootstrap credential generation and storage; ensure no `trust` fallback, avoid password in stdout/argv/logs/ambient PG*. On Windows, validate `local` HBA record behavior and need for `--auth=scram-sha-256` instead of host-only. What is exact safe sequencing?
3. Ensure `postgres` binds only `127.0.0.1` with strict pg_hba host SCRAM on a unique nondefault port; account for two already-running PG service processes and port TOCTOU. Should client use `sslmode=disable` on local 127.0.0.1? If so, explain risk (untrusted local processes) and correct auth trust boundary.
4. Before **any** synthetic CREATE DATABASE/CREATE ROLE/fixture write, perform positive cluster attestation: exact canonical `data_directory`, expected `server_version_num` 16, selected `port`, server inet_server_addr/address, server SQL `pg_control_system().system_identifier` versus the PGDATA's `pg_controldata` value, owner-created nonce/marker. Is this proof strong enough to exclude accidentally talking to the preexisting PG16 or PG18 services? What happens if connection is rejected/foreign instance impersonates? Credentials must never be reused against other servers.
5. Cancellation/exception/partial initdb/start/shutdown; `pg_ctl -D <owned data> stop -m fast` only if positive PID+directory identity; no recursive delete of unknown folder or live cluster. How to avoid damaging either running Windows PostgreSQL service? Define fail-closed orphan/recovery procedure.
6. How to reuse a **single canonical SQL fixture/assertions** from the existing Docker runner without weakening the Docker branch guard, PG16 role/RLS probes or source evidence? Current SQL fixture guards only database name and caller-settable GUC; do not mistake those as cluster identity. Check `SET SESSION AUTHORIZATION`/NOLOGIN limitations and synthetic gamma RLS vs privilege-only negatives.
7. Which checks can be mocked offline in Node/PowerShell, and which strictly need genuine disposable PG16 execution? Minimum acceptance evidence, separate full D3 vs restricted LOGIN/Neon/no-write/consent/privacy/wheel-contact scope.

## Required verdict format

- Finding matrix: ID, severity (Blocker/High/Medium/Low), exact source/design reference, failure mechanism, synthetic-only reproducibility, smallest safe amendment, confidence.
- One decision: **GO TO IMPLEMENT NATIVE PG16 EPHEMERAL RUNNER** or **FIX DESIGN FIRST**. Even GO does NOT authorize runtime creation or SQL.
- Explicit preconditions for first operator-approved `initdb/start/SQL` run and what to do if no viable secure setup exists.
- State that real GPS and existing PG16/PG18 services, Neon, production and training are **NO-GO**. S20 telemetry and S21 artifacts are DEFINED in full P0 design, not fully tested by D3.
- No tools, code execution, SQL, Docker, filesystem changes, or external connections by reviewer. Source-only.

## Existing exact source appendices (review context; no private repo access required)

### 1. research/gps-r21-p0-d3-synthetic-security/schema.sql (Git blob 55e5fbd456cf9ca02888d99236cf023c59b1607b)

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

### 2. research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs (Git blob 331e3973ea834ef0c2cb26fe15e9813407a38271)

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
  // Privilege-only denials below do NOT establish RLS policy row filtering.
  deny("S07 privilege-only unrelated role denied","SELECT count(*) FROM r21_lab.tracks;",OTHER);
  deny("S07 privilege-only participant relation denied","SELECT count(*) FROM r21_lab.participants;");
  deny("S19 privilege-only SECURITY DEFINER call denied","SELECT r21_lab.admin_count();");
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

**Evidence boundary:** all source appendices read from original GitHub exact pin 22d2d6dcca919dff3fbc2a2bde4a627bf520f1e9. Native design is not implemented; no PG16 tests executed.