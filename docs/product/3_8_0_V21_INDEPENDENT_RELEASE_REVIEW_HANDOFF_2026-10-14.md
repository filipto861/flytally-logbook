# Independent read-only reviewer handoff — FlyTally Logbook 3.8 Currency v21

## Critical additional design decision: fail-closed v21 runtime execution (14 October)

A review before local acceptance found that registering v21 in the automatic migration list could otherwise permit an unapproved v20->v21 schema write at runtime. Current `lib/db-optimization.ts` therefore **explicitly rejects a pending v21** unless `FLYTALLY_LOCAL_POSTGRES=1` and `DATABASE_URL` is a verified loopback hostname. This supports isolated local browser/PG fixtures only. A real new/recovered database must be advanced through the separately controlled v21 SQL artifact (version21 registry inserted atomically) before deploying the version21 runtime; this deliberately supersedes any implication that production/fresh cloud installation might auto-apply v21. Ask reviewer to test both branches and verify no service startup side effects beyond existing v20 bootstrap if registry21 is absent. Review whether this flag/loopback check should be stricter, especially where other local databases could be present.

Date: 2026-10-14. Reviewer: DeepSeek or Claude (independent). Owner: final decision maker. Status: **Draft PR #338, code staged, NOT locally accepted on new SHA; NEVER execute against production**.

Repository: `filipto861/flytally-logbook`. Branch: `feat/3.8.0-m2a0-schema-review-main`. Historic accepted application SHA: `0192570a240dc3473b6dea15c7908a15e7ee16d8`. Current work adds runtime migration support and changes the acceptance contract; historic PASS must NOT be reused as current PASS.

## Production constraints / frozen facts

- Canonical Neon project `muddy-dust-14049657`, database `neondb`, PostgreSQL 18.6, branch **`br-raspy-fog-b1btvu5t`** (owner explicitly approved preserving this restored branch after a previous unintended `restore_snapshot(finalize:true)` production branch swap). Former `br-dark-math-b1snjzub` and manual `snap-proud-fire-b1bm8oac` are to be retained, no further restore or branch swapping.
- Actual production app is Vercel `logbook` main `dcc8ebbf...` and production DB endpoint `ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech/neondb`. Latest full 52-table counts+row-content hash compare between former and current branch matched on the recheck; those measurements are not a time-travel data-consistency guarantee.
- Production DB schema registry exactly v1..v20; 0 of 12 v21 columns, 0 of four v21 CHECK constraints. New schema must be applied and verified **before** new runtime deployment.
- Source ISO 4217 pinned to owner-attested registry; independent original SIX authenticity and signed-v13 real-production recovery remain separate, honestly unverified release gates.
- DO NOT execute any production SQL, create/switch/restore Neon branch, merge, mark PR ready, deploy or delete backup. Read-only review only.

## Scope implemented for review

- `tooling/v380-v21-preflight.sql`: mandatory `-v expected_database=neondb`, read-only, strict 1..20 name registry, protected-v20 table/function/trigger existence, zero v21 column/constraint state.
- `tooling/v380-v21-migrate.sql`: same guard under one `BEGIN`/advisory lock/lock and statement timeouts, four exact nullable ALTER blocks, four exact CHECK blocks from reviewed draft, explicit registry insert `(21,'source-backed currency exact-money')`, in-transaction postflight and `COMMIT`. Branch identity is enforced outside SQL by the exact Neon branch ID; only DB name is checkable by SQL.
- `tooling/v380-v21-postflight.sql`: read-only schema/registry/constraints/legacy-NULL evidence; intended to run immediately before any v21 writes.
- `lib/migration-plan.ts`, `lib/db-optimization.ts`: runtime version21 and same guarded DDL for fresh/restore install; already-registered prod v21 should be skipped by runtime pending version calculation.
- `tests/currency-v21-release-contract.test.ts` and `tests/integration/postgres-currency-v21-release.test.ts`: source parity and disposable local PG16 integration; Windows runner verifies isolated loopback identity and sets purpose-specific flag.
- `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` remains review-only unchanged; `tests/currency-v21-schema-draft.test.ts` now acknowledges runtime registration while protecting draft history.
- Vercel preview feature builds are intentionally skipped by `tooling/vercel-ignore-build.mjs`. Preview DATABASE_URL secret is sensitive and its host is not independently resolved; assume no authority to touch it.

## Reviewer questions (supply concrete file:line citations)

1. Can either SQL execution script, the runtime migration, or test runner incorrectly apply a partial v21, infer legacy source currency, touch v20 certified/void data, or silently register v21 on a different target? Evaluate `DO` blocks, exact names, psql variable guard and `current_schema` behavior.
2. Are schema-first and runtime version21 name/equivalence correct, including the `sql.transaction` advisory-lock and fresh v20 migration path, and application/runtime behavior against a pre-registered v21 row? Does Vercel preview/production release gating prevent accidental DDL?
3. Are the new SQL files operationally runnable with `psql -X -w -v ON_ERROR_STOP=1 -v expected_database=neondb -d <verified exact-branch URL> -f <file>`? Identify any psql quoting, transaction READ ONLY, `set_config`, timeout, PL/pgSQL or constraint problem before release. Do not test against production.
4. Do static source-parity tests and disposable PG16 integration cover the real release file rather than a draft? Identify false-PASS risks (fake fixture triggers, registry drift, test concurrency, unexpected public tables, schema owner rights, PG16 vs Neon PG18).
5. What additions are mandatory to establish certified/void/archive hash and real-history signed-v13 recovery provenance before any DDL? Suggest smallest safe delta, not new feature scope.
6. Should another owner-approved, **strictly non-finalizing** isolated PG18 rehearsal be needed? If yes, specify the safe operations and stop conditions; previous restore finalize was unsafe.
7. Assess rollback strategy: reverting *application* to v20-compatible Vercel after v21 schema while keeping additive columns (no DROP/destructive rollback).

## Reviewer response contract

Report **BLOCKERS**, **HIGH**, **MEDIUM**, **LOW**, with exact file/line evidence and a clearly distinguished UNVERIFIED section. Propose minimal fixes and tests. Do not claim PASS without actual execution evidence. Do not modify repo or production. Explicitly flag any deviation from frozen decisions or branch IDs. Provide reviewer questions/assumptions rather than inventing target/source data.

## Required follow-up

Before release: owner-local targeted TypeScript and test checks, one full `tooling/run-currency-380-acceptance.ps1 -WithBrowser` on exact NEW HEAD, independent review reconciliation, recoverable snapshot/restore evidence from approved canonical primary, authenticated SIX original policy decision, and a separate owner GO explicitly authorizing production v21 DDL on `br-raspy-fog-b1btvu5t`. PR remains Draft.
