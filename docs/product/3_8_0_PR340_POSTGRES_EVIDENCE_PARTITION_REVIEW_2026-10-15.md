# FlyTally Logbook 3.8.0 — PR #340 PostgreSQL release evidence partition design / DeepSeek independent review

Status: **ANALYSIS AND DESIGN ONLY — REVIEW REQUESTED — NO RELEASE APPROVAL.**
Scope: `filipto861/flytally-logbook`, PR #340 `fix/3.8.0-flights-exact-cost-summary`; no `flytally-training` change.
As-of: 2026-10-15, latest observed successful SQL source-build gate at `d01f1ba02a442a4c967707a5e150a1efe4796651`, latest PR branch includes fixture correction and docs. Re-evaluate actual Git HEAD before touching code.

## Goal and factual state

Post backfill, individual flight costs correctly show stored CZK. PR #340 changes `app/(protected)/flights/page.tsx` and `app/(protected)/statistics/page.tsx` to exact per-flight rounded ISO-currency aggregations across the selected dataset, without FX, fabricated currency or certified-history writes. Owner-local tests: source contracts 234/234 PASS, domain 26/26 PASS, typecheck/full Node/build PASS, read-only Neon-derived PG18 currency SQL (all 283 selected flights 776,891.84 CZK, ULL 229 = 562,812.84 CZK) PASS on separately identified earlier SHA. **No browser or full PostgreSQL acceptance PASS on current SHA.** PR remains Draft; no production deployment.

The last owner-local disposable Windows PostgreSQL16 full run on `d01f1ba0` yielded 163 tests: 123 PASS / 8 FAIL / 32 SKIP. All 8 failed `before()` due redundant `ALTER TABLE deleted_flights ADD COLUMN expenses_data` after `tooling/bootstrap-browser-smoke-db.mjs` already created `expenses_data JSONB NOT NULL DEFAULT '[]'::jsonb`. The PR now deletes the redundant ALTER, asserts exact existing column shape and adds a fixture-drift regression. **New corrected head has NOT been run**, even though read-only source comparison confirms the contract.

At the same time, the old `tooling/verify-postgres.mjs` executes **every** `tests/integration/*.test.ts` with Node `--test` concurrently inside one database. `evaluateEvidenceObservation('postgres-acceptance',...)` marks **any raw SKIP as PARTIAL**, hence even if 8 errors disappear the current raw 32 skips cannot yield PASS.

## Exact skipped partition audit — 32 cases, 5 files

| Suite | Tests | Required purpose/fixture | DB interaction |
|---|---:|---|---|
| `tests/integration/postgres-currency-v21-release.test.ts` | 5 | `FLYTALLY_V21_RELEASE_DISPOSABLE=1` AND `FLYTALLY_POSTGRES_INTEGRATION=1`; fresh verified PG16, `public` initially has zero tables | Creates minimal v1..v20 public schema, tests actual v21 DDL/preflight/checks; irreversible schema mutations inside disposable database |
| `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts` | 19 | `FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE=1`; own validated PG16 and private random schema | Executes actual runtime v1..v20 migration SQL in its own schema, then drops that schema |
| `tests/integration/postgres-v380-d3b-real-trash-races.test.ts` | 6 | `FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE=1`; own PG16 and private schema | Runs real Trash/track concurrency/negative control in a disposable schema |
| `tests/integration/v380-d3b-full-v20-catalog.test.ts` | 1 | `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1`; verified PG16 **with genuinely applied v20 in public** | Asserts real FK and protection-trigger catalog; does **not** install missing DDL |
| `tests/integration/v380-d3b-zero-delete-counterexample.test.ts` | 1 | `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1`; verified PG16 with real usable v20 public schema | Rollback-only negative control proving why conditional zero-delete without an abort is insufficient. It is **not** proof production has the defect |

**Other 131 of the 163 observed tests** belonged to normal shared full acceptance, including 8 historic full-v20 restore cases using the existing purpose-flagged `tooling/bootstrap-browser-smoke-db.mjs`; after the duplicate-column correction, they still require actual execution and evidence.

The five suites are not arbitrary exclusions: individual preexisting PowerShell runners `tooling/run-currency-m2a0-local.ps1`, `tooling/run-v380-d3b-migration-chain-local.ps1` were historically *branch pinned* and do not certify the exact PR #340 commit. Do not run them unchanged or reuse evidence across different SHAs.

## Frozen product / governance requirements

- Correctness and source evidence first; fail closed, no guessed monetary values, no silent N/A or zero.
- No changes to protected flight/expense/certification rows, production DB, training repo or 3.8.0 owner-attested backfill.
- Every destructive fixture must run **only on its own newly created and identity-checked localhost PostgreSQL 16 cluster**: exact DB `flytally_currency_test`, user `flytally`, IP `127.0.0.1`, dynamically chosen nonstandard port, no password/PG environment tunnel/Vercel markers. Before invoking any fixture, verify physically connected target; preserve cluster files if shutdown fails.
- Never enable `FLYTALLY_V21_RELEASE_DISPOSABLE` and `FLYTALLY_D3B_FULL_V20_DISPOSABLE` in the same shared SQL run: their expected `public` preconditions conflict. No concurrent destructive fixture use of `public`.
- No simulated pass: `NOT RUN` != PASS, `SKIP` != N/A, previous test SHA != new SHA, successful build != runtime.
- Standard 10k/50k/100k SQL scale fixtures passed previous synthetic thresholds, but **new flight exact-cost summary 100k performance is not independently benchmarked**. Track this separately.
- Existing canonical `verify:release:risk`, `verify:postgres`, ledger candidate identity and browser-risk SHA/selection binding must remain authoritative. Do not degrade prior negative controls.

## Proposed implementation design — review before code

Prefer **candidate-bound partitioned PostgreSQL acceptance** over setting every flag in the current single Node process:

1. Declare an explicit, reviewed suite partition registry covering all current `tests/integration/*.test.ts`: **shared/core**, **v21-migration**, **d3b-migration-chain**, **d3b-races**, **real-v20-catalog+rollback-counterexample**. Registry lists exact files, suite-specific flags and expected test counts. Reject unknown/duplicate file, missing suite, unexpected test-count drift, wrong target, or changing registered test files silently.
2. Shared/core must execute its actual cases (no raw skip) against one newly created checked cluster. Both normal v20 restore cases and exact-money PG fixture belong here; don't replace an execution with a fake N/A.
3. Launch each specialized partition **sequentially**, with separate verified disposable PG16 ownership / purpose flags and isolation. **v21 suite requires zero-table public**. D3b migration/race suites use their own schema. Catalog + counterexample must use **actual** v1→v20 migrations in `public`; a synthetic browser fixture or a script merely claiming migration 20 is insufficient. Catalog's existing triggers/FKs must actually pass on a newly migrated database. If public migration preparation cannot be proven, keep this partition FAIL / NOT RUN rather than weaken it.
4. Consume each subprocess's TAP evidence with `planned = passed + failed + skipped`, require `failed = skipped = retries = 0` and exact expected test inventory; bind test counts, suite id, DB instance id, command, toolchain and git candidate to ledger. The canonical PostgreSQL **overall PASS requires PASS from every required partition**. Never hide 32 cases by dropping them from denominator or by labeling them N/A because they are complex.
5. Shared-runner orchestration must remain fail-closed when invoked without the verified PR340 disposable-cluster wrapper or with inherited hostile flags. A standalone generic `verify:postgres` not authorized to create additional databases should stop with explicit `NOT RUN` for required partitions, not output optimistic PASS.
6. Once combined PostgreSQL 100% PASS including scale (and separately exact-money aggregation at 100k if appropriate), proceed to signed-in risk-scoped desktop/mobile Playwright. Validate both Flights cost header and Statistics row monetary values under v21; browser evidence must match exact candidate SHA and target hashes.
7. Keep every PR checkpoint small; document acceptance and test evidence in ROADMAP/FEATURES/CHANGELOG; close release only after merge + verified Vercel READY source SHA and authenticated production smoke.

### Alternatives and trade-offs

- **Reject A**: blindly export five additional `FLYTALLY_...` flags before existing `npm run verify:release:risk`. The suites have incompatible public schema ownership, and Node `--test` runs files concurrently. Could produce invalid, nondeterministic and destructive results.
- **Reject B**: exclude 32 tests and declare them N/A or PASS solely to appease the ledger. This violates evidence-first DoD.
- **Possible C**: a narrowly scoped **documented exception** for suites proved unrelated to this hotfix, backed by prior accepted and candidate-matched evidence, but must be explicitly approved and ledger-recorded as narrower release scope; cannot claim FULL PostgreSQL acceptance. Owner decides, not implementation heuristic.
- **Preferred**: partitioned full executable evidence with strict candidate-bound aggregation and real independent PG16 fixtures. More time and multiple PG16 starts, but deterministic and auditable.

## Questions for DeepSeek (read-only independent review)

1. Is this partitioning exhaustive and semantically accurate? Which suites can safely share a DB and which require isolated new clusters?
2. What is the **smallest** change to current canonical `tooling/verify-postgres.mjs` / ledger / `tooling/verify-release-risk.mjs` needed to record aggregate evidence without bypassing skip policy or changing source authority?
3. Should actual v1..v20 public catalog preparation reuse existing D3b migration test logic (which today uses an isolated private schema and tears it down), or needs its own narrowly reviewed setup? Identify migration effectivity/FK/triggers to check.
4. What negative tests prevent accidental Neon/production/cross-scope modification, stale SHA reuse, unknown files, wrong test count, phase collisions and misclassified SKIP?
5. Does `runNodeTests` support strict per-partition TAP accounting and current Windows Node 24 execution without race or interactive deadlock?
6. What is an acceptable isolated PostgreSQL 100k **exact cost totals** benchmark fixture and threshold: no invented threshold or invalid SQL mirror?
7. Identify any blockers in `run-auth-browser.mjs`, `verify-browser-risk.mjs` or v21 bootstrap after multiple PG partitions, including session/auth and unavailable fixture currencies.
8. Recommend minimal milestones/patch sets, acceptance criteria, Do/Do Not, rollback path and required docs.

**Review disposition:** No second-AI response has been received. This is a proposal, not approved authority or completed implementation. Validate any review advice against actual current repo before committing new orchestration logic.
