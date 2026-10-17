# GPS Detection 2.0 — R2.1b-P0-D3 source audit and Docker-optional provider decision

**Date:** 2026-10-17
**Status:** INTERNAL SOURCE REVIEW / INDEPENDENT SECOND-AI REVIEW PENDING / RLS EXECUTION NOT RUN
**Repository:** `filipto861/flytally-logbook` only.
**Source baseline:** isolated D3 Draft PR #351, exact source revision `3517cde1f5e000128c75b1298594a55764ab5f31`. This document is on a separate documentation-only branch stacked on D3, not on `main` or D4.
**Current evidence:** owner Windows PowerShell 5.1 clean `3f9db21f3945a4abc72b5fe269bff528e7db5967`: 16/16 Node mock/static tests PASS and `tsc --noEmit` PASS; **actual PostgreSQL SQL/role/RLS NOT RUN**, no complete native PostgreSQL toolchain on owner PATH. Later D3 documentation-only HEAD not runtime tested. D4 research robustness accepted on its **separate** clean `749dc45932df462e37b3c34cbd50db04c9661bec`: 17/17 targeted Node PASS + typecheck PASS; it is **not** DB security proof.

## 1. Scope and evidence taxonomy

| Scope | Source observation or evidence | Status/meaning |
| --- | --- | --- |
| Existing Docker-independent owner checks | `run-local-gates.ps1` defaults to `PostgresProvider=none`, pins clean branch+full SHA, runs 16 synthetic Node cases and typecheck, explicitly reports RLS NOT RUN | **PASS only for prior exact owner-tested Node/TS/PS SHA** |
| Existing Docker-only synthetic SQL driver | `run-synthetic-postgres.mjs` uses local-context check, local image, random container name, `--network none`, no published ports, `tmpfs`, cleanup | **SOURCE REVIEWED / PostgreSQL NOT RUN** |
| Existing RLS SQL fixture | `schema.sql`: synthetic roles, forced RLS on flights/tracks, owner role compared to `CURRENT_USER`, restricted `SELECT`, fictitious data | **SOURCE REVIEWED / behavior NOT EXECUTED** |
| Independent second-AI assessment of *this code* | No DeepSeek/Claude source/SQL/runtime feedback received for D3 implementation or native provider | **NOT RUN / REVIEW PENDING** |
| Real owner GPS, production/Neon role grants, actual credentials and HTTP driver | Neither known nor inspected/approved | **NO-GO** |

No Docker or native PostgreSQL installation is necessary to continue unrelated/offline application work. An RLS gate cannot be waived, inferred from mock tests, or replaced by an in-memory PostgreSQL emulator.

## 2. Source-derived findings and possible falsification gaps

1. **S05 and forced policy are authored, not yet measured.** The SQL fixture restricts `tracks` to `owner_role=CURRENT_USER::name` **and** requires a matching visible `flights` row; `flights` also uses forced RLS. The runner includes owner-unfiltered `SELECT` and swapped owner predicate tests. Actual SQL result/role effective context must be established by PostgreSQL, not a regex/static test.
2. **Mocked role identity is NOT authentication.** Subject roles are `NOLOGIN`; for each synthetic `psql` call the runner authenticates as bootstrap `postgres`, then executes `SET SESSION AUTHORIZATION r21_subject_alpha/beta`. PostgreSQL permits privileged initial session users to change session authorization. This is a reasonable RLS falsification technique but **does not test an independently issued restricted login credential or an HTTP driver principal**.
3. **Effective grants and bypass paths remain incompletely probed.** Existing checks include `INSERT/UPDATE/DELETE/TRUNCATE`, one `CREATE TABLE`, sequence `nextval`, one `SET ROLE`, a forbidden `SECURITY DEFINER` call, participation-table access, and `row_security=off`. Not shown: independent privileged-role catalog inspection of `pg_auth_members`, `rolbypassrls`, effective inherited privileges, function default grants beyond this named function, view ownership/security invoker, alternate schemas, temp objects, `ALTER/DROP`, or PostgreSQL-specific superuser/RLS flags. **Some are new test design**, not claims of a demonstrated exploit.
4. **S09/S14/S23 are not complete.** Static/mocked expiration and a fresh beta `psql` invocation exercise only narrow parts of S09 and S23. S14's `row_security=off` negative probe tests one PostgreSQL setting, **not** the actual Neon's pooled/HTTP per-request read-only transaction path, including writes/tracing/session-heartbeat side effects or principal reuse.
5. **S06 authorized COPY remains possible by design.** The runner expects `COPY (SELECT id ...)` to return alpha's two synthetic identifiers; this tests unauthorized-row exclusion, **not** that any authorized data are impossible to export. The trusted-client/output/telemetry/retention boundary is separate. PostgreSQL RLS is not a raw-data exfiltration prevention mechanism for authorized SELECT.
6. **No raw-data privacy or real-event truth proof exists.** The policy uses fictional zero-coordinate JSON; simulated consent/owner maps are not actual authorizations. In-memory cohort counts (5–50) are workload bounds, not anonymization. Algorithm agreement is not independently verified wheel contact.
7. **Operator-only DB target safeguards are not standalone schema authorization.** `schema.sql` tests database name and a caller-settable `r21.synthetic_only` marker. Safety relies on the reviewed runner selecting a newly created disposable container; the SQL marker alone does **not** authorize or prove an isolated cluster. Never run that SQL manually on an existing database.
8. **Native provider not implemented.** Default local wrapper uses `Get-Command initdb/pg_ctl/psql` only for availability diagnostics, then stops. Missing tools on the owner's PATH give **NOT DETECTED**, not an implicit local server. Existing `DATABASE_URL`, Neon, another developer's database, or `npm run test:postgres` are invalid substitute targets.

### Notes from upstream PostgreSQL documentation

- RLS policy grants complement object privilege grants; `TRUNCATE` is not filtered through row policy; superusers and `BYPASSRLS` roles bypass RLS, and table owners normally bypass unless `FORCE ROW LEVEL SECURITY` is enabled: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- A privileged original session user can change session authorization, changing `SESSION_USER` and `CURRENT_USER`: https://www.postgresql.org/docs/16/sql-set-session-authorization.html
- `initdb` creates an independent cluster and defaults need explicit authentication attention: https://www.postgresql.org/docs/16/app-initdb.html
- `pg_ctl` is a process lifecycle tool, not proof of target isolation; local/native execution must additionally prove process, data-directory, network, role and connection binding: https://www.postgresql.org/docs/16/app-pg-ctl.html

This source review is **ChatGPT analysis**, not independent reviewer acceptance or PostgreSQL execution.

## 3. Provider decision: do not assume Docker is mandatory

| Candidate | Safety and capability | Decision now |
| --- | --- | --- |
| **A. No PostgreSQL provider for ordinary development** | Existing Node/TypeScript gates run with no SQL, no installations, no production exposure; truthfully report PostgreSQL RLS NOT RUN | **ACCEPTED DEFAULT**. Allows unrelated/offline milestones to proceed without weakening real-data gate |
| **B. Existing networkless disposable Docker runner** | Already authored but still unrun; needs local Docker engine and local Postgres image with explicit owner opt-in. Isolation still needs empirical verification | **OPTIONAL, NOT REQUESTED**. Do not pressure owner to install Docker or silently invoke it |
| **C. Optional native PostgreSQL disposable runner** | Requires genuine PostgreSQL binaries (`initdb`, `pg_ctl`, `psql` and server), independent ephemeral cluster, unique target and verified cleanup. Currently not installed/detected | **DESIGN ONLY, REVIEW BEFORE IMPLEMENTATION**; do not auto-download, run existing service or infer SQL PASS |
| **D. In-memory Postgres mock, existing local/shared DB, production/Neon, remote test DB** | Mock lacks RLS enforcement; existing/shared/prod targets violate owner-scope and side-effect contract | **REJECT** for synthetic D3 proof |

**Recommendation:** keep A as the default. Seek independent security review of the D3 source and native-provider design first; optionally implement C in a **separate small milestone** only after review, explicit operator opt-in, strict safety invariants and an actual known local PostgreSQL binary source. Do not couple provider availability to everyday work.

## 4. Required contract for a future native option (non-executable)

- Owner-selected, integrity-verified installed PostgreSQL binaries; check compatible server/client versions and executable location. **Never auto-install or connect to ambient cluster**.
- Abort on any ambient `DATABASE_URL`, `DIRECT_URL`, `NEON_DATABASE_URL` or inherited PostgreSQL connection/service credentials. Child process receives only explicitly constructed synthetic environment. Do not log sensitive environment variable values.
- Generate new unpredictable sandbox directory **outside repository**; verify it did not previously exist; run `initdb` there under an unprivileged OS context with safe initialization and explicit local auth; no services/autostart/registry changes. Never delete outside that exact owner-created directory.
- Use isolated bind/listener and randomized private port (Windows-specific socket/port reality must be separately checked), explicit host/database/role for every `psql` invocation, no fallback to default port/socket; connection must attest `SHOW data_directory` equals sandbox and DB marker/nonce equals expected before fixture application. A matching DB **name alone is insufficient**.
- Start/stop via `pg_ctl` against **exact new PGDATA**; verify PID, endpoint and cleanup in success/failure/cancel paths, fail if orphan remains. Do not report clean teardown when it cannot be proven; do not delete a still-running cluster.
- Execute the same approved fictitious SQL fixture/negative privilege matrix only after binding attestation, keep query output strictly synthetic; no real GPS records or external access. Self-test deliberate misbinding and corrupted/missing binary failure before any DB startup.
- The native provider must be opt-in only; default `PostgresProvider=none` remains unchanged. RLS results distinct from mock tests, and even native SQL PASS would be **synthetic-only** and leave production NO-GO.

**Implementation status:** non-executable design; no scripts or PostgreSQL runtime added.

## 5. Stop/go criteria and next decisions

- **D3 static/mock Node+TypeScript local gate:** historical PASS on exact `3f9db21f`; newer doc-only HEAD untested.
- **D3 actual PostgreSQL RLS gate:** **NOT RUN / OPEN**; source review alone cannot close it.
- **D4 offline diagnostic robustness:** 17/17 targeted Node + TypeScript owner-local PASS on separate exact `749dc459`; not a security proof.
- **Independent adversarial review of SQL/runner/optional-native design:** **PENDING**. Prepare full handoff, record reviewer coverage and disagreements. Reviewer is not authority; reconcile recommendations against source and owner constraints.
- **Operational P1:** **NO-GO** until real principal/consent, DB-enforced owner scope, immutable read-only request/driver proof, privacy audit and full-fidelity source/truth evidence. No production role/RLS/DDL or API changes have been approved.
- **PR state:** #351 and #352 remain DRAFT, unmerged. No deployment, production database modification, research data export or Training repo work.

## 6. Documentation/evidence rule

After independent reviewer feedback, update this document with explicit **received/missing input**, reviewer-versus-source agreement, test/DB state, planned implementation scope and unresolved risk. Update ROADMAP/FEATURES/CHANGELOG in same cycle. Source finding ≠ test PASS; static-source review ≠ independent review.
