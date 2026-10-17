# GPS Detection 2.0 — P0-D3 E1b no-Docker pre-runtime evidence gate

**Date:** 2026-10-17
**Repository/branch:** `filipto861/flytally-logbook` / `fix/gps-r21-p0-d3-e1a-mock-docker`, stacked synthetic Draft PR #357, not `main`.
**Status:** **E1b BOUNDED OWNER-LOCAL OFFLINE GATE PASS: 35/35 NODE + 2 SYNTAX + TYPESCRIPT ON EXACT CLEAN SHA**. Actual Docker/PG16 SQL/RLS **NOT RUN / D3 SECURITY OPEN**; real GPS/Neon NO-GO.

## Owner-local E1b acceptance — exact clean SHA (2026-10-17)

**LIMITED OFFLINE GATE: PASS at `e14bc91314e2439859f3ea381d93abb7c43a25cd`.** This is **NOT** PostgreSQL RLS security acceptance.

Product owner supplied full Windows PowerShell execution transcript from `C:\Users\filip\Documents\GitHub\Logbook`. `git fetch origin`, `git switch fix/gps-r21-p0-d3-e1a-mock-docker`, `git pull --ff-only` fast-forwarded cleanly to `e14bc91314e2439859f3ea381d93abb7c43a25cd`; `git status --short` was empty and `git rev-parse HEAD` matched exactly. The operator executed only:

```powershell
& .\research\gps-r21-p0-d3-synthetic-security\run-local-gates-e1a.ps1 -ExpectedSha "e14bc91314e2439859f3ea381d93abb7c43a25cd"
```

| Gate | Observed result | Evidence class |
| --- | --- | --- |
| Expected branch, SHA and clean worktree | Gate printed `E1a synthetic-only offline gate, clean SHA e14bc91314e2439859f3ea381d93abb7c43a25cd` | **PASS, owner-local** |
| Two `node --check` commands (guard and runner) | Script continued without exception; each command is guarded by `$LASTEXITCODE` | **PASS, owner-local (through wrapper)** |
| D3 + E1a fake-Docker targeted Node tests | `tests 35; pass 35; fail 0; cancelled 0; skipped 0; todo 0` | **35/35 PASS, owner-local** |
| `npm run typecheck` | `tsc --noEmit`, no diagnostics; wrapper printed success | **PASS, owner-local** |
| Cleanup/inspect on actual Docker daemon and PG16 SQL/roles/RLS | Wrapper explicitly printed `NOT RUN - Docker, PostgreSQL SQL, role/RLS or any external database` | **NOT RUN / D3 GATE OPEN** |
| Full Node suite, production build, browser/Playwright, CI, production/Neon DB, migrations, deploy | Not invoked | **NOT RUN** |

PowerShell also printed `PASS - E1a local syntax, targeted Node and TypeScript (not CI)` and `OVERALL P0-D3 SECURITY GATE OPEN - real PostgreSQL RLS not executed`. The 35 tests include source/mocked authorization and fake-Docker guard logic, **not** actual Docker runtime, PostgreSQL RLS enforcement or real authenticated user access.

**Conclusion:** E1b bounded no-Docker owner-local acceptance **CLOSED** on the exact pinned code revision. The two DeepSeek pre-runtime items (standalone gated test and privilege-only labeling) are implemented and locally tested. The independent source-only DeepSeek **CONDITIONAL GO** applies to **preparing** a future disposable synthetic PostgreSQL experiment, not permission for it to run, install Docker, touch Neon or use real GPS. Keep stacked PR #357 **Draft/unmerged**. Any following documentation-only HEAD is not a separately tested SHA; compare changed files before inheriting source evidence.

### Next distinct decision

Conduct a read-only inventory of the operator's available optional local Docker environment (if the owner chooses) or native Postgres alternative; identify exact isolation preconditions. Do not make Docker mandatory or launch `run-synthetic-postgres.mjs --synthetic-only` without a **separate, explicit operator decision**. P0-D3 actual PostgreSQL RLS stays **NOT RUN / OPEN** and all real GPS/Neon/login/driver/consent/security gates remain **NO-GO**.

## Independent review decision

Product owner supplied DeepSeek's E1a seven-file adversarial review on 2026-10-17. **Independent source-only review RECEIVED, actual SQL/Docker/Node by reviewer NOT RUN**. DeepSeek's conclusion: E1a is **conditionally acceptable for preparation** of an **owner-optional, disposable synthetic PostgreSQL runtime**, with **no identified High/security blocker** after E1-F01/F02/F03/F08 repairs. It is **not approval to start Docker, download images, run SQL, merge, deploy or read real GPS**.

Two accepted pre-runtime items:
1. E1a test suite previously ran manually but was not wired into a standalone SHA/branch guarded gate; preserve original D3 `run-local-gates.ps1` with its original D3 branch guard.
2. Clearly label negative `unrelated`/`participants`/`SECURITY DEFINER` access tests as **privilege-only**, not RLS. The synthetic gamma `USAGE+SELECT` plus missing applicable RLS policy is the actual RLS default-deny probe (actual SQL **NOT RUN**).

One bounded low-risk fix: effective `HostConfig.Tmpfs` option checker now rejects contradictory `rw,ro` tokens and its fake-Docker test covers the negative. **Unknown option tokens remain allowed**; current checker attests required tokens, lack of expressly denied tokens and exact size, **not full kernel mount-option semantics**. Wider normalization/allowlisting is deliberately deferred until actual Docker evidence, not guessed.

**Correction to reviewer:** DeepSeek said S20/S21 remained undefined. In the broader frozen FlyTally P0 security design, **S20 = logs/telemetry/errors** and **S21 = CI/debug/temporary artifacts**. These cases are NOT fully tested by D3 and are NOT approved just because they are defined.

## Narrow implementation

- Added `research/gps-r21-p0-d3-synthetic-security/run-local-gates-e1a.ps1` (ASCII-only, Windows PowerShell 5.1).
- Requires `-ExpectedSha` as a 40-hex full SHA, confirms current exact `fix/gps-r21-p0-d3-e1a-mock-docker` branch and clean working tree (including untracked files). Checks for nonempty inherited `PG*`, `DATABASE_URL`, `DIRECT_URL`, `NEON_DATABASE_URL`, `DOCKER_CONTEXT`, `DOCKER_HOST` before running tests, without displaying values.
- Runs two `node --check` syntax commands, **both targeted Node files** through `npm run test:target`, then `npm run typecheck`. Each command has an explicit exit-code guard. Runs **NO docker CLI, PostgreSQL, schema.sql, native PG or network action** itself.
- Existing D3 original `run-local-gates.ps1` is **unchanged**.
- Three negative SQL assertion labels now say `privilege-only`; no SQL/authorization logic or expected values changed.
- Pure synthetic tmpfs guard adds `ro` rejection and a dynamic fake-response negative test.
- Added one Node source contract test for new PowerShell gate, resulting in **35 Node tests authored total** (24 original D3, 10 fake-Docker dynamic plus 1 E1b gate structure). **35/35 is target, not yet verified PASS.**

## Owner local evidence contract — NOT RUN ON NEW SHA

At repo root, confirm correct branch and clean full SHA. Invoke:

```powershell
& .\research\gps-r21-p0-d3-synthetic-security\run-local-gates-e1a.ps1 -ExpectedSha "<FULL_GITHUB_HEAD_SHA>"
```

**Expected, not yet measured:** two Node syntax `PASS`, targeted Node **35/35 PASS**, TypeScript `PASS`, clear output that PostgreSQL RLS was `NOT RUN / OPEN`. Gate refuses wrong branch, wrong SHA, dirty worktree, inherited DB/PG/Docker context settings. **Do not attempt to bypass the refusal by disabling guards.** If it fails, show the entire owner-local output with source SHA; do not reinterpret it as PASS.

**Existing evidence remains pinned:** clean owner `54ea8aeea4c848a4d79cfdf6f11fd5cdae4e242e`: **34/34 Node PASS + TypeScript PASS**; syntax checks at prior clean `850318d1` and unchanged source. This is **not** test evidence for this E1b patch or new 35th test.

## Release and RLS boundaries

- Synthetic Docker runner **not executed**, no Docker Desktop inspector proof, no PostgreSQL 16 catalog/RLS SQL proof, no real LOGIN or Neon HTTP/pooled driver, no per-owner consent/no-write/retention proof.
- A future isolated PostgreSQL run is **owner-optional and requires separate explicit opt-in** after verifying target and local image; ordinary E1b Node gate never triggers it. No Docker installation forced.
- No `app/`, `lib/`, user GPS, production schema or auth changes. No migration, export, public endpoint, merge or deploy.
- E1b targeted local acceptance remains **OPEN until observed clean-exact-SHA test evidence**. Keep Draft PR #357. The full D3/real-data gate remains **OPEN / NO-GO** regardless of future E1b Node PASS.
