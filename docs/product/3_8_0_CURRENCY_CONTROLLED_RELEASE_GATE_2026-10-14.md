# Currency 3.8.0 — controlled production release checklist (14 October 2026)

**Status:** Local implementation acceptance PASS; production release NOT AUTHORIZED / NOT RUN. Do not execute the review-only draft SQL on production. PR #338 stays Draft.

## Verified release candidate

- Exact **application code SHA**: `0192570a240dc3473b6dea15c7908a15e7ee16d8`.
- Targeted aircraft-sharing tests **6/6 PASS**; TypeScript PASS; v21 schema tests **6/6 PASS**; isolated PostgreSQL16 integration **9/9 PASS**; Node **1544/1544 PASS**; Next.js local optimized build PASS (41/41 static pages); authenticated desktop/mobile Playwright **8/8 PASS**.
- All above are **owner-local**, not CI, not production. Local PostgreSQL clusters shut down cleanly.
- Later docs-only commits do not alter the application SHA. Compare against the tested SHA before release.

## Same-day live read-only preflight

- GitHub `main` and latest Vercel logbook production READY deployment: `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`.
- Neon Logbook Shadow primary `production`: project `muddy-dust-14049657`, branch `br-dark-math-b1snjzub`, database `neondb`, PostgreSQL 18.6.
- Schema migration registry is contiguous **1–20**; **0/12** proposed v21 columns and **0/4** CHECKs.
- Row counts: rates 33, aircraft 25, flights 315, flight_expenses 0, deleted_flights 8, account_backups 24. These do not prove recoverability or row-content integrity.
- Earlier owner-authorized disposable Neon PG18.6 child DDL rehearsal PASS, child deleted. PG18 sample-row negative probes NOT RUN.

## Single controlled release: required gates

1. **Preflight freeze.** Recheck exact production Vercel/Neon identity, current main/deployment, code and backup provenance. ISO source is pinned but the original official SIX origin was not independently authenticated; do not claim it was.
2. **Backup and recovery.** Establish and verify a recoverable production database checkpoint/restore route and protected certified/void history evidence *before* changes. Existing backup count is not proof of successful recovery. Do not mutate production without explicit owner Go.
3. **Review execution-grade v21 artifact.** The file `sql/drafts/3_8_0_currency_v21_additive_candidate.sql` is explicitly **REVIEW ONLY / DO NOT EXECUTE REMOTELY** and `lib/migration-plan.ts` still reports version 20. Resolve migration version 21 registration, exact transactional SQL, abort and postflight checks before authorizing any production DDL. If application/runtime or migration code changes, rerun applicable acceptance against the updated exact SHA.
4. **Apply schema BEFORE runtime.** Only after approved authority and safe backup, apply reviewed additive v21 schema to verified production DB. Check 12 nullable columns, four validated constraints, migration registry decision, historical money NULLs, row-count/protected-evidence invariants. Stop on drift or failure; no guessed backfill.
5. **Deploy and smoke.** Merge/deploy the exact reviewed, schema-compatible application to the verified Vercel project only when database postflight succeeds. Verify READY production SHA and authenticated currency workflows: rates and source currency, legacy unknowns, manual/GPS flight snapshots, expense scales, sharing conflicts, Trash, signed v13 backup/restore protections, and certified/void evidence. Use authorized test data only.
6. **Failure management.** Abort before deploy on unmet gates. For runtime failure use an authorized rollback to the recorded previous READY app SHA only after compatibility checks; **do not drop additive schema or rewrite certified/void evidence automatically**. Record evidence, consider forward fix.

## Explicit unresolved blockers

Recoverable production checkpoint/restore **OPEN**; execution-grade v21 script and registry **OPEN**; original SIX provenance independent authentication **OPEN**; production historical signed-v13 recovery **OPEN**; fresh release identity and owner's specific production Go **OPEN**. Production migration, merge, deployment and smoke **NOT RUN**.
