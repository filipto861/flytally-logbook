# GPS Detection 2.0 R2.1b-P0-D3 — DeepSeek source review reconciliation

**Date:** 2026-10-17
**Scope:** actual D3 synthetic SQL/runner/source contract, original pinned `3517cde1f5e000128c75b1298594a55764ab5f31`. DeepSeek reviewed the five embedded source files but performed **NO PostgreSQL, Docker, Neon, SQL, Node, or PowerShell execution**. This is an **independent PARTIAL source review**, not DB/runtime or real-data authorization.
**Input:** product-owner-supplied complete DeepSeek review, F01–F14 findings, S01–S23 coverage table and separate GO/NO-GO decisions. DeepSeek's original response is supplied in owner conversation; this document preserves and reconciles its conclusions without claiming independent access to production. [Pinned source packet](GPS_DETECTION_2_0_R2_1B_P0_D3_DEEPSEEK_SECURITY_SOURCE_REVIEW_PACKET_2026-10-17.md); [prior ChatGPT source audit](GPS_DETECTION_2_0_R2_1B_P0_D3_SOURCE_AUDIT_AND_PROVIDER_DECISION_2026-10-17.md).

## 1. Reviewed findings, source disposition, narrow implementation

| ID | Finding | Disposition | Planned/required follow-up |
| --- | --- | --- | --- |
| F01 | Node/static/mock PASS does not exercise real Postgres RLS | **ACCEPT HIGH** | Keep RLS **NOT RUN / OPEN** until actual disposable PG execution; do not upgrade from static tests |
| F02 | `SET SESSION AUTHORIZATION` using bootstrap `postgres` is NOT independently issued LOGIN/Neon identity | **ACCEPT HIGH** | Model-policy harness may be used only as supplementary synthetic policy check. Direct restricted LOGIN/driver proof is a **separate security milestone**, not implied by D3 |
| F03 | Superuser-owned `SECURITY DEFINER admin_count()` could bypass RLS if EXECUTE exposed | **ACCEPT RISK, CLARIFY FIX** | This is intentionally a **negative adversarial test object**, not production code. Retain synthetic fixture and keep EXECUTE revoked; add explicit privilege/catalog assertion. Do not casually change owner to one with insufficient SELECT and thereby destroy the test |
| F04 | Unrelated role and participant access denied via missing object privileges does not demonstrate policy filtering | **ACCEPT** | Add third granted-but-unpolicied synthetic subject (gamma) with USAGE+SELECT yet no matching `CREATE POLICY`; require query returns zero rows, not permission error |
| F05 | Mutable image tag and default implicit pull allow unintended image/network resolution | **ACCEPT** | Inspect local image ID; refuse malformed digest; `docker run --pull=never` with exactly the locally resolved immutable image ID |
| F06 | `--rm` and unconditional `docker rm -f` may falsely report cleanup failure | **ACCEPT WITH STRICT CONDITION** | Idempotent cleanup must independently confirm container absence via a successful Docker listing on removal failure. **Do not ignore** daemon failure or ambiguity |
| F07 | `tracks` RLS EXISTS subquery into `flights` not runtime confirmed | **ACCEPT AS HYPOTHESIS** | Empirically verify PG16: alpha 2, beta 1, gamma 0, unrelated excluded; SQL source is not PASS |
| F08 | `tcp://localhost` Docker context may be forwarded to remote daemon | **ACCEPT** | Reject TCP and SSH; recognize only documented npipe/unix syntax as **heuristic**. Even a local socket cannot attest physical host; no real data permitted |
| F09 | In-band custom GUC and database name are caller settable, not trust boundary | **ACCEPT** | Keep defense-in-depth fixture marker and rely on explicit runner/throwaway instance; never manually run SQL on existing DB |
| F10 | Selected ALTER/DROP/TEMP/GRANT/role catalogs not tested | **ACCEPT, SCOPED** | Add a small clear set of synthetic permission probes and catalog checks. Never advertise full S01–S23 from them |
| F11 | COPY may export authorized rows | **ACCEPT** | Treat authorized COPY as expected. In-boundary client/telemetry/data minimization remains separately unresolved |
| F12 | Host preflight lacks PGOPTIONS/PGDATABASE et al | **ACCEPT DEFENSE IN DEPTH, LOW RISK** | Child Docker env is currently allowlisted, not forwarding ambient PG*. Harden future runner to explicitly reject relevant inherited `PG*` settings without displaying their values |
| F13 | Missing generic Docker capability/resource hardening | **DEFER PLATFORM-SPECIFIC CHANGE** | Consider only after checking official Postgres image startup/privilege requirements; `--cap-drop=ALL` or `no-new-privileges` unverified could break expected image initialization. No real secrets/data are sent |
| F14 | Default no-Docker gate doesn't exercise Postgres | **ACCEPT AS CORRECT INTENT** | Retain default `PostgresProvider=none` and explicit `OVERALL ... OPEN`. Docker/native always opt-in |

### Corrections to independent reviewer coverage matrix

**S20 and S21 are defined in the earlier full architecture** (not undefined in the project): **S20** covers driver logging, telemetry/tracing/errors; **S21** covers CI, debugging and temporary artefact leakage. They are **not implemented/executed as D3 complete test cases**. A review packet may not expose their full historical text, but that does not make them undefined. Likewise, **S17** is a separate research-versus-production import boundary test in PR #350 / D4 (owner-local PASS on a separate SHA); it is not equivalent to an actual D3 SQL privilege proof. S10/S12/S16 have synthetic/offline coverage elsewhere but **no direct D3 SQL execution evidence**.

The reviewer marked **EXECUTED PASS = none for actual SQL/RLS**, which is correct, but one must preserve **owner-local 16/16 Node/mock/static + TypeScript PASS** at the separate pinned D3 code SHA `3f9db21f3945a4abc72b5fe269bff528e7db5967`; these are distinct evidence classes.

## 2. Frozen decisions

1. **GO limited synthetic D3 hardening on independent small branch** off D3 Draft PR #351. No SQL execution by assistant, no production DB or real GPS. Preserve no-Docker default and keep optional Docker backend only with explicit user action. Do not merge before verification and review.
2. **NO mandatory Docker.** An optional Windows native disposable PostgreSQL runner remains **DESIGN ONLY**; no installed `initdb/pg_ctl/psql` toolchain was detected on owner PATH; no auto-install, existing-local/shared-DB use or substitution.
3. **NO-GO real owner GPS** until subject consent, non-write identity, DB-enforced owner restriction including driver parity and revocation, privacy, full-fidelity input/quality and independent governance proof. Synthetic policy PASS (if eventually earned) does not imply production GO.
4. Keep `SECURITY DEFINER` fixture negative with explicit refusal; direct LOGIN proof, connection pooling, branch/session read-only are deferred separate milestones, not deceptively declared covered.

## 3. Small hardening acceptance and test evidence

**Targets:** D3 standalone `schema.sql`, `run-synthetic-postgres.mjs`, `tests/gps-r21-p0-d3-synthetic-security.test.ts`, optional documentation only. No changes to D4 research or production `app/`, `lib/`, `components/`, DB schema/migrations, auth or shared server. Proposed tests: image-pin/no-pull; strict context (no TCP); verified cleanup; granted-but-unpolicied gamma; catalog/DDL/TEMP/GRANT checks; reject ambient PGOPTIONS and PGDATABASE; retain exact-SHA PowerShell wrapper and no-Docker mode unchanged.

**Owner-local gates pending on new code:** `npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts`, `npm run typecheck` on clean exact SHA. Actual PostgreSQL execution remains **NOT RUN** until independently acceptable disposable environment and owner opt-in. No release build, Playwright, migration/DB or deploy claims.

## 4. Next decision after verification

Review patched code against this contract, record exact SHA and independently reviewed findings, then ask owner for ordinary offline Node+TS evidence. If no safe Postgres environment available, maintain **RLS OPEN** and continue other approved offline GPS milestones without pressure to install Docker. No automatic escalation from synthetic to real owner data.
