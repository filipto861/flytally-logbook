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

## 3. Frozen candidate native-provider safety contract (DESIGN ONLY)

1. Verify installed binary paths and returned major version 16 for every program. The existing PG16/PG18 service installations remain out of scope. Use a non-elevated Windows account, never service registration or default connection values.
2. Create a uniquely named, never-before-existing test root under an explicitly approved owner-controlled non-repository directory. Verify canonical path, no reparse point/junction, owner-only intended write permissions; create unique sentinel and initial cluster-identifier evidence. Nothing may delete an unknown or reused path.
3. Run the exact PG16 initdb against that new PGDATA only; require generated bootstrap password and SCRAM-SHA-256 host authentication (never trust), restricted ephemeral credential file/ACL, no password/connection URI logging. Reject inherited PG*/DATABASE_URL/DIRECT_URL/NEON_DATABASE_URL.
4. Windows uses TCP loopback by default, not the Docker networkless model. Start only with listen_addresses=127.0.0.1 and a nondefault, explicitly selected otherwise-free port, strict pg_hba.conf host rule for 127.0.0.1/32 and SCRAM authentication. Any port race or contradictory host/ACL configuration must fail, not connect to another server.
5. Start/stop with PG16 pg_ctl bound to **exact newly created PGDATA**, not the existing Windows Service Manager. Before any CREATE DATABASE or fixture SQL, connect only to 127.0.0.1 + selected port with explicit role/database/password source, positively attest canonical SHOW data_directory, server_version_num major 16, expected port/address, and matching pg_control system_identifier against this newly created sandbox. Caller-settable marker/GUC and database name alone are insufficient.
6. Only after proving the target is the new sandbox may the synthetic r21_synthetic_lab database and existing fake-role RLS fixture be created. Preserve the reviewed distinction between RLS row filtering (granted SELECT gamma / policy) and privilege-only denials. The Docker-only runner cannot be pointed at a Windows service and is not a native runner.
7. Use try/finally and verified pg_ctl -D shutdown; confirm PID/process exited before removing the new sandbox. Stop/delete only artifacts identified as created by this run. If the server may still be alive, preserve the files for operator inspection, mark FAIL and do not delete recursively.
8. A temporary local PostgreSQL host connection remains accessible to other local processes; SCRAM and HBA reduce, but do not eliminate, this risk. An actual synthetic RLS PASS does not approve production authorization, real LOGIN/Neon driver, owner GPS, privacy, consent, no-write transaction or wheel-contact truth.

**Implementation status:** no new executable native runner, no PGDATA directory, no credential, no server, no SQL. These are review requirements, not claims that an implementation meets them.

## 4. Independent reviewer handoff — required before implementing privileged native runner

Review the Windows native PG16 disposable cluster design independently (DeepSeek/Claude): confirm nonadmin initdb constraints, PG16 binaries, host authentication and password file safety; OS-specific loopback, port collision and pg_hba scope; meaningful system_identifier/PGDATA/port identity binding before synthetic DDL; safe shutdown and Ctrl+C/orphan failure cleanup; minimal reuse of original D3 SQL probes; and how to test against a malicious preexisting local service without ever accessing one.
Return GO TO IMPLEMENT / FIX DESIGN, prioritized blocking items, separate purely offline negative tests, runtime acceptance checks and any Windows pitfalls. No Docker/PG16 execution or real user data use requested of the reviewer.
Earlier independent E1a review addressed **Docker**, not this new native Windows provider. Native review is currently **NOT RECEIVED**.

## 5. Decision ledger

| Gate | State |
| --- | --- |
| Owner PG16 binaries | All five executed `--version` and returned **16.15** |
| Read-only PG16 version and service inventory | **COMPLETE**: PG16/PG18 Windows services both RUNNING; 17 processes; endpoints unknown |
| Native PG16 cluster architecture/security review | DESIGN ONLY / independent review pending |
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
