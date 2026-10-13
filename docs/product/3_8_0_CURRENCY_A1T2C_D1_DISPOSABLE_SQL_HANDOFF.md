# A1-T2c D1 — Minimal atomic restore prototype (disposable PostgreSQL 16 only)

**13 October 2026 · DRAFT / TEST-ONLY · NOT deployable.** This batch follows the source-reviewed A1-T2c contract and reconciliation in Draft PR #326 and depends on the unmerged A1-T2a / A1-T2b test infrastructure.

## What changed

- `tests/fixtures/a1t2c-reduced-atomic-restore-prototype.sql`: a test-only `a1t2c_try_restore(user_id,trash_id,hold_ms)` PL/pgSQL function. It runs as **one atomic SQL statement**, locks the actual `deleted_flights` source row, validates owner/original ID, expiry/restored flag, source track/expense ownership, v21 shape and protected/revision state; serializes **cooperating restore callers** using an advisory lock keyed to the current normalized natural identity.
- New numeric flight/track/expense identities, explicit allowlisted **reduced-fixture** inserts, exact monetary `NUMERIC` rate and `BIGINT amount_minor`; retains legitimate archived `CZK` and legacy unspecified flight denomination. Checks reconstructed nonidentity JSON content and child counts before setting the trash restore marker. Failures use unconditional `RAISE EXCEPTION` with stable prototype SQLSTATEs and PostgreSQL statement rollback; duplicate/not-found are nonwriting outcomes.
- `tests/integration/postgres-currency-a1t2c-atomic-restore.test.ts`: targeted tests for v20-style legacy money on a **v21 candidate schema**, EUR/JPY/KWD exact tuples, missing currency, late child constraint failure, protected/revised archive, original-ownership mismatch, partial exact tuple, zero children, duplicate/expired/already-restored cases, and **independent two-process same-trash and cross-trash same-key races**. Uses the pinned SQL candidate from #322 and actual owner-local disposable PG16 identity verification.
- `tooling/run-currency-a1t2c-local.ps1`: standalone Windows PowerShell 5.1 runner creating/deleting **its own ephemeral native PG16 cluster**; checks exact branch, clean tracked working tree, Node24, server identity, existing security guard tests, project-wide TS and A1-T2c integration tests; preserves cluster files if shutdown fails.

## Scope limits — do not misinterpret

1. This is an **executable reduced-schema SQL experiment**, not the full current `flights` column projection in `lib/flight-trash.ts`. The prototype and tests are not imported by any runtime route and must **never** be invoked on production or existing local databases.
2. A1-T2c D1 does NOT prove full v20 schema equivalence, all legacy flight/track fields, real `track_points` recovery, signed v13 import/export, all certification/void/shared-flight evidence, official SIX currency-source validity, independent normal Add/Edit writers, or production authorization.
3. Its single-function approach is an **experimental transaction boundary only**. Deploying a server-side function would itself require an approved migration; the final implementation must first satisfy Neon HTTP static transaction constraints or an explicitly approved architecture. No migration is registered here.
4. Its advisory lock only serializes **cooperating restore calls**, not arbitrary regular flight writers; the current nonunique natural key is not converted into a new global unique constraint.
5. The test fixture starts with reduced base table definitions and then applies an **unregistered v21 candidate**. A real v20 destination with a future exact v21 snapshot still needs a separate fail-closed production contract test.
6. No pre-read outside the transaction is trusted. The function consumes the authoritative **locked** `deleted_flights` row; it does not invent `archived_at`/`updated_at` fields.
7. **As authored:** PG16 SQL integration, two-session test, exact Node24 repo typecheck, full suite/CI/build/Playwright/Neon HTTP **NOT RUN**. Existing A1-T2b PG16 8/8 + 3/3 PASS belongs to a **different tested SHA**.

## Owner-local execution (Windows)

Requires PostgreSQL 16 under `%ProgramFiles%\PostgreSQL\16\bin`, Node 24.x, Git, npm. From the `flytally-logbook` worktree:

```powershell
git fetch origin
git switch test/3.8.0-a1-t2c-d1-atomic-restore-pg16
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-a1t2c-local.ps1
```

The script refuses the wrong branch or a dirty tracked working tree and will not touch remote endpoints. Provide **the complete output, exact candidate SHA, first failure if any, and final stop/cleanup state** before any D1 acceptance claim.

## Exact owner-local acceptance result (13 October 2026)

- **Tested commit**: `962913c9899a1a02a8f9ea3324a617deb8530e49` (Draft PR #327). Owner ran the unchanged PowerShell runner on Windows with Node 24 and a newly initialized native PG16 cluster at `127.0.0.1:60719`.
- **Database identity**: expected/observed `flytally_currency_test|flytally|127.0.0.1|60719`, **PASS**; safely shut down PG16 after tests.
- **Full project `npm run typecheck`**: **PASS**. Disposable-target guard **8/8 PASS**, 0 fail, 0 skip. Focused actual PostgreSQL restore tests **11/11 PASS**, 0 fail, 0 skip.
- Positive tests verified archived CZK without guess/default, legacy price with unresolved denomination, EUR/JPY/KWD exact values and empty children. Negative tests verified fail-closed invalid archived currency/ownership/tuple/protected records, natural duplicates/expired records, and forced late expense-CHECK **transaction rollback**. Two *independent PG sessions* validated same-trash one-winner and two cooperating different-trash/same-natural-key serialized outcomes.
- Runner output stated `LOCAL catalog test gates PASS on candidate 962913c9899a1a02a8f9ea3324a617deb8530e49. Not a production migration.`

**Disposition:** D1 **local reduced-schema acceptance PASS**, with historical earlier `NOT RUN` at authorship retained below for provenance. Full v20 flight/track content mapping, real certified/void/shared history, ordinary Add/Edit writer race, transaction compatibility over nonproduction Neon HTTP, schema v21 registration, A1-T3 application wiring, CI/build/browser/production tests **NOT RUN**. No remote database was accessed by the runner.

### Focused next gates (do not reopen settled D1 work)

1. Source-backed **full v20 / v21 field fidelity** including actual track metadata and runtime source protections. Existing D1 function's reduced INSERT column list must **not** be substituted into `lib/flight-trash.ts`.
2. Independently test actual static `@neondatabase/serverless` HTTP `sql.transaction([...])` behavior using an **authorized, isolated nonproduction Neon target**. Do not assume a PL/pgSQL test function can be deployed without migration.
3. Only after these gates, plan the smallest A1-T3 guarded runtime integration, plus signed v13 A1-C/A1-F and release A1-G. No automatic merge/deploy or currency backfill.

## Acceptance and next step

- Need real PG16 PASS for TypeScript, guard tests, target SQL tests, preserved content/rollback and two-session concurrency, plus confirmation no skipped scenarios. Any failed test blocks D1 closeout; diagnose from output, change only narrowly and rerun.
- After local D1 evidence, perform an independent review of **actual SQL** and extend to real full-v20 source-based restore fields/Neon HTTP transaction proof before A1-T3. Do not merge or enable v21 writers merely because the reduced D1 prototype works.
