# GPS Detection 2.0 - R2.1b-P0-D3 post-DeepSeek synthetic runner hardening

**Status:** SOURCE PATCH AUTHORED / EXACT-HEAD NODE + TYPECHECK NOT RUN / SQL RLS NOT RUN
**Date:** 2026-10-17
**Repo / branch:** `filipto861/flytally-logbook` / `fix/gps-r21-p0-d3-synthetic-runner-hardening`, stacked on standalone D3 Draft PR #351. Separate from D4 Draft PR #352 and DeepSeek reconciliation docs PR #353.
**Review input:** Owner supplied DeepSeek's partial source-level F01-F14 review of all five D3 source files. Reviewer executed no Docker/PostgreSQL/SQL/Node/PowerShell and did not inspect production. Independent review feedback **RECEIVED (SOURCE ONLY)**, not runtime proof.
**Prior owner evidence:** clean D3 `3f9db21f3945a4abc72b5ba19f09c25d00d`: 16/16 original Node/mock/static PASS + TypeScript PASS. Actual PostgreSQL RLS NOT RUN, remains OPEN. New source changes cannot inherit that earlier PASS.

## Decision and accepted findings

Accept reviewer F01/F02/F04/F05/F06/F07/F08/F09/F10/F11/F12/F14. F03 `admin_count() SECURITY DEFINER` is a deliberately superuser-owned **revoked negative fixture**; keep it revoked and test the caller's effective EXECUTE denial, not assert it is safe if an operator regrants it. F06 "already absent" is accepted only when a separate successful Docker listing proves no named container remains; never ignore daemon failure. F13 extra Docker capabilities/security options are **deferred** until compatibility of the official PostgreSQL image startup is independently checked. This patch does **not** prove RLS, actual LOGIN issuance, Neon HTTP/pooled driver behavior, whole-request no-write, or real user consent.

**Correct source-wide review coverage:** S20 is telemetry/error/log leakage and S21 is CI/temporary artifact leakage per previous full R2.1b P0 design. They are not implemented as full D3 RLS/driver test cases (not "undefined in project"). S17 offline import-boundary tests are separately verified in D4/PR #350, not full SQL privileges.

## Implemented small batch

- Docker runner preflight rejects all inherited `PG*`/DATABASE_URL-style connection values, retaining explicit allowlisted child environment.
- Rejects Docker context TCP/SSH endpoints. Recognizes npipe/unix shapes as **heuristics only**, not proof of actual daemon location. Never allows real data even if context looks local.
- Resolves `postgres:16-alpine` **locally** to exact image ID `sha256:...`, requires valid ID, executes `docker run --pull=never ... image.output` to prevent implicit image retrieval/tag TOCTOU.
- Moves startup within `try/finally`, cleans by random sandbox name and **independently verifies** absence with successful Docker container listing after removal; respects `--rm` already-absent case but fails closed on uncertain cleanup.
- Adds fictional gamma role with `USAGE+SELECT` but **no applicable RLS policy**. Author-supplied SQL must return gamma 0 rows, not a permission error; compares alpha 2 and beta 1 with unchanged fabricated payloads.
- Adds selected synthetic permission negatives: ALTER TABLE, DROP TABLE, CREATE TEMP, granting another role, altering a role to BYPASSRLS; catalogs NOLOGIN/NOBYPASSRLS/NOSUPERUSER and zero memberships; verifies effective revocation of SECURITY DEFINER function for alpha. These are **new authored assertions, not executed SQL evidence**.
- Appends six synthetic/static/early-refusal Node tests (image ID/no-pull, cleanup, gamma grant-vs-RLS, context restriction, catalog/DDL source coverage, PGOPTIONS early refusal). Expected D3 focused suite: **22 cases authored**; no PASS until owner-local run.

**Explicitly deferred:** direct restricted `LOGIN` client proof (current `NOLOGIN` roles + `SET SESSION AUTHORIZATION` remain only policy fixtures), HTTP/pooled Neon driver, broad S01-S23 execution, verified full user grant/consent, S20/S21 artifacts/telemetry, capability drop/platform hardening, GRANT/REVOKE object-permission negative probes where PostgreSQL can return warnings rather than an error. Do not claim completeness.

## Local verification contract / current evidence

**Default dev:** Docker-free targeted Node/static/mock + TypeScript, from clean exact SHA. Since inherited `run-local-gates.ps1` pins the original D3 branch name, **do not modify or bypass its branch guard** while on this separate hardening branch; use direct pinned-command tests. On a future approved merge to the original D3 branch the unchanged wrapper can be used normally.

```powershell
git fetch origin
git switch fix/gps-r21-p0-d3-synthetic-runner-hardening
git pull --ff-only
git status --short
git rev-parse HEAD
npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts
if ($LASTEXITCODE -ne 0) { throw "D3 targeted Node tests FAILED" }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Repository TypeScript FAILED" }
```

No Docker, PostgreSQL, `schema.sql`, Neon or production data needed for these tests. Owner to supply full exact-SHA stdout. **Current status: Node NOT RUN / TypeScript NOT RUN / actual PostgreSQL RLS NOT RUN.** A successful future 22/22 Node result remains mock/static contract and subprocess fail-closed evidence; it **cannot close PostgreSQL RLS**.

## Next gates / rollout boundary

Review scope diff and results; update ROADMAP/FEATURES/CHANGELOG with actual runtime evidence. Keep this PR DRAFT, no merge or deploy from this research branch. Never execute the SQL manually against any configured/existing database. Future optional disposable Postgres execution requires a separately reviewed, owner-selected isolated provider and explicit opt-in; absence of Docker/native binaries is not a development blocker for unrelated work. Production/real owner GPS access, cross-owner GPS research and live auth remain NO-GO.
