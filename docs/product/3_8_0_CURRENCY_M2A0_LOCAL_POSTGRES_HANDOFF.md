# FlyTally Logbook 3.8.0 — M2-A-0 localhost PostgreSQL verification handoff

**Date:** 11 October 2026. **State:** Automated test harness **AUTHORED** on [draft PR #322](https://github.com/filipto861/flytally-logbook/pull/322), actual Docker/Node24/PostgreSQL execution **NOT RUN** at the time of this handoff. **Do not merge, register v21, mutate remote Neon or deploy.**

## Exact source and dependencies

- Repository: `filipto861/flytally-logbook`; baseline `main@4ca2847795435549f36d44f253eb7c105eea6d25`, schema version **20**, production app **3.7.0**.
- Candidate code branch: `feat/3.8.0-currency-m2a0-sql-draft`, draft PR **#322**; documentation/draft reconciliation on [PR #319](https://github.com/filipto861/flytally-logbook/pull/319).
- `sql/drafts/3_8_0_currency_v21_additive_candidate.sql`: 12 nullable fields across `rates`, `aircraft`, `flights`, `flight_expenses` and CHECK constraints; **never registered** in `lib/db-optimization.ts` or `lib/migration-plan.ts`. Any UPDATEs in integration tests target only a disposable local fixture.
- `tests/currency-v21-schema-draft.test.ts`: four static source-contract tests; belongs to canonical `npm test` glob.
- **NEW** `tests/integration/postgres-currency-v21-schema.test.ts`: six real PostgreSQL integration tests of standalone SQL and authentic, extracted **v20 `logbook_protect_locked_flight()` trigger body** on a **minimal schema fixture**, not a reconstructed full production database.
- **NEW** `tooling/run-currency-m2a0-docker.ps1`: Windows PowerShell one-command runner, private PostgreSQL 16 Alpine and Node 24 Bookworm containers, read-only mount of repository source and ephemeral Linux workdir, random ephemeral DB password, no host-published Postgres port. Requires Docker Desktop and Git for Windows only (plus network to pull Docker images, apt and npm packages). Optional `-Full` runs all existing PostgreSQL integration suites.

## Run on the owner's Windows PC

**Prerequisites:** start Docker Desktop; verify Git for Windows is available. No PostgreSQL server, `psql` or Node installation on the host is required; the runner installs `psql` in the ephemeral Node container. Do **not** set `DATABASE_URL` to Neon or other remote DB. The runner supplies an isolated container-local URL itself.

**In Windows PowerShell, inside `C:\Users\filip\Documents\GitHub\flytally-logbook` (or your clone):**

```powershell
git fetch origin
git switch feat/3.8.0-currency-m2a0-sql-draft
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-docker.ps1
```

If `git switch` says the branch is unknown locally, after `git fetch origin` use:

```powershell
git switch --track origin/feat/3.8.0-currency-m2a0-sql-draft
```

The script **aborts before database creation** if the checkout is on the wrong branch, Git reports uncommitted files, Docker cannot start, or the exact candidate cannot be identified. It displays the exact commit SHA, checks PostgreSQL readiness, copies the branch **into a temporary Linux container** (excluding `.git`, `node_modules` and `.next`), installs dependencies in that ephemeral copy, and executes:

1. `npm run typecheck` on Node 24;
2. `npm run test:target -- tests/currency-v21-schema-draft.test.ts`;
3. `npm run test:target -- tests/integration/postgres-currency-v21-schema.test.ts`.

On success it prints `LOCAL PASS`, not CI or production. On failure it returns a nonzero exit status; **paste the complete PowerShell terminal output** into the chat to diagnose before continuing. In all cases, finally it force-removes the ephemeral PostgreSQL container. The run does **not** touch local Windows `node_modules`, user databases, repository migration registry, Neon or Vercel.

For broader PostgreSQL acceptance, **only after the targeted run passes**, rerun with:

```powershell
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-docker.ps1 -Full
```

`-Full` runs all existing PostgreSQL integration tests using the same temporary setup in addition to typecheck and focused currency tests. It can take substantially longer. No Playwright/build is claimed by either command.

## Specific assertions in the new focused test

1. Draft applies **twice** to a local schema, unchanged legacy float amounts and certified rows, all 12 columns and 4 checks present, metadata NULL on historical flights.
2. New exact triplets allow **EUR 2, JPY 0, KWD 3** and reject partial or invalid values (including `NaN`, `Infinity` and malformed code syntax). Database CHECK enforces **shape only**; only a reviewed application ISO registry can enforce active monetary currency membership.
3. Old JPY expense `amount_minor=1000, currency='JPY', amount_encoding=NULL, amount_minor_units=NULL` remains legacy encoded; new ISO-encoded expense uses explicit encoding and precision; inconsistent encodings are rejected.
4. PostgreSQL `json_populate_record(NULL::...)` accepts representative pre-3.8.0 rate/flight/expense JSON with **new columns absent**; those columns remain unresolved. This is a **representative record shape test**, NOT an authentic server-signed portable backup v13 verification.
5. Actual v20 trigger rejects retroactive currency update on a certified flight and allows a valid revision-opening transition without changing monetary fields.
6. Actual v20 trigger rejects certified deletion without archive and permits matching **same-transaction full-row `to_jsonb(OLD)` void snapshot**.
7. Unique rate conflict and sharing upsert concurrency are **not yet covered** by this focused suite. Require separate M2/M3 tests before enabling new writers.
8. Rollback of old runtime **after first exact-money writes** is **not validated**; a metadata-aware compatible-reader gate must precede write enablement. The old binary cannot invent a warning about columns it never read.

### Evidence and deferred gates

- GitHub changed-file/source read-back: only M2 draft + four static tests + six PG-focused tests + local Docker runner in PR #322; original v20 migration registry unchanged.
- Static source predicates from previous cycle: **14/14 in-memory PASS** against exact SQL and migration-plan blobs. This is neither authored test execution nor SQL execution.
- **NOT RUN:** Docker container start, Node 24 runtime, TypeScript tests, PostgreSQL fixture setup/migration, repeated DDL, certification trigger in PostgreSQL, full v20 schema restore, signed v13 backup roundtrip, complete old-runtime rollback, Vercel/Neon binding, current SIX XML verification, CI, Playwright, deployment.
- **Release stop:** keep all PRs draft, no remote SQL or version 21 registration, until actual user-run local outputs are reviewed and remaining technical/ISO and production-binding gates are satisfied.

See [frozen D1–D4](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md), [DeepSeek/source review reconciliation](3_8_0_CURRENCY_M2_DEEPSEEK_RECONCILIATION_2026-10-11.md), and [M2 schema design](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md).
