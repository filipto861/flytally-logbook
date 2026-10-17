# FlyTally GPS Detection 2.0 — D3 E1 effective container attestation

**Date:** 2026-10-17
**Repo:** `filipto861/flytally-logbook`; branch `fix/gps-r21-p0-d3-container-attestation` stacked on synthetic D3 hardening Draft PR #354, **not** main or D4.
**Status:** E1 targeted owner-local Node 24/24 PASS + TypeScript PASS + Node syntax PASS on pinned SHA; Docker/SQL/RLS NOT RUN / OPEN.
**Decision:** Owner directed continuation after earlier local clean `4514274a90f300360d485eed4cb6d31530eff349` confirmed D3 post-review **22/22 Node PASS + TypeScript PASS**. Those results are historical and do not transfer to E1 source changes.

## Owner-local acceptance — exact clean source (2026-10-17)

**Verdict: E1 targeted local gates PASS at exact source `2e362aeeafe7d816c53c74c61d4c761927d56a22`; this is NOT Docker/PostgreSQL runtime acceptance.**

Owner-supplied Windows PowerShell transcript from `C:\Users\filip\Documents\GitHub\Logbook`: `git fetch origin`, checkout `fix/gps-r21-p0-d3-container-attestation`, `git pull --ff-only` reported `Already up to date`, `git status --short` empty, and `git rev-parse HEAD` exactly `2e362aeeafe7d816c53c74c61d4c761927d56a22`.

| Check | Observed evidence | Status |
| --- | --- | --- |
| `node --check research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs` | Exit code 0; PowerShell explicit `$LASTEXITCODE` guard did not throw | **PASS (owner-local)** |
| `npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts` | **24/24 PASS**, 0 fail/skipped/cancelled/todo; includes two E1 inspection/ordering tests | **PASS (owner-local)** |
| `npm run typecheck` | `tsc --noEmit`, no diagnostics; explicit exit-code guard did not throw | **PASS (owner-local)** |
| PostgreSQL 16 SQL, Docker effective inspect/runtime and RLS | Not invoked | **NOT RUN / OPEN** |
| Full Node suite, build, browser, CI, production smoke, DB migrations, deploy | Not invoked | **NOT RUN** |

GitHub scoped compare of PR #355 to #354 found only E1 research runner and two source/test assertions plus ROADMAP, FEATURES, CHANGELOG and this evidence document. **No production app/auth/db/training changes.** Owner acceptance on `2e362aeeafe7d816c53c74c61d4c761927d56a22` is tied to this exact executable source revision; any following docs-only commits are **not** individually runtime tested.

**Disposition:** E1 limited Node/TS/syntax acceptance **CLOSED**; external E1-specific independent security review **PENDING**. PostgreSQL RLS D3 overall gate remains **OPEN** and real GPS remains **NO-GO**. Draft PR #355 remains open and not merged/deployed. Passing source/static checks cannot establish actual container isolation or actual RLS enforcement.

## Reason for a separate narrow E1 batch

Review of the actual D3 runner from #354 showed that authored `docker run --network none --tmpfs ...` flags were checked by static Node assertions, but effective runtime configuration of the newly created disposable container was **not independently queried prior to initializing the SQL fixture**. A misconfigured daemon, changed defaults or unexpected mounts would not be caught by inspection of source strings alone.

The previous DeepSeek F01–F14 review was **PARTIAL SOURCE ONLY** and did not execute SQL. This E1 hardening does **not** make the external review equivalent to runtime evidence or prove physical daemon locality.

## E1 implementation

In `research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs`, after successful `docker run -d` but **before the first `psql` readiness call or `schema.sql`**, the runner:

1. Requires a full valid Docker container ID from `docker run`.
2. Calls `docker container inspect --format '{{json .}}'` for the exact random sandbox name and **does not log the full inspection output**.
3. Refuses execution unless returned container ID, name, immutable image ID, running state and `flytally.purpose=synthetic-rls-research` label match.
4. Requires effective `HostConfig.NetworkMode=none`, `PublishAllPorts=false`, `Privileged=false`, no host binds, no published port bindings (`null` or empty), exactly the three expected `HostConfig.Tmpfs` paths: `/var/lib/postgresql/data`, `/var/run/postgresql`, and `/tmp`.
5. Rejects any `Mounts` record of unexpected type/destination, and accepts known Docker inspector tmpfs representations as an array of tmpfs records or a mapping of the exact three paths. Unexpected host volume/bind mounts cause early refusal.
6. If attestation is unavailable/invalid, aborts without SQL or source data reads. Existing `try/finally` still attempts cleanup, followed by independent container absence verification, and reports uncertainty as a failure.

This is defensive validation of one **fictional offline sandbox**. It cannot prove host/daemon attestation when a local socket is tunneled; it does not prove image supply-chain origin beyond a *locally resolved* immutable Docker image ID; it does not test real LOGIN subject isolation or transaction/Neon semantics. Actual Docker inspector shape, timing, SQL startup and cleanup remain **NOT RUN**, so E1 must not be declared PASS until its own test evidence is received.

## Source support / residual risks

- [Docker CLI inspect](https://docs.docker.com/reference/cli/docker/container/inspect/) documents per-container inspection; [tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/) explain temporary mounts and inspect examples.
- [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run) defines `--pull=never` and port publishing; [PostgreSQL 16 RLS](https://www.postgresql.org/docs/16/ddl-rowsecurity.html) distinguishes ordinary SELECT grants from row policies.
- Docker inspector structures can vary. Strict shape rejection intentionally fails closed; **do not relax unexpected mounts or run SQL against another DB simply to make a test green**.
- No Docker is needed for routine FlyTally work. A Node/static test of E1 can prove source/ordering contracts, **not the Docker daemon's behavior**.

## Verification / acceptance criteria

- Changed paths only D3 experimental runner, D3 targeted Node test, ROADMAP, FEATURES, CHANGELOG and E1 doc; no `app/`, `lib/`, auth, DB migration, Neon, real tracks, training repository, merge or deploy.
- `npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts`: **24 expected test cases** (prior 22 + two E1 source guard/ordering assertions); owner-local exact clean revision **NOT RUN**.
- `npm run typecheck`: **NOT RUN** for E1 exact source revision.
- `node --check research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs`: **NOT RUN**.
- Real PostgreSQL RLS and effective Docker inspect enforcement: **NOT RUN**; separately approved isolated Postgres provider required.
- The existing `run-local-gates.ps1` deliberately pins the original D3 branch name and is unchanged. Run direct targeted Node + TS verification on this new stacked E1 branch; never bypass that guard in an operational DB invocation.

## Next

1. Have owner verify clean HEAD, targeted Node suite and TypeScript locally (no Docker).
2. Reconcile observed results and exact SHA in docs, then independently review pre-SQL inspect shape and Docker context pinning/cleanup before even considering a disposable runtime execution.
3. Preserve PostgreSQL RLS **OPEN**, production/real GPS **NO-GO**, all research Draft PRs unmerged.

**Independent review status:** previous DeepSeek D3 implementation F01–F14 received; **E1-specific external review NOT RUN**, not implied by historical feedback.
