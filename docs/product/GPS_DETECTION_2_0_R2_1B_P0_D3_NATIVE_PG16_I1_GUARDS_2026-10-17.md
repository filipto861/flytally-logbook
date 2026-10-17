# GPS R2.1b P0-D3 — Native Windows PostgreSQL 16 I1 offline guard implementation

**Date:** 2026-10-17. **Scope:** synthetic-only research, same Draft PR #359 stacked on #357, no new PR.
**Status:** **I1 OWNER-LOCAL NODE 12/12 PASS + TWO NODE SYNTAX PASS + TYPESCRIPT PASS** on exact clean `2c4219e3e3bbeb26852b05d9f394a66cf3954d04`; new native cluster/SQL/RLS **NOT RUN / OPEN**.

## Owner-local I1 acceptance — 2026-10-17

**Verified clean exact source SHA:** `2c4219e3e3bbeb26852b05d9f394a66cf3954d04`. Owner's Windows PowerShell `git fetch origin`, `git switch docs/gps-r21-p0-d3-native-pg16-readiness`, `git pull --ff-only` returned up to date. `git status --short` empty; `git rev-parse HEAD` full SHA matched.

- `node --check research/gps-r21-p0-d3-synthetic-security/native-pg16-guards.mjs`: **PASS** (explicit exit guard did not throw).
- `node --check research/gps-r21-p0-d3-synthetic-security/run-native-pg16-preflight.mjs`: **PASS**.
- `npm run test:target -- tests/gps-r21-p0-d3-native-pg16-guards.test.ts`: **12/12 PASS, 0 failures, 0 cancelled, 0 skipped**, with actual subprocess CLI early-refusal cases.
- `npm run typecheck` / `tsc --noEmit`: **PASS**, no diagnostics, explicit exit guard did not throw.
- Docker, actual PG16 `initdb/pg_ctl/psql`, OS ACL adapter, server identity validation against a running server, SQL/RLS, CI/full test suite/build/browser/migrations/merge/deploy: **NOT RUN**.

**Bounded milestone I1: CLOSED, on tested source SHA only.** Subsequent documentation and implementation commits are **not** retested automatically. This validation confirms pure predicates and refusal behavior; it **does not establish true Windows token/ACL trust or PostgreSQL RLS policy behavior**.

**Next I2:** in the same Draft PR #359, implement the owner-controlled native Windows OS adapter and one disposable PG16 runner, first with offline adversarial tests. Do not launch it without separate explicit owner approval; existing PG16/18 Windows services must remain untouched.

## Reason and contract

The existing PG16 16.15 and PG18 Windows services are BOTH RUNNING. They must not be connected to, stopped, reconfigured, used as the source of test credentials or treated as a disposable database. Native I1 therefore only implements **pure policy/attestation predicates**, avoiding database operations entirely.

Created:
- `research/gps-r21-p0-d3-synthetic-security/native-pg16-guards.mjs` + declaration `.d.mts`.
- `research/gps-r21-p0-d3-synthetic-security/run-native-pg16-preflight.mjs` — accepts only `--offline-only`. Every runtime flag, including `--synthetic-only`, unconditionally refuses. Preflight checks ambient DB settings and prints `RLS: NOT RUN`; it never runs PostgreSQL, Docker, SQL or filesystem writes.
- `tests/gps-r21-p0-d3-native-pg16-guards.test.ts` — **12** actual dynamic pure-guard/subprocess refusal tests: correct PG16.15 version labels, PG/DB env overrides, owner-profile run UUID and every ancestor's trusted ACL/reparse supplied evidence, no fallback to Program Files/existing cluster paths, one-rule loopback SCRAM HBA, log bind/port, decimal system ID strings, server-side attestation fields and nonce, postmaster identity, cleanup fail closed, preflight positive and runtime flag rejection.

What is **NOT** implemented:
- No OS integration for Windows ACL/token, process ownership, junction checks, file creation or deletion.
- No `initdb`, `pg_ctl`, `postgres`, `psql`, TCP connections, `schema.sql` evaluation or synthetic RLS runner.
- No actual cluster runtime or teardown / empirical service safety evidence.
- `validateNativeRunPaths()` consumes metadata from a future independently verified OS adapter. A fabricated `aclTrusted=true` input is not a security proof. Likewise `validateOwnedPostmaster()` and `validateRunOwnershipForCleanup()` consume verified metadata and never terminate processes.
- Caller-supplied marker/GUC is not cluster identity. The I1 `ATTEST_SQL` describes fields future PG16 attestation **must** return; the SQL has NOT been executed. Genuine server-side identity must bind PGDATA, PostgreSQL 16.15, 127.0.0.1 / actual port, system identifier and PGDATA nonce.
- Existing Docker D3 runner and prior PowerShell branch-pinned guard unchanged, and no existing PostgreSQL 16/18 service queried.

## Evidence

- Exact earlier owner E1b clean `e14bc91314e2439859f3ea381d93abb7c43a25cd`: **35/35** old targeted Node PASS + TypeScript/syntax PASS, unrelated to new native source.
- New I1 12 cases AUTHORED, **NOT RUN** via Node on target SHA. Code-mode isolated V8 syntax check of JS modules and seven internal predicate spot checks succeeded, **not CI, not equivalent to Node suite/TypeScript or SQL**.
- Main D3 actual PostgreSQL RLS security gate **NOT RUN / OPEN**, real GPS/Neon/production auth NO-GO.

## Next owner-local acceptance — no Docker or PostgreSQL

On branch `docs/gps-r21-p0-d3-native-pg16-readiness`, clean full exact HEAD:

```powershell
node --check research/gps-r21-p0-d3-synthetic-security/native-pg16-guards.mjs
node --check research/gps-r21-p0-d3-synthetic-security/run-native-pg16-preflight.mjs
npm run test:target -- tests/gps-r21-p0-d3-native-pg16-guards.test.ts
npm run typecheck
```

Target 12/12 new Node PASS, 2 syntax PASS, TypeScript PASS. **NOT RUN by owner yet**. Errors must be fixed before implementing I2.

## I2 contract, only after accepted I1

A **separate limited implementation batch in same PR #359** will provide actual Windows OS adapter (verified non-elevated token/ACL/no-reparse), exclusively new PGDATA, `initdb --auth=scram-sha-256` bootstrap, strict host HBA, loopback/startup log proof, read-only server identity attestation BEFORE synthetic DDL, one canonical D3 SQL assertion set, and PID/path/system ID-bound stop/cleanup. Must be reviewed and offline-tested first. **Operator must separately authorize actual initdb/start/SQL.** No fallback to an existing PG16/18 service.

No main merge, production DB, user GPS, Neon, data migration or deployment in I1.
