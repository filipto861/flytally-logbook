# FlyTally 3.8.0 — D2 full-v20 restore / PG16 acceptance handoff

**13 October 2026 · isolated Draft / NOT DEPLOYABLE / database test NOT RUN**

## Scope and source

- Base: `fix/3.8.0-trash-restore-v20-fidelity-clean` Draft PR #328, exact original head `e24c982fda95a1219c7e5fd4a66a47afe16707da`. Implementation is in separate nested branch `test/3.8.0-d2-full-v20-pg16-runtime`.
- Existing source: `lib/flight-trash.ts` legacy v20 CTE restore, source in flight archive JSONB. **Runtime changes in this branch**: same-archive `FOR UPDATE OF deleted_flights`; reject source with all make/model/variant blank **if** current aircraft profile or aircraft type would cause the existing `logbook_snapshot_aircraft_identity` trigger to populate different historical identity. The guard appears in eligibility and invalid-archive fallback. No global natural-key uniqueness or currency default.
- New `tests/integration/postgres-v380-full-v20-restore.test.ts` dynamically extracts **the actual tagged SQL inside `restoreDeletedFlightRecord`**, not the earlier D1 reduced-function prototype. Runs against `tooling/bootstrap-browser-smoke-db.mjs` full-v20 61-column flights fixture, then adds the source-backed v14 `deleted_flights.expenses_data` column missing from browser bootstrap. Full restore test is restricted to verified disposable native PG16 target only.
- Scenarios: exact historic 61-column flight record compare (minus fresh ID); historic aircraft identity; track+expense content roundtrip with new IDs; missing expense currency fail-closed; blank identity trigger risk zero-write; forced late expense CHECK rollback; two **independent psql sessions** restoring the same trash ID. Additional source/guard tests and existing D2 seven column/fail-closed tests are included in runner.
- `tooling/run-v380-d2-full-v20-local.ps1` is derived from the previously proven A1-T2c D1 temporary cluster runner. Requires exact branch/clean tracked worktree, Windows Node24, PostgreSQL16; creates new random local-only cluster/database; checks database identity, runs TypeScript and targeted tests, then stops and cleans its own instance if safe.

## Critical safety boundaries

**The browser bootstrap intentionally reinitializes its target schema.** The new integration test validates the exact temporary URL, database/user/address/port and actual PostgreSQL16 backend identity **before invoking it**. Never run the bootstrap manually against a normal development or production database.

This is actual SQL text + PostgreSQL behavior, not a full invocation of Next.js authenticated restore action or of `@neondatabase/serverless` HTTP. The same-trash row lock is a narrow improvement; **two distinct trash IDs sharing a natural key and unrelated Create/Edit writers are NOT made globally race-safe**. No assumption of Neon transaction support, source permissions or approved v21 migration.

Blank historical identity in snapshots from older configurations may now fail closed and require user review; this is preferable to silently assigning present-day aircraft identity but still needs an archive inventory and compatibility decision before merge.

The existing old CTE code still has no full post-insert child-content assertion; tests can detect specific drift but do not prove every possible source row is safely restored. No code from the disposable D1 PostgreSQL function was deployed.

## Local commands (no remote database)

```powershell
git fetch origin
git switch test/3.8.0-d2-full-v20-pg16-runtime
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-d2-full-v20-local.ps1
```

The runner invokes `npm run typecheck` and three `npm run test:target -- ...` suites (D2 v20 static, lock/trigger contract, actual full-v20 PostgreSQL integration). If any fail, capture **first failed assertion, exact git SHA, SQL diagnostics and final cluster shutdown**. Do not report SQL PASS until user-local output confirms it.

## Authorized disposable Neon transaction and cleanup evidence (13 October 2026)

Separate from owner-local native PG16 D2, a scratch **Neon PG18.6** child branch `ft-380-atomic-acceptance-20261013-temp` was explicitly created under `Logbook Shadow`, then tested with synthetic scratch rows only. Neon connector transactional commit, rollback on late CHECK, and two parallel connector calls competing for one archive row **PASS**. **This was NOT an application `@neondatabase/serverless` JavaScript HTTP `sql.transaction([...])` test and did not execute real restore SQL.**

**CLEANUP VERIFIED:** exact nonprimary/nondefault temporary branch `br-sparkling-leaf-b1giaanc` was deleted; subsequent branch listing confirmed it absent with all original four branches untouched. Full SQL scope and observations: [Neon temporary branch acceptance / cleanup](3_8_0_NEON_TEMP_BRANCH_TRANSACTION_CLEANUP_2026-10-13.md). No production writes, registered migration, merge or deploy.

The real HTTP JavaScript driver transaction and application restore mapping remain separate unverified gates; no temporary Neon branch currently exists for further execution.

## Owner-local distinct-trash restore concurrence — VERIFIED (13 October 2026)

**Exactly tested source SHA:** `0bb5b4965f7234991ac4530a358eb8de48951a9d` from Draft PR #329, on Windows/Node24 and freshly initialized **native PG16** disposable `127.0.0.1:50066`.

- Expected/observed PostgreSQL identity `flytally_currency_test|flytally|127.0.0.1|50066`: **PASS**. Temp instance started and stopped cleanly.
- Full project `npm run typecheck`: **PASS**.
- v20 data-integrity source checks: **7/7 PASS**, 0 fail/skip.
- Row-lock, trigger guard and two-query `ReadCommitted` transaction source tests: **5/5 PASS**, 0 fail/skip.
- Real runtime-source SQL against disposable v20 fixture: **7/7 PASS**, 0 fail/skip. Includes original six flight/track/expense/late rollback/same-trash tests plus **two distinct trash IDs of the same natural flight identity racing on two independent PG sessions**: exactly one new flight and one marked archive among cooperating restore paths.
- Printed: `LOCAL full-v20 integration gates PASS on candidate 0bb5b4965f7234991ac4530a358eb8de48951a9d. Not a production migration.`

**Scope disposition:** native PG16 Restore-vs-Restore natural identity serialization is **LOCALLY VERIFIED**. The earlier untested candidate state below is historically preserved. Never extend this to independent normal Create/Edit writers, source-history certification/void/shared/participant evidence, actual `@neondatabase/serverless` HTTP transaction semantics, production migration v21 or release approval. The previously created scratch Neon PG18 branch was **deleted and verified absent**; it is not reusable.

**Next:** test actual JavaScript Neon HTTP SDK on a freshly authorized disposable nonproduction branch with verified branch identity and cleanup. Finish remaining release gates (existing Add/Edit races; archival applicability/provenance, certified/void/shared participants; backup v13 and full v20; ISO/SIX/v21/CI/build/browser). New code SHA requires new targeted evidence.

## Next P0 candidate — distinct-trash natural-key serialization (UNTESTED; 13 October 2026)

- **Previous accepted evidence remains exact `7676563ec6bf288b57b4a99ef792033cad434f4e`, 7/7 source + 3/3 guards + 6/6 real PG16; subsequent documentation-only notes do not validate this new code.**
- Current nested Draft changes `restoreDeletedFlightRecord` from a **single SQL statement** into one `sql.transaction([lock,restore],{isolationLevel:'ReadCommitted'})` with two distinct SQL statements. First statement takes `pg_advisory_xact_lock(hashtextextended(jsonb_build_array(...),0))` on six existing normalized identity dimensions: `user_id`, date, trimmed uppercase registration, off-block (empty if NULL), trimmed uppercase departure and arrival. Second is the **same existing CTE restore** with locked archived row; as a separate statement under **READ COMMITTED**, its duplicate check should receive a fresh snapshot after any competing cooperating restore commits.
- This is a **cooperative Restore/Restore lock**, NOT a global uniqueness constraint. **Normal Create/Edit do not acquire this lock**, so their competing writes remain a separately unresolved integrity/owner decision. The existing nonunique natural-key index remains unchanged. The lock uses a 64-bit stable hash; collision can cause additional serialization but not credential exposure.
- Updated actual-source PG16 integration to extract BOTH SQL templates and run `BEGIN; SET TRANSACTION ISOLATION LEVEL READ COMMITTED; advisory-lock; original-restore; COMMIT;`. It adds independent-session T2c natural-key collision (two distinct trash IDs, identical identity, exactly one restored flight and marker) and retains six existing rollback/trigger/content tests. New guard tests explicitly check the two-statement array transaction, identity key dimensions and no new unique index. **Expected suites on new exact SHA: D2 source 7 tests, guard 5 tests, full-v20 PG16 7 tests.**
- Source/regex readback currently confirms all key dimensions and SQL extraction shape. **New commit's project Node24 typecheck, all target tests, native PG16 concurrency/rollback, and actual `@neondatabase/serverless` HTTP transaction tests are NOT RUN.** An isolated Neon scratch PG18 connector transaction PASS from the earlier cleaned-up branch is **not** proof for this SDK code.
- Official `@neondatabase/serverless` [transaction API](https://github.com/neondatabase/serverless/blob/main/CONFIG.md) supports static array-of-queries, `isolationLevel: 'ReadCommitted'`; current local adapter supports the array transaction as well. **Actual integrated HTTP behavior still requires explicit test.**
- **Required next**: owner reruns `tooling/run-v380-d2-full-v20-local.ps1` at current exact HEAD and shares full output; if all 19 tests and typecheck PASS, perform independent SQL review and SDK nonproduction acceptance before merger. No migration, deploy, production writes, or `flytally-training` changes.

## Owner-local D2 full-v20 acceptance — 13 October 2026

**Exact tested commit:** `7676563ec6bf288b57b4a99ef792033cad434f4e` from Draft PR #329.

Owner Windows / Node 24 / native PostgreSQL 16:
- Ran `tooling/run-v380-d2-full-v20-local.ps1`. Created new temporary server on `127.0.0.1:64675`; expected/actual `flytally_currency_test|flytally|127.0.0.1|64675` identity matched **PASS**; safely stopped server on completion.
- Full project `npm run typecheck` **PASS**.
- `tests/v380-trash-restore-v20-column-coverage.test.ts`: **7/7 PASS**, 0 fail/skip.
- `tests/integration/v380-restore-lock-and-trigger-contract.test.ts`: **3/3 PASS**, 0 fail/skip.
- `tests/integration/postgres-v380-full-v20-restore.test.ts`: **6/6 PASS**, 0 fail/skip. Scenarios: actual tagged source SQL, exact historical aircraft identity and track/expense data, rejection of blank historical identity vulnerable to current-profile trigger, missing currency zero-write, intentional late expense CHECK failure and full rollback, and two independent PostgreSQL sessions concurrently restoring the SAME archived flight.
- Runner explicitly reported `LOCAL full-v20 integration gates PASS on candidate 7676563ec6bf288b57b4a99ef792033cad434f4e. Not a production migration.`

**Disposition:** D2 full-v20 test fixture and scoped same-trash source SQL are **locally accepted**, superseding the historical authored NOT RUN note below, at this exact code SHA. Not a proof of all possible production source-history/certification combinations, simultaneous restoration of DIFFERENT trash IDs with the same normalized identity, global concurrent Add/Edit writes, Neon HTTP static transaction behavior, signed backup recovery, or future v21 monetary tuple restoration.

**Next gated work:** focus on cross-trash/global race and source-compatibility evidence, authorize a disposable nonproduction Neon HTTP transaction target, then reconcile PR #328/#329 with unmerged currency source/migration/backup dependencies. Do not merge, register v21 or deploy based only on local D2 PASS.

## Test and release status

- PR #328 initial D2 corrected SHA `e24c982fda95a1219c7e5fd4a66a47afe16707da`: **owner-local Node24 typecheck PASS and seven source regression tests PASS**; no PG tests.
- Current nested branch: exact SQL source extraction/fixture/guard reviewed **statically**; Node24/typecheck/new targeted tests/**actual PostgreSQL 16 NOT RUN**.
- Separate reduced A1-T2c D1 owner-local `962913c9`: 8/8 safety + 11/11 PG16 PASS; **does not validate this real full-v20 runtime SQL**.
- Pending before any merge/rollout: full-v20 PG16 owner results; certified/void/shared participant evidence and cross-natural-key races; **authorized isolated nonproduction Neon HTTP** transaction proof; official ISO registry; v21 migration prerequisite; signed-v13 backups (A1-C/A1-F); A1-G rollout, build/browser/CI/production smoke.
- **NOT PERFORMED:** main merge, migration v21 registration, production/Neon writes, deploy, FX/backfill or `flytally-training` changes.
