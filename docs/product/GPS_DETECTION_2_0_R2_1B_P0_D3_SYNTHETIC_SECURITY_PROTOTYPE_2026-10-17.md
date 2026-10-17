## Owner-local PowerShell parsing PASS; strict TypeScript correction pending (2026-10-17)

Owner successfully invoked the default no-Docker `run-local-gates.ps1` on exact clean `43e42f70d56723b57c40d7cbce2215d0b8835732` in Windows PowerShell 5.1. **16/16 synthetic Node tests PASS, 0 failures/skips**; the prior script-encoding parse blocker is resolved in this run. Repository `tsc --noEmit` **FAIL** with TS2769 (`spawnSync` test-only environment missing required `NODE_ENV`) and TS2532 (`codePointAt(0)` possibly undefined), both in `tests/gps-r21-p0-d3-synthetic-security.test.ts`. Minimal test-only fix at `9c48ae2b`: explicit `NODE_ENV: "test"` and nullish-handled codepoint. **Retest on updated full HEAD NOT RUN**; PostgreSQL RLS NOT RUN, security milestone OPEN. No production/real GPS or DB activity.

# GPS Detection 2.0 — R2.1b-P0-D3 synthetic PostgreSQL isolation prototype

**Date:** 2026-10-17  
**Status:** IMPLEMENTED (isolated experiment) / **TESTS NOT RUN on this exact branch**  
**Owner scope:** Explicitly authorized **synthetic-only** database-security prototype. No approval for real account data, production credentials/roles, schema migrations, deployment, merge or cross-owner training.  
**Repository:** `filipto861/flytally-logbook` (logbook only), branch `test/gps-r21-p0-d3-synthetic-security` created from canonical `main@6a67a02475ab09c3271f8646427f7956ed6e590a`. GPS research code remains in separate Draft PR #350; original R0/R1/R2 research docs remain in Draft PR #349.  
**Design/evidence:** [Strict P0 design](https://github.com/filipto861/flytally-logbook/blob/test/gps-detection-r21-falsification/docs/product/GPS_DETECTION_2_0_R2_1B_P0_STRICT_READ_ONLY_DESIGN_2026-10-17.md), [second independent review reconciliation](https://github.com/filipto861/flytally-logbook/blob/test/gps-detection-r21-falsification/docs/product/GPS_DETECTION_2_0_R2_1B_P0_SECOND_REVIEW_RECONCILIATION_2026-10-17.md). External review PARTIAL/document-only; no claim reviewers ran SQL or inspected this code.

## 1. Exact implemented scope

### Security fixtures

`research/gps-r21-p0-d3-synthetic-security/schema.sql` defines a **fictional** Postgres schema with two independent subjects, a third unrelated subject, flights, tracks, a separate participation record, a sequence and a privileged SQL function. All GPS payloads are synthetic zero-coordinate single-element JSON. It sets **FORCE ROW LEVEL SECURITY** on `flights` and `tracks`, restricting rows by `CURRENT_USER` and same-owner flight join.

Restricted roles have `NOLOGIN NOINHERIT NOBYPASSRLS`. `admin_count()` is a deliberately privileged SECURITY DEFINER function whose default PUBLIC EXECUTE is explicitly revoked; it is a negative test object, not a backdoor for research. The setup script requires a particular throwaway DB name `r21_synthetic_lab` and runner-only synthetic session marker. No real table/column, production account or route is accessed.

### Private local disposable DB runner

`research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs` is launched only with `--synthetic-only`.

1. Refuses ambient database credentials or `DOCKER_HOST`; checks the active Docker daemon context appears local. Requires already-local `postgres:16-alpine` image; does not auto-pull or connect to a database.
2. Creates an **ephemeral Docker container** with `--network none`, **no published ports**, `--rm`, synthetic database name and `tmpfs` storage for Postgres data/socket/tmp. The image/container is independent of every production/Postgres/Neon environment. No host database URL is passed.
3. Loads only the checked-in fictitious SQL setup into that container. Each tested subject runs in a fresh `psql` process using superuser bootstrap followed by `SET SESSION AUTHORIZATION` to a restricted `NOLOGIN` fixture role. A detached production/login identity resolver is **NOT** implemented or implied.
4. Evaluates data isolation **even with no owner WHERE**, altered owner predicates, access from the other subject, unauthorized shared participant, FORCE RLS, and selected DML/DDL/sequence/role-switch/SECURITY DEFINER/row_security bypass attempts. Privilege failures are accepted only if PostgreSQL reports expected authorization denial, not any arbitrary SQL failure.
5. Checks a COPY-to-stdout of the authorized **synthetic** rows remains RLS-filtered. **COPY is not universally forbidden by SELECT permissions**: a trusted client could export its authorized data, hence production anti-exfiltration remains an independent blocked requirement.
6. Uses `finally` to remove the container and fails if cleanup fails. No result contains real user route/timestamp.
7. No application runtime import, DB migration in FlyTally, test runner credentials or replacement of existing GPS logic.

**Isolation caveats:** This tests Postgres role/RLS behavior through `SET SESSION AUTHORIZATION` inside a fresh disposable container. It **does not test authenticated login issuance**, real token/session verification, RLS configuration in production, Neon HTTP connection pooling or single-connection read-only request semantics. Local Docker context checking cannot prove physical host attestation; no raw production data are made available to the container regardless.

### Mock authorization and static fail-closed tests

`mock-authorization.ts` implements **fictional** grant/principal checks and an opaque DENY with a callback that must not run on denied requests. It is **not** a production identity authorization mechanism.

`tests/gps-r21-p0-d3-synthetic-security.test.ts` contains **12 Node synthetic/static tests** for missing/revoked/expired/wrong subject, spoofed shared flight, allowed mock call, invalid IDs, RLS policy source fixtures, runner no-network/sandbox guard and child-process refusal of missing acknowledgement and `DATABASE_URL`.

**These are separate kinds of evidence:** Node tests verify mock contracts and script guards; the Docker runner performs PostgreSQL privilege checks. Passing one **cannot** substitute for the other.

## 2. S01–S23 exact coverage and status

All statuses below indicate **IMPLEMENTED or DEFERRED**, **not execution PASS**. The full matrix in the P0 design remains the source of acceptance criteria.

| Cases | Implemented now | Still missing / does not prove |
|---|---|---|
| S01–S04 | Mock missing, expired, mismatched subject, participant-as-owner checks ensure no callback reached | Real session/grant issuance, database access audit, original subject identity |
| S05 | Actual synthetic RLS checks with omitted `WHERE`, opposite-owner selection, `WHERE TRUE`, both roles | Production RLS/roles/grants or Neon parity |
| S06 | Synthetic DML/DDL, sequence denial; COPY **authorized-only** filtering and data-row count | Whole-request production no-write, mutable extension functions, all exfil channels |
| S07 | Synthetic cross-role switching/other table/other subject denial; FORCE RLS check | Complete effective grants/PUBLIC/inheritance audit in production |
| S08 | **NOT IMPLEMENTED** in DB runner | Real `getSession()` heartbeat/migration/no-write proof |
| S09 | Mock grant expiry/revocation | Mid-query revocation/TOCTOU, durable grant lifecycle |
| S10 | **NOT IMPLEMENTED** in DB runner | Aborted partial processing, malformed JSON and max workload for live read |
| S11 | Numeric altitude 0 vs JSON null in synthetic DB | Complete source import fidelity / datum/altitude provenance |
| S12–S13 | **NOT IMPLEMENTED** in DB runner | GPS time-gap phase rules (covered separately by prior R2.1a tests), reidentification review |
| S14 | Attempt `row_security=off` must fail | Neon HTTP connection/transaction pooling and driver read-only proof |
| S15–S16 | Best-effort container cleanup; report no event truth | Crash retention/artifact audit and calibrated-contact misuse test |
| S17 | This branch changes no production application files | A separate repo import-boundary regression was verified previously on PR #350; not yet run in this branch |
| S18 | `WHERE TRUE` bypass attempt against RLS | Bound SQL injection/driver parameterization |
| S19 | Attempt invoking revoked SECURITY DEFINER function | Extended view/function search_path and mutating privileges |
| S20–S21 | Fixture contains no real GPS/credentials; no network/host mounts | Full telemetry / CI secret and artifact scanning |
| S22 | Shared-participant synthetic DB and mock checks | Complete shared-flight/certified participant permissions |
| S23 | Fresh beta role query after alpha role query | Same-connection prepared-statement/reused pooled session proof |

**Notably, S01–S23 are NOT declared fully satisfied**, and no real-data research phase is approved by this prototype.

## Owner-local first run and Docker prerequisite failure (2026-10-17)

Owner provided a complete Windows PowerShell transcript for **exact clean SHA `820b211b07c373d9123fa3c2ec023bc9909342f5`** (branch fast-forward and SHA/worktree guards completed).
- `npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts` → **12/12 PASS**, zero failed or skipped.
- `npm run typecheck` → `tsc --noEmit` **PASS** (no diagnostics).
- `docker image inspect postgres:16-alpine` → PowerShell **CommandNotFoundException**: `docker` executable not found on host.
- Subsequent runner `node .../run-synthetic-postgres.mjs --synthetic-only` → rejected before a container or query was started: **Docker context is not demonstrably local**. This is an environment prerequisite failure, **not an RLS test failure**.
- **PostgreSQL role/RLS checks: NOT RUN; combined P0-D3 gates NOT PASS.** No real DB or user track was accessed.
- The original PowerShell script used `$LASTEXITCODE` after a **PowerShell command-not-found** exception; this can retain an earlier successful native command's exit code, permitting unintended continuation. Must check `Get-Command docker` **before** any Docker invocation.

**Minimal, scoped follow-up change:** `run-synthetic-postgres.mjs` now verifies `docker --version` before checking the context and returns a precise `Docker CLI unavailable on PATH` fail-closed message. Added one focused mocked-no-Docker Node regression, so **new expected Node test count = 13**, with fresh exact-SHA execution **NOT RUN yet**. No fixture RLS policy, privilege assertions, production code, SQL schema or authorization model changed.

**Required operator prerequisite:** install/start Docker Desktop (Linux containers) following the official Windows setup instructions, and explicitly obtain the official `postgres:16-alpine` image locally. Do not reuse any configured FlyTally/Neon/Postgres `DATABASE_URL` or run SQL manually against an existing database. If Docker is unavailable, stop and record **NOT RUN**.

**Revised guarded preflight** (PowerShell; example only, pin actual new HEAD from PR #351 first):

```powershell
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI not available. Install/start Docker Desktop before running synthetic PostgreSQL tests."
}
docker version --format '{{.Server.Version}}'
if ($LASTEXITCODE -ne 0) { throw "Docker engine unavailable or not running" }
docker image inspect postgres:16-alpine *> $null
if ($LASTEXITCODE -ne 0) { throw "Image missing: explicitly run docker pull postgres:16-alpine" }
# Then and only then execute the isolated --synthetic-only runner.
```

## Owner-local Windows PowerShell 5.1 parse failure and corrective fix (2026-10-17)

**Owner exact clean checked out SHA: `a7dc905e980fe10bbb550512b5ba19f09c25d00d`.** `git fetch`, branch switch, `git pull --ff-only` and the preceding checkout completed. Attempt to invoke the newly added `run-local-gates.ps1 -ExpectedSha a7dc905e...` aborted at **PowerShell parse time before executing any script statements**:
- Error: `ParserError MissingEndParenthesisInExpression` near the `Write-Host "PASS — ..."` statement at line 39 and cascading unexpected token diagnostics.
- The script was stored as UTF-8 **without BOM** containing **9 non-ASCII em dashes**. Windows PowerShell 5.1 may decode no-BOM files using its local ANSI codepage, corrupting em dash bytes in double-quoted literals. This is a **script encoding compatibility defect**, not a proven missing parenthesis or DB/RLS failure.
- **Tests, TypeScript, native PostgreSQL detection, and Docker/SQL all NOT RUN** on the attempted `a7dc905e` invocation. Historical **12/12 Node PASS + TypeScript PASS** on `820b211b` remains separate older evidence.

**Minimal fix on research-only branch:** replaced all nine em dashes in `run-local-gates.ps1` with ordinary ASCII `-`; the whole PowerShell script is now **7-bit ASCII**, interoperable with default PowerShell 5.1 and newer shells independent of UTF-8 BOM configuration. Updated existing static test expecting the RLS-not-run marker to ASCII and added **one** regression requiring script ASCII-only, expected pass markers, and explicit RLS-not-run output. Current test file has **16 authored Node test cases**; **new HEAD 16 tests, TypeScript and PS5 script execution NOT RUN** at time of this documentation update.

**Verification evidence of fix:** GitHub source-read check confirmed ASCII-only `.ps1`, expected messages and presence of corrected regression. No Windows PowerShell executable is available in the assistant environment, so PS5 runtime parse is **NOT locally executed** by ChatGPT. The owner needs to rerun the exact-HEAD script. **Default remains database-free**: even after Node/TypeScript PASS, RLS remains **NOT RUN / overall security gate OPEN**. No requirement to install Docker.

## Docker-optional operator workflow — decision update (2026-10-17)

The owner does **not** want Docker added as a mandatory FlyTally development dependency. **Decision: accepted.** This overrides the older 'Required operator prerequisite' paragraph and Docker-first commands above for the **normal** local workflow. The Docker PostgreSQL runner remains an **explicitly optional** backend for future RLS proof, not a requirement to run Node or TypeScript.

**New single-entry local wrapper:** `research/gps-r21-p0-d3-synthetic-security/run-local-gates.ps1`, from repo root, requires a full expected clean HEAD SHA.

| Mode | Invoked by | Executed | Explicit result |
|---|---|---|---|
| Default, **no Docker** | `-ExpectedSha <full SHA>` | Existing `npm run test:target` on P0-D3 Node fixture + full `npm run typecheck`; detect native `initdb/pg_ctl/psql` availability without opening a DB | PASS for Node/TypeScript if green; **RLS NOT RUN; overall security gate OPEN** |
| Optional Docker | `-ExpectedSha <full SHA> -PostgresProvider docker` | Same Node/TypeScript + explicit local Docker image/daemon preflight + disposable offline Postgres RLS runner | Full **SYNTHETIC** gate PASS only if all checks actually succeed |
| Native PostgreSQL alternative | **No executable provider yet** | Local native toolchain presence is diagnostic only | **NOT RUN** until independently reviewed disposable `initdb/pg_ctl/psql` lifecycle and safe isolation are implemented, never an existing database |
| GitHub Actions/CI | **Not configured/authorized for this milestone** | No hosted DB tests | NOT RUN; do not assume credits/service or report CI PASS |

**Reason for not immediately invoking a native local `psql`:** a `psql` executable does not create an isolated empty cluster or prove a safe target. Passing an existing `PGHOST` / `DATABASE_URL` or using `npm run test:postgres` would bypass the approved synthetic-only test scope. Native execution requires a separate controlled `initdb`, ephemeral data directory, independent local endpoint and force-cleanup verification; no silent fallback is permitted.

The wrapper validates the exact branch, 40-character SHA, clean working tree, exit codes and prints **different terminal statuses**. The offline default cannot legitimately print `ALL SYNTHETIC GATES PASS` because PostgreSQL permissions were not exercised. It uses only repository Node/TypeScript prerequisites already available to the owner and runs **no Docker**, no `PG*` database commands and no SQL.

**New test evidence:** Added two static contract tests for the wrapper's default offline behavior and exact-SHA/no-fallback checks. Total `tests/gps-r21-p0-d3-synthetic-security.test.ts` now has **15 authored test cases** (prior 12 owner-local PASS at `820b211b`, plus missing-Docker regression and these two new tests). **New head 15 tests/typecheck NOT RUN; RLS NOT RUN.** A count of 15 is not a PASS assertion.

**Next normal local invocation** (replace `<CURRENT_FULL_SHA>` with current PR #351 HEAD; run from clean repo root):

```powershell
& .\research\gps-r21-p0-d3-synthetic-security\run-local-gates.ps1 -ExpectedSha "<CURRENT_FULL_SHA>"
```

**Do not install Docker or PostgreSQL solely to continue other FlyTally/GPS work.** RLS remains a distinct open security gate before any actual owner GPS data access; an unrun gate must not be relabeled PASS or N/A.

## 3. Verification plan and runtime controls

**Local environment observation by ChatGPT:** its environment currently has Node but **does not have Docker or PostgreSQL binaries**. Therefore this isolated Postgres runner **has not executed**; no synthetic PostgreSQL role test PASS is claimed.

First run on the owner's Windows PC, from a clean checkout of this branch with exact pinned HEAD:
```powershell
# Inspect existing local Docker availability; these commands use no real DB.
docker --version
docker info
docker image inspect postgres:16-alpine
# If image missing, explicitly download official synthetic DB image:
# docker pull postgres:16-alpine

npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts
if ($LASTEXITCODE -ne 0) { throw "Mock/static research security tests FAILED" }

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED" }

node research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs --synthetic-only
if ($LASTEXITCODE -ne 0) { throw "Synthetic Postgres RLS test FAILED" }

Write-Host "R2.1b-P0-D3 SYNTHETIC LOCAL GATES PASS"
```

**Never run `schema.sql` manually against a configured/existing DB.** If Docker or the image is unavailable, status is `NOT RUN`; do not substitute the existing app's `DATABASE_URL` or `npm run test:postgres`, which targets a different database and scope. Environment guards intentionally **fail** when `DATABASE_URL` / `PGHOST` or similar variables exist. A real Postgres or Neon URL is never needed.

**DoD for this milestone:** exact-SHA Node mock/static suite PASS; repository `npm run typecheck` PASS; isolated Docker/Postgres RLS probes PASS; Docker container deleted; source file & output review; required ROADMAP/FEATURES/CHANGELOG closeout with actual evidence, not assumptions. Full release build/Playwright/CI may be N/A for unshipped research but must not be advertised as run.

## 4. Immutable safety limits and next gates

- **This is a security *falsification* prototype**, not proof that production DB credentials are secure, privacy guarantees hold or raw owner tracks can be accessed.
- No user/account identity in logs, no raw points, no published aggregates, no passing private records to ChatGPT/DeepSeek/GitHub, no networked research endpoint.
- No schema, auth, tracking, regulation/recency or certified flight changes in `main` or `flytally-training`.
- No production DB/Neon roles, RLS, views, grants, passwords or migrations. No provisioning of even a production-clone DB branch.
- No ML/HMM, source performance figures, real touchdown accuracy or automatic whole-flight landing counts.
- **Next after local PASS:** independent adversarial source review of the implemented SQL/runner; identify missing S tests and potential operator bugs before any further security-scope approval. **Real-record P1 remains NO-GO** even after all synthetic checks pass.

