# FlyTally GPS Detection 2.0 — P0-D3 Native PostgreSQL 16 readiness

**Date:** 2026-10-17. **Status:** Windows PG16 16.15 executable versions and existing PostgreSQL service inventory CONFIRMED; native provider design only; no new cluster/database started; SQL/RLS NOT RUN.
**Repository:** filipto861/flytally-logbook; docs-only branch stacked on existing synthetic Draft PR #357. This is NOT a production, auth, database or training-repo change.

## 1. First owner discovery (historical; later version/service verification in section 2)

| Item | Observed evidence | Meaning |
| --- | --- | --- |
| Docker CLI and Docker Desktop standard path/service | NOT ON PATH, FALSE, NOT FOUND | No Docker provider discovered; none is required |
| initdb/pg_ctl/psql CLI on PATH | all absent | PATH absence, not installation absence |
| C:\Program Files\PostgreSQL\16\bin | initdb.exe, pg_ctl.exe, psql.exe, postgres.exe all exist | Binary files detected in first pass; **16.15 verified in section 2** |
| C:\Program Files\PostgreSQL\18\bin | same four files exist | PG18 available but not the intended test target |
| Ambient PG*, database URLs and Docker host/context overrides | none set | applies to owner discovery time only |
| Existing PostgreSQL Windows services or connections | Not checked in first pass | **Both PG16 and PG18 Running in section 2; no connection made** |
| Docker startup, cluster creation, PG16 SQL/RLS | NOT RUN | overall D3 gate OPEN |

**Selected direction:** installed PostgreSQL **16**, invoked by absolute binary paths. Never use PG18, an existing PostgreSQL service, default port/socket or ambient database URL as a substitute. Historical clean E1b local code SHA e14bc91314e2439859f3ea381d93abb7c43a25cd has 35/35 targeted Node PASS plus TypeScript and syntax PASS; it is not native PG security evidence.

## 2. Owner read-only version and service evidence — RECEIVED

Owner Windows PowerShell transcript dated 2026-10-17, running each executable from the explicitly constructed PostgreSQL 16 Program Files bin directory with `--version` only:

| Executable | Observed output |
| --- | --- |
| `initdb.exe` | `initdb (PostgreSQL) 16.15` |
| `pg_ctl.exe` | `pg_ctl (PostgreSQL) 16.15` |
| `psql.exe` | `psql (PostgreSQL) 16.15` |
| `postgres.exe` | `postgres (PostgreSQL) 16.15` |
| `pg_controldata.exe` | `pg_controldata (PostgreSQL) 16.15` |

The same transcript showed **postgresql-x64-16 — Running**, **postgresql-x64-18 — Running**, and **17 postgres processes** in `Get-Process -Name postgres`. Process listing did not map PIDs to services/versions, data directories or listening ports; those remain **UNKNOWN**. No PostgreSQL service, configuration, cluster, SQL or database connection was changed or executed in this discovery.

**Security consequence:** existing PG16 and PG18 clusters are live. Never direct the D3 fixture, CREATE ROLE or CREATE DATABASE to either installed service; never assume standard/default ports are free, and never use implicit psql connection defaults or ambient PG* settings. For any future native synthetic experiment, positively attest identity of a **different, newly initialized, script-owned PGDATA and pg_control system_identifier** before any synthetic DDL. A nondefault port is not proof of identity.

**Read-only binary-version and service inventory COMPLETE**. Next gate is native design independent security review, not further commands to discover whether PostgreSQL is installed.

## Original optional read-only checks (HISTORICAL, ALREADY EXECUTED)


Owner subsequently checked actual --version output for PG16 initdb, pg_ctl, psql, postgres and pg_controldata, and read service names/status with Get-Service filtering PostgreSQL; see recorded evidence in section 2. No service start/stop, TCP connection, SQL, registry change, install or files created. Do not print environment variable values, service arguments or any passwords.

## 3. Native PG16 design — amended after independent source review (FIXED IN DESIGN ONLY)

**Review provenance:** DeepSeek examined the seven summarized constraints and the embedded synthetic SQL/runner, **not** the full native readiness document. Its verdict was `FIX DESIGN FIRST` (NP16-01–15), **source/design only**. Original design already mentioned SCRAM host auth, non-reparse paths, loopback, cluster identity and safe shutdown, but left critical implementation predicates insufficiently explicit. The five high-priority areas are now specified here; **no native runner is implemented or tested**.

### A. Windows preflight and new PGDATA ownership (NP16-02, NP16-07, NP16-13, NP16-14)

- Pin all five executables to the observed `C:\Program Files\PostgreSQL\16\bin\` and verify each exact `--version` output **16.15** at execution. Reject version/PATH mismatch. Existing `postgresql-x64-16` and `postgresql-x64-18` remain **RUNNING and off-limits**; never use any service control action, default port or installed service PGDATA.
- Check the effective Windows process token for **elevation**; reject elevated/admin execution. Group membership by itself is not proof of an elevated token (UAC); do not claim that parent-PID checks alone prove process ownership.
- Use a pre-approved, owner-controlled private parent directory outside Git, Program Files, Public/ProgramData and service PGDATA; validate canonical paths, each existing ancestor's reparse-point status and effective write ACL. Reject if any untrusted principal can create/rewrite path entries. Generate a cryptographically unpredictable run UUID; create an exclusively new run directory/PGDATA atomically (fail if already present) with restricted ACL, then re-validate the path/ACL. No user-supplied custom PGDATA for execution and no recursive deletion of unrecognized paths.
- Before `initdb`, record a run-bound marker and path ownership; after `initdb`, capture its `pg_controldata` **decimal system_identifier** as a string. Markers alone cannot attest an SQL server; system ID plus server data directory will.

### B. SCRAM and secret lifecycle (NP16-01, NP16-06, NP16-08)

- Use exact PG16 `initdb -D <owned-new-PGDATA> -U postgres -E UTF8 --auth=scram-sha-256 --pwfile=<restricted-owner-only-file>`; do **not** use only `--auth-host`, which leaves other rules potentially `trust`. Verify the generated HBA **before** any server start: require safe `local` lines, only intended IPv4-loopback `host` SCRAM rule for bootstrap role/database and explicit rejection of other hosts; reject `trust`, `peer`, `md5`, `password`, includes and unexpected wildcard lines. Never edit either service's HBA.
- Generate a unique high-entropy temporary bootstrap password without stdout/argv logging. Password file exists only inside the run directory with verified owner-only ACL and is deleted directly after `initdb` (including error handling). A separate restricted temporary libpq password file may be used for attestation/SQL, then securely removed after stop; Windows file deletion does **not** guarantee secure erasure. Never print password, URL, process environment or unredacted connection errors.
- Invoke client binaries with allowlisted inherited environment (no PG*, `DATABASE_URL`, `DIRECT_URL`, `NEON_DATABASE_URL`) and explicit `-h 127.0.0.1 -p <port> -U postgres -d postgres -X -w -v ON_ERROR_STOP=1`. Use explicit `PGPASSFILE` only for the just-generated credential, no reused login. If TLS is disabled on loopback, document that SCRAM is not local-host attestation and that untrusted local processes remain a residual risk.

### C. Network startup and **positive server identity before mutation** (NP16-03, NP16-04, NP16-12, NP16-15)

- Select a high, nondefault candidate loopback TCP port. Port availability checks are advisory and raceable: any bind conflict or unexpected startup output is **FAIL**; do not retry with default port or try another existing server.
- Use absolute PG16 `pg_ctl start -D <owned-PGDATA> -w -t <bounded> -l <run-log> -o '-h 127.0.0.1 -p <port>'` only. Inspect bounded, run-local startup log for successful binding and no `could not bind`/fatal startup; no Windows service registration. `pg_ctl` wait success alone does not identify the server reached by a client.
- **Only attestation SELECTs** may be issued at first. Positively compare independent local expected values with **server-reported** `current_setting('data_directory')` (canonical-owned PGDATA), `current_setting('server_version_num') = 160015`, `current_setting('listen_addresses') = 127.0.0.1`, `inet_server_addr() = '127.0.0.1'`, `inet_server_port() = <port>`, and `pg_control_system().system_identifier` against the separately captured `pg_controldata -D <owned-PGDATA>` value. Also write a fresh run-nonce file *inside* that owned PGDATA and require an exact `pg_read_file()` readback from the server. Compare decimal IDs as strings (no lossy JS Number). Any mismatch/SQL error/timeout aborts before `CREATE DATABASE`, roles or fixture.
- A matching DB name, GUC like `r21.synthetic_only`, login name, CLI flags or a random port alone do **not** establish cluster identity. Never proceed if a foreign service answers the port or if the identity proof cannot be performed.

### D. Synthetic-only SQL and proof boundary (NP16-09–11)

- Only after full identity verification create `r21_synthetic_lab` and apply the reviewed fictional `schema.sql` plus one canonical set of D3 SQL assertions (do not silently fork the expected results). Preserve gamma's granted SELECT / no applicable policy test as actual default-deny RLS evidence and label unrelated-role/participant/SECDEF negative checks as **privilege-only**.
- The original Docker runner and D3 PowerShell wrapper stay untouched. `SET SESSION AUTHORIZATION` of NOLOGIN roles simulates policy context only, **not** authenticated restricted LOGIN, Neon/driver, consent or real GPS authorization. Require real PG16 SQL results separately from offline mocked Node assertions.

### E. Stop and deletion — protect both running PostgreSQL services (NP16-05)

- Keep exact run ownership (UUID, canonical path, marker, system ID), initialized/started state and bounded log. Before **any** `pg_ctl stop -D <owned-PGDATA> -m fast -w`, verify the owned path still has no reparse points, `postmaster.pid` line 1 identifies the expected live postgres.exe process and line 2 canonical-matches owned PGDATA, and process executable/command line and start identity align with the recorded run. `pg_ctl status -D` can corroborate but is not identity proof. Do **not** require a long-lived parent relationship to `pg_ctl` on Windows; the launcher can exit after detaching the server.
- On uncertain PID, path, executable or system ID: **never stop an unknown process or delete any directory**; mark fail and retain scoped evidence for manual inspection. Never call `Stop-Service`, `taskkill` or a wildcard stop against all postgres.exe processes.
- After successful owned-process stop, verify no live postmaster for this exact PGDATA and matching recorded system_identifier/run marker before considering recursive deletion of **only** the exact exclusively created UUID run directory; on uncertainty preserve it. Ctrl+C/forced termination can bypass PowerShell `finally`; the next run must detect abandoned run directories and **refuse/refer for manual recovery**, not reuse or auto-delete them.

**Acceptance boundary:** These are **design requirements, NOT implemented or runtime verified**. No PostgreSQL instance or SQL executed. Real GPS/Neon, full read-only driver proof, telemetry S20 and artifact S21 checks, source fidelity and touchdown ground truth remain NO-GO.
## 3F. Native I1 implementation update (2026-10-17; NO RUNTIME)

First limited source batch has been AUTHORED in this same PR: `native-pg16-guards.mjs` / `.d.mts`, `run-native-pg16-preflight.mjs` and 12 dynamic offline tests. These are **pure evidence validators** and an **offline-only CLI**; the CLI rejects `--synthetic-only`, `--run` and all other non-`--offline-only` arguments. No Windows ACL adapter, initdb, PGDATA, pg_ctl, psql, native SQL assertions, server/port access or cleanup actions have been implemented.

An internal isolated V8 syntax/spot check passed seven small predicates, but actual target Node 12/12 and `npm run typecheck` have **NOT RUN**. Passing pure predicates given fabricated metadata does not attest the actual Windows OS or running Postgres. Preserve all five corrected High-review contract requirements for I2, and require exact clean SHA verification of I1 before I2.

[Exact I1 contract](GPS_DETECTION_2_0_R2_1B_P0_D3_NATIVE_PG16_I1_GUARDS_2026-10-17.md). Existing PG16/PG18 services untouched and actual RLS NOT RUN/OPEN.
## 4. Independent reviewer handoff — required before implementing privileged native runner

Review the Windows native PG16 disposable cluster design independently (DeepSeek/Claude): confirm nonadmin initdb constraints, PG16 binaries, host authentication and password file safety; OS-specific loopback, port collision and pg_hba scope; meaningful system_identifier/PGDATA/port identity binding before synthetic DDL; safe shutdown and Ctrl+C/orphan failure cleanup; minimal reuse of original D3 SQL probes; and how to test against a malicious preexisting local service without ever accessing one.
Return GO TO IMPLEMENT / FIX DESIGN, prioritized blocking items, separate purely offline negative tests, runtime acceptance checks and any Windows pitfalls. No Docker/PG16 execution or real user data use requested of the reviewer.
Previous E1a review addressed Docker only. A distinct **partial native design review was RECEIVED** with verdict FIX DESIGN FIRST; its high-priority items are reconciled in section 3. The revised design has NOT been independently re-reviewed or implemented.

## 5. Decision ledger

| Gate | State |
| --- | --- |
| Owner PG16 binaries | All five executed `--version` and returned **16.15** |
| Read-only PG16 version and service inventory | **COMPLETE**: PG16/PG18 Windows services both RUNNING; 17 processes; endpoints unknown |
| Native PG16 cluster architecture/security review | **DeepSeek partial source/design review RECEIVED: FIX DESIGN FIRST**; five areas specified above; amended design not independently re-reviewed |
| Native isolated implementation | NOT STARTED |
| Owner explicit approval for new PGDATA/SQL | NOT RECEIVED |
| Real PostgreSQL 16 RLS proof | NOT RUN / OPEN |
| Existing PG16/PG18 service/database, Neon, real GPS, auth, merge or deploy | NO-GO / UNTOUCHED |

## Authoritative references

- https://www.postgresql.org/docs/16/app-initdb.html
- https://www.postgresql.org/docs/16/app-pg-ctl.html
- https://www.postgresql.org/docs/16/auth-pg-hba-conf.html
- https://www.postgresql.org/docs/16/runtime-config-connection.html
- https://www.postgresql.org/docs/16/app-pgcontroldata.html
- https://www.postgresql.org/docs/16/ddl-rowsecurity.html
