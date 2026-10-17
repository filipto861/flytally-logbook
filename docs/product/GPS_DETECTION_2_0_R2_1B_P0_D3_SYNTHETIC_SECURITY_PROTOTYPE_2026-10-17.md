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

