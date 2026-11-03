# M0-B B1b.2c — Dedicated empty Neon PostgreSQL 16: identity, role and non-mutating transaction evidence

**Date:** 2026-11-03 UTC. **Repo:** `filipto861/flytally-logbook`. Verified canonical **main** `c9c2f60303236113a223942072311f5e37f876f7`; starting stacked Draft **#466** `905df42d32080db0704410d87f37a86af4e03c11`, parent #465→#455, separate #454. User **explicitly authorized** creation of a disposable Neon test target and P0–P8 acceptance tests with **no production impact**. No DeepSeek review per prior owner instruction. This milestone does NOT approve app migration, production DB operations, merge, deploy, flags, or full-account Restore.

## A. Target isolation and why a separate new project

Neon project discovery returned existing projects: **WOODCOMP Web 2.0 Development**, **FlyTally Training Production**, **FlyTally Training Acceptance**, **Logbook Shadow**. None was a positively verified empty FlyTally Logbook PG16 fixture. Creating a branch from any existing project's data could clone sensitive or production-sourced records. To honor **no production data copies**, created **an entirely new project** rather than branching a potentially populated project.

| Verified provider field | New isolated test target |
| --- | --- |
| Project ID | `blue-haze-29352938` |
| Project name | `FlyTally Logbook M0B Isolated Acceptance 2026-11-03` |
| Created | 2026-11-03 08:43:34 UTC |
| Organization | `org-twilight-king-95853011` |
| Region | `aws-eu-central-1` |
| PostgreSQL | `16.15` (server_version_num `160015`) |
| Default/test branch ID | `br-patient-sound-bacf0trt` |
| Branch name | `m0b-isolated-empty-pg16-20261103` |
| Database | `flytally_m0b_isolated` |
| Owner / operator SQL role | `flytally_m0b_operator` |
| Compute ID | `ep-quiet-smoke-babbdfv9` |
| Public base tables when inspected | `0` |
| `ft_m0b_%` fixture schemas when inspected | `0` |

Identity was verified via **both Neon provider project/branch/database/role/compute metadata and explicit read-only SQL** scoped to project, branch, database and role. The new project's bootstrap branch is its own default branch; it was **not** copied from existing Logbook/Shadow/Training or Woodcomp project. The provider branch field `init_source=parent-data` is not itself proof of copied user records; new project creation context and **0 user tables** are the relevant observed evidence. No customer/pilot/GPS data supplied.

**Important:** this is a **remote** but specifically owner-approved, separate **empty project**, not the production DB, and has not been connected to Vercel or the Logbook app. No migration or real application schema was copied here. The project remains allocated for continued test work; ongoing resource usage and later cleanup require explicit tracking. No secrets, passwords, DATABASE_URL, logs containing credentials or flight data are committed.

## B. Actual SQL acceptance results, scoped to project + branch ID + database + role on every call

1. **PASS — P0 partial technical target gate:** read-only SELECT returned `current_database=flytally_m0b_isolated`, `current_user=flytally_m0b_operator`, `server_version_num=160015`, public user tables `0`, dedicated fixture schemas `0`; provider metadata matches. Production DB remains UNKNOWN and not queried.
2. **PASS — read-only multi-statement SQL transaction smoke:** an actual Neon connector **transaction call** returned three ordered SELECT results, including `transaction_isolation=read committed`, `txid_current_if_assigned() IS NULL`, table count zero and `2026-11-03 + INTERVAL '12 months' = 2027-11-03`. This is evidence of Neon **database transaction SQL execution via its connector**, **not** verified equality with Logbook's `@neondatabase/serverless` HTTP implementation.
3. **PASS — error propagation:** a SELECT-only transaction whose second statement deliberately evaluated `SELECT 1/0` returned `NeonDbError: division by zero`. No persistent mutation was attempted; **this does not prove DML rollback**.
4. **PARTIAL/INCONCLUSIVE — same-owner advisory lock:** two concurrent connector tool promises each ran a transaction whose **first SQL statement** acquired the same advisory transaction lock, followed by timestamps and `pg_sleep(0.6)`. Both returned success, **but both reported the same backend PID**, and the second run's timestamp was **several seconds later**. This does **not** demonstrate two live independent clients, lock contention, fairness, or Neon HTTP driver parity. **P1/P2 remain NOT VERIFIED**.
5. **FAIL (security finding) — native Neon API-created LOGIN probe roles are NOT least-privilege defaults:** two test roles named `ft_m0b_pilot_probe` and `ft_m0b_sweep_probe`, created **only on this dedicated project**, were observed as members of `neon_superuser` with `rolcreatedb=true`, `rolcreaterole=true`, database CREATE rights. Explicit `REVOKE neon_superuser FROM ...` failed with provider permission denial. A later attempt to `ALTER ROLE ... NOLOGIN` also failed with permission denial. **No broadening/production role changes were made.** The two temporary API-created login roles were then **deleted via the Neon role API**, and absence was reverified.
6. **PASS (synthetic role model only) — restricted NOLOGIN role switching:** using scratch-only SQL DDL on the verified empty test project, created `ft_m0b_limited_pilot` and `ft_m0b_limited_sweep`, with `NOLOGIN NOCREATEDB NOCREATEROLE NOINHERIT`. Granted these to the isolated operator for test-only `SET LOCAL ROLE` inside SQL transactions. Each returned its own effective identity with `rolcreatedb=false`, `rolcreaterole=false`, `has_database_privilege(CREATE)=false`, `has_schema_privilege(public,CREATE)=false`. A following read-only statement returned the original operator role, verifying local transaction role scope had ended. These NOLOGIN roles **cannot serve as independent login credentials** and **do not prove current production app/cron separation**.
7. **PASS — scope postflight:** provider list again showed only operator and the two safe NOLOGIN scratch roles; read-only SQL showed **no user tables** and no `ft_m0b_%` fixture schema. All SQL calls specified this project's unique project/branch/database/role; no production/staging connection was requested.

### Explicit remote changes performed, and not performed

**Isolated new project changes:** created the empty project/default branch/DB/operator role, temporarily created/deleted two trial API LOGIN roles, created two NOLOGIN scratch roles, granted the isolated operator ability to SET ROLE for test-only inspection. No application schema, flight data, expense, GPS, real account or backup rows were inserted, updated, deleted or restored.

**Not done:** no prod or staging database read/write, no source-data cloning, no production SQL or migrations, no `DELETE` against flight/Trash data, no drop of application schema, no V22 DDL, no merge/deploy, no feature flag, no full-account Restore activation, no Training repo changes, no DeepSeek.

## C. P0–P8 truthful acceptance matrix (as of this checkpoint)

| Scenario | Outcome | Why |
| --- | --- | --- |
| P0 — exact isolated target/provider/SQL identity | **PARTIAL PASS** | PG16.15, branch, DB, operator and empty state verified; full hardening/transport target prove remains open |
| P1 — same-owner real two-client transaction contention | **NOT VERIFIED** | Connector attempts returned same backend PID, not proven simultaneous independent HTTP clients |
| P2 — different owners independent progress | **NOT RUN** | No real two-client app HTTP setup; no persistent owner fixture on remote |
| P3 — owner/kind/UID DB uniqueness | **NOT RUN remotely** | Requires synthetic DDL/DML and collision acceptance; earlier local PG16 synthetic proof is a distinct SHA/environment |
| P4 — restored archive and spoofed active ID rollback | **NOT RUN remotely** | No real app schema/writers installed on scratch; earlier isolated local PG16 test cannot be relabeled Neon |
| P5 — actor/database privilege isolation | **PARTIAL** | Restricted NOLOGIN role membership/permissions verified; API LOGIN roles found broad and removed. Real app/cron independent login credentials NOT proven |
| P6 — retention, legacy UID, certified Void/evidence | **NOT RUN remotely** | Read-only 12 calendar-month arithmetic PASS; no live V22 registry or signed backup evidence |
| P7 — atomic failure/retry of DML | **NOT RUN remotely** | Read-only division by zero propagated, but persistent rollback/cleanup requires isolated local PG16 or a separately assessed safe remote fixture |
| P8 — noninteractive batch HTTP driver parity | **PARTIAL** | Neon **connector** multiple-SELECT transaction PASS; exact application's serverless HTTP `neon().transaction([...])` and independent connections NOT RUN |

Test-only code `tooling/m0b-b1b2c-neon-isolation-scope.{mjs,test.mjs}` enforces a **strict literal scope guard** for the known empty project, with no DB/network; CI is separate exact-SHA evidence. Do not equate this pure guard with live provider metadata verification or grant it authority to execute DML.

## D. Open architecture / safety blockers

- Source-app \`lib/db.ts\` remains one cached \`neon(DATABASE_URL)\` query principal for pilot Trash, global cron sweep, and account privacy. This scratch role demo neither changes nor authenticates production app DB identity.
- Neon API-generated LOGIN roles having broad `neon_superuser` membership is a **real discovery**. A deployable maintenance/limited-user role needs an explicitly audited Neon privilege/grant strategy; do NOT rely on provider defaults or `SECURITY DEFINER` wrappers callable by the shared app principal to segregate owners.
- The real application has two expired Trash direct DELETE writers. Strict V22 registry constraints installed prematurely would reject current cleanup. Single-flight recovered archives retain `restored_at/restored_flight_id`; expiry must preserve active UID. Current privacy erasure does not delete active flights/FSTD; signed native/cross-user evidence and 12-month owner UID retention need legal/privacy review.
- P1/P2/P3/P4/P6/P7/P8 (full) have no Neon acceptance. Local PG16 prior lock and owner-FK tests remain historic exact-SHA partial evidence only. Do not treat build as runtime or Neon MCP connector as identical to `@neondatabase/serverless` HTTP.
- **Hard stop:** never run destructive tests against remote/production databases; the separate scratch project has **no source data**, and all subsequent changes still need exact branch/role checks and a safe, specific test design. Full-account Restore remains M0-A fail-closed. Do not touch production or Training.

## E. Next step (one)

**Develop a credential-free, read-only exact `@neondatabase/serverless` HTTP client test harness** that pins the verified dedicated project/branch/database/role through independent provider confirmation, then plan how to execute it with temporary protected credentials/isolated runner and true two-client concurrency. Run write/delete/rollback scenarios only in explicitly owned local disposable PostgreSQL16 per the project's destructive-test hard stop. Do not promote V22 migration, production role design or +12-month privacy period without separate reviews and owner approval.
