# FlyTally GPS Detection 2.0 — D3 E1a fake-Docker hardening

**Date:** 2026-10-17
**Repository:** `filipto861/flytally-logbook`, isolated `fix/gps-r21-p0-d3-e1a-mock-docker`, stacked on Draft PR #355, based on its docs-only `83eaec732b5a6190a959b0dfd356006939e70edf`. Other D3/D4 repos/PRs are separate.
**Status:** SOURCE PATCH + TESTS AUTHORED; new exact-SHA Node / TypeScript / syntax **NOT RUN**. Docker / PostgreSQL / role-RLS **NOT RUN / OPEN**. No merge/deploy.
**Input:** product-owner-supplied DeepSeek E1 independent **PARTIAL SOURCE-ONLY** review. The reviewer did not execute Docker, PostgreSQL, Neon, Node, SQL or PowerShell. E1 prior clean `2e362aeeafe7d816c53c74c61d4c761927d56a22` owner-local: **24/24 targeted Node + TypeScript + Node syntax PASS**, which does not transfer to this E1a code.

## Independent E1 findings (E1-F01–F10) and decisions

| Finding | Disposition | E1a scope or deferral |
| --- | --- | --- |
| F01 name-based cleanup, potential false verification | **ACCEPT — HIGH, BLOCKER** | Exact 64-char created container ID used for `rm -f` and `docker ps -aq --no-trunc --filter id=ID`; daemon/list failure or remaining ID = unverified; if run did not return a valid ID, attempt name removal but **never** mark verified. No trust in name-filter regex |
| F02 duplicate `Mounts` destinations can masquerade as complete set | **ACCEPT — BLOCKER** | Array representation must be exactly 3 unique known destinations (one each). Reject missing, duplicates, extra or unexpected type. Map representation must have exactly known three keys |
| F03 `HostConfig.Tmpfs` value/options not checked | **ACCEPT — BLOCKER** | Check `rw`, `nosuid`, `noexec` for PGDATA, and exact positive size `256m` / `16m` or equivalent byte count. Explicit `exec`, `suid`, `dev` and malformed/duplicate tokens refused; unknown representation fails closed. This is **Docker configuration assertion**, not proof of effective kernel mount flags |
| F04 inspection after Docker entrypoint has started | **ACCEPT WORDING, DEFER LIFECYCLE REFACTOR** | Runner inspects **before runner-issued `psql` and `schema.sql` only**, not before PostgreSQL image entrypoint initialization. Synthetic-only temporary container with no host binds/ports authored; switching to `docker create` → inspect → start is separate API/lifecycle work requiring review, not silently implemented |
| F05 unrelated-role/participant privilege failures mislabeled as RLS | **ACCEPT** | Preserve separate privileged-object denials. Only fictitious gamma USAGE+SELECT plus no applicable policy is a direct proposed default RLS proof, actual SQL NOT RUN |
| F06 local ID pin != trusted upstream digest/signature | **ACCEPT** | Local immutable image ID + `--pull=never` protects against accidental pull/tag TOCTOU only, not image authenticity |
| F07 local pipe/unix context regex != trusted physical host | **ACCEPT** | Document heuristic limitation; no production credentials/data |
| F08 lacks dynamic fake-Docker parser/cleanup tests | **ACCEPT** | Introduced injectable pure guards and 10 deterministic fake-Docker response tests; tests exercise actual validation/cleanup functions dynamically, **NOT full spawned CLI lifecycle or actual daemon** |
| F09 extra container cap/seccomp/user/resource flags | **DEFER** | Official image startup/platform compatibility unresolved; never advertise a hardened production sandbox |
| F10 `DOCKER_CONTEXT` omitted from child env allowlist | **ACCEPT NO EXPLOIT ON CURRENT SOURCE** | Existing allowlist intentionally omits it. Separate defense-in-depth future change only if required |

S20 telemetry/error output and S21 artifacts remain security-design cases without completed D3 runtime coverage. D3 `NOLOGIN` roles exercised via privileged `SET SESSION AUTHORIZATION` remain only **synthetic policy-context simulations**, never actual authenticated LOGIN/Neon/consent.

## Implementation contract

1. New `research/gps-r21-p0-d3-synthetic-security/container-guards.mjs` and `.d.mts` expose testable **no-I/O** validation, inspect-with-injected-command and exact-ID cleanup. Do not allow an environment flag to skip checks.
2. Existing optional Docker runner calls guards after `docker run -d` and before its first `psql` or fixture. It captures full created ID; ID-bound cleanup even when `--rm` already removed container, only when successful ID-filtered `ps` confirms absence. Malformed/absent ID never yields verified cleanup.
3. Update prior D3 source/ordering assertions to follow extracted guard logic. Keep 24 original tests authored; add **10** dynamic malicious fake-Docker response cases in `tests/gps-r21-p0-d3-e1a-fake-docker.test.ts`. Expected targeted total **34 tests**, but **NOT RUN**.
4. No production `app/`, `components/`, `lib/`, auth, persisted GPS, DB migrations, Neon, shared data, external file exports, cross-account training, runtime feature flag or deployment.
5. Unchanged `run-local-gates.ps1` pins original standalone D3 branch. On E1a stacked branch **use direct pinned local Node/TS commands**, never bypass the PowerShell identity/branch guard for an operational DB run.

## Local no-Docker acceptance procedure (PENDING)

Verify clean exact HEAD, then:
```powershell
node --check research/gps-r21-p0-d3-synthetic-security/container-guards.mjs
node --check research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs
npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts tests/gps-r21-p0-d3-e1a-fake-docker.test.ts
if ($LASTEXITCODE -ne 0) { throw "E1a Node tests FAILED" }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "E1a TypeScript FAILED" }
```

**Target Node 34/34 PASS, TypeScript PASS, two syntax checks PASS** on an exact clean new source SHA. No result is claimed before a real transcript. Dynamically mocking Docker `inspect`/cleanup responses is useful adversarial evidence, but NOT evidence of actual Docker Desktop behavior, SQL execution, RLS isolation, or production principal correctness. CI, full test suite, browser/build and runtime DB remain NOT RUN until separately authorized.

## Remaining security gates and rollout

- E1a code gates are **PENDING** until owner-local evidence; external E1 review feedback **RECEIVED/SOURCE ONLY**, independent re-review of E1a implementation **NOT RUN**.
- Optional disposable Docker/Postgres requires explicit owner opt-in, test image provenance review, native Docker daemon isolation/inspect semantics, verification of effective mount behavior and cleanup under real failures. Do **not** auto-install Docker or swap to local/shared/production DB.
- D3 PostgreSQL actual role/RLS **NOT RUN / OPEN**; real user LOGIN/Neon HTTP connection/read-only semantics and consent/provenance **NO-GO**.
- Cross-owner GPS / production logbook / Learjet training / migrations / public endpoint / merge / deploy: **NO-GO**. There is no independent physical touchdown ground truth.

**Documentation discipline:** Once source tests are actually run, pin exact SHA and reconcile ROADMAP/FEATURES/CHANGELOG in same work cycle, preserving this preregistered contract.
