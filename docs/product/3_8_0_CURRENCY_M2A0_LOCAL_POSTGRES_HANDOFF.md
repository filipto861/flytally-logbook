# FlyTally Logbook 3.8.0 — M2-A-0 localhost PostgreSQL verification handoff

**Date:** 11 October 2026. **State:** Automated test harness **AUTHORED** on [draft PR #322](https://github.com/filipto861/flytally-logbook/pull/322), actual Docker/Node24/PostgreSQL execution **NOT RUN** at the time of this handoff. **Do not merge, register v21, mutate remote Neon or deploy.**

## CIDR suffix identity mismatch resolved in source (11 October 2026)

Owner-local native PostgreSQL 16 run at candidate `14769749b78446b4992310dcbe6014bd0428e389` passed initialization, startup and shutdown on temporary local port **52166**. The new diagnostic isolated the mismatch: expected `flytally_currency_test|flytally|127.0.0.1|52166`, observed `flytally_currency_test|flytally|127.0.0.1/32|52166`. The name, role and port all match; PostgreSQL renders `inet_server_addr()::text` with its /32 network mask. There is **no evidence of a wrong database or credentials** in this run, but the strict test correctly prevented all SQL acceptance from proceeding. **Six PostgreSQL cases NOT RUN**.

Code draft [PR #322](https://github.com/filipto861/flytally-logbook/pull/322) now uses `host(inet_server_addr())`, which returns the host address without the mask, instead of `inet_server_addr()::text`. The existing `psql -w` identity preflight, exact database/role/address/dynamic-port equality, expected/observed diagnostics, isolated temporary PostgreSQL, tracked-file guard, and safe cleanup remain unchanged. Source regression assertion now explicitly verifies `host(inet_server_addr())` and rejects `::text`. **Six authored static assertion bodies PASS under mocked V8 evaluation, NOT native PowerShell/Node/PostgreSQL execution.**

Owner next step on the same feature branch (no Docker, no password, no remote DB):

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1
```

If the identity check passes, the script will automatically proceed to real Node24 typecheck, static tests and six PostgreSQL integration tests in the temporary database; send the complete output before any merge or migration registration.

## Native PostgreSQL startup passed, identity mismatch diagnosed (11 October 2026)

Owner-local test at exact branch commit `498577d9d206a6d896316bd7b93fde77c1ac95bc` passed the Git working-tree preflight while preserving **14 unrelated untracked files**, successfully initialized a **new PostgreSQL 16 instance on 127.0.0.1:54836** in a unique temporary data directory, started the server and later stopped it normally. The reported Czech locale/fulltext message was a nonfatal initialization warning. The preflight `psql` query exited successfully, but the equality check returned **`Test database identity mismatch. PostgreSQL tests NOT RUN.`** No observation of the actual returned identity was logged; **root cause cannot yet be determined**, so do not claim that the DB identity is correct or weaken the gate.

On draft [PR #322](https://github.com/filipto861/flytally-logbook/pull/322), changed the identity check to request four columns via `psql -At -F "|"`, capture one non-empty output row and print **expected and observed identity strings** without including any password/secret. Acceptance still requires exactly one row and an exact case-sensitive match for `flytally_currency_test|flytally|127.0.0.1|<random-port>`. A static source regression test asserts the fail-closed check remains. **6/6 static authored assertion bodies PASS in a mocked V8 source-evaluation**; the Windows runner, TypeScript and actual PG acceptance have **NOT BEEN RE-RUN** after this change.

**Owner next commands on existing branch:**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1
```

If identity still mismatches, the printed observed/expected pair will allow a targeted fix. Do not bypass the guard, modify the old cluster at port 55432 or run against Neon.

## Unrelated untracked files — local test guard reconciliation (11 October 2026)

Owner-local `git pull --ff-only` succeeded, but native runner then stopped **before creating any PostgreSQL cluster** because `git status --porcelain --untracked-files=normal` found only three unrelated entries: `flytally-logbook-branch-cleanup-2026-10-11-fixed.ps1`, `flytally-logbook-merged-branch-cleanup-2026-10-11.ps1`, and `tooling/r2d2-cache-spike/`. `git diff --stat` was empty. They are **untracked owner files, not authorized for deletion, stashing or inclusion in the PR**.

Patch on draft [PR #322](https://github.com/filipto861/flytally-logbook/pull/322): native runner now fails on any tracked-file change (`git status --porcelain --untracked-files=no`), **preserves** unrelated untracked files, but fails if any untracked `.ts/.tsx` would affect `tsconfig.json`'s broad `**/*.ts` and `**/*.tsx` include. This preserves exact-candidate typecheck evidence while allowing unrelated PowerShell/JS cache-spike artifacts. Static guard test updated. **6/6 authored test assertion bodies PASS in mocked V8**, native PowerShell and PostgreSQL gates **NOT RUN**. Unknown contents of `tooling/r2d2-cache-spike/` must not be guessed; if it contains TypeScript files, the guard will stop and an isolated clean worktree is required. No existing files were modified/deleted by this test attempt.

**Owner next commands (same repository and branch):**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1
```

## Owner-local PostgreSQL authentication recovery (11 October 2026)

**Evidence received:** Node `v24.19.0`, TypeScript `PASS` and authored static tests `5/5 PASS` on the owner's Windows checkout. `pg_isready` confirmed that some PostgreSQL server answered on `127.0.0.1:55432`, but `psql -w` to `flytally_test` failed `fe_sendauth: no password supplied`. The owner then manually ran the six integration tests despite failed identity verification: all six test cases plus the cleanup hook failed from `password authentication failed for user "flytally"`. **No candidate DDL was executed; real PostgreSQL acceptance remains NOT RUN**, not a v21 business-logic failure. Multiple local PG clusters and historical authentication modes existed; never assume `55432` or the username imply working credentials.

**Recovery (recommended, without Docker or access to old cluster):** On [PR #322](https://github.com/filipto861/flytally-logbook/pull/322), added `tooling/run-currency-m2a0-local.ps1`, a **Windows PowerShell 5.1-safe ASCII-only** native PostgreSQL 16 runner. It uses the already-installed PostgreSQL 16 bin path under `Program Files`, existing Node 24/npm and Git; it chooses a free loopback port independently of 55432, initializes a random per-run PostgreSQL cluster under `$env:TEMP`, binds ONLY `127.0.0.1`, creates dedicated `flytally_currency_test` with local-only temporary trust authentication, verifies actual DB name + role + address + port, runs `npm run typecheck`, six authored static tests and six isolated PostgreSQL tests. It then stops its own process and removes only its freshly created temp directory. If startup/stop status is uncertain it preserves files rather than deleting a potentially active data directory. It restores old shell process environment after execution. **Do not use remote PostgreSQL, change `pg_hba.conf` on existing cluster, disclose credentials or manually execute v21 SQL.** Local trust is acceptable only for this short-lived localhost-bound isolated fixture, never for shared/remote/production.

**User commands (same clean feature branch):**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1
```

Optional after targeted PASS: run the same script with `-Full` to include existing PostgreSQL integration suite. **Never run the six integration tests again directly against `55432` without a passed DB identity/auth preflight.**

**Fail-closed regression:** The integration test now runs `psql -w` (no interactive password prompts), validates a PostgreSQL preflight before `CREATE SCHEMA`, and only attempts `DROP SCHEMA` if creation succeeded. A sixth static guard test checks the native Windows runner and fail-closed preflight. **6/6 authored static assertion bodies PASS** under a GitHub-source V8/mock filesystem check (NOT actual Node or native PG). **Actual native runner/PG tests NOT RUN** until the owner supplies new terminal output.

## Windows PowerShell 5.1 parser recovery (11 October 2026)

The first owner-local invocation stopped **before running any Docker command** with PowerShell parser error `TerminatorExpectedAtEndOfString` at line 71. Root cause was one UTF-8 **em dash** in the runner's banner, decoded by Windows PowerShell 5.1 as ANSI because the script had no UTF-8 BOM; the misdecoded byte sequence introduced a typographic quote. **Fixed in PR #322** by making the entire `.ps1` **ASCII-only**.

Independent audit caught a second potential Windows↔Linux issue: joining Bash commands using `[Environment]::NewLine` under Windows creates `CRLF`, which Bash treats as significant `\r` characters. The runner now joins the commands with `"; "` to remain portable.

A **fifth source guard test** in `tests/currency-v21-schema-draft.test.ts` now rejects non-ASCII runner contents, CRLF bash script joining, and unsafe Docker invocation changes. **5/5 authored static-test assertion bodies PASS** in an in-memory V8 harness reading the exact GitHub source (mocked file reads). This is **not** a Node24 `node --test` run, a PowerShell parser test, a Docker run or a PostgreSQL test.

**Next owner commands, from the same clean repository checkout:**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-docker.ps1
```

Report the full output. The original parser failure did not execute migrations, test fixtures or any database DDL.

## Exact source and dependencies

- Repository: `filipto861/flytally-logbook`; baseline `main@4ca2847795435549f36d44f253eb7c105eea6d25`, schema version **20**, production app **3.7.0**.
- Candidate code branch: `feat/3.8.0-currency-m2a0-sql-draft`, draft PR **#322**; documentation/draft reconciliation on [PR #319](https://github.com/filipto861/flytally-logbook/pull/319).
- `sql/drafts/3_8_0_currency_v21_additive_candidate.sql`: 12 nullable fields across `rates`, `aircraft`, `flights`, `flight_expenses` and CHECK constraints; **never registered** in `lib/db-optimization.ts` or `lib/migration-plan.ts`. Any UPDATEs in integration tests target only a disposable local fixture.
- `tests/currency-v21-schema-draft.test.ts`: five static source-contract tests; belongs to canonical `npm test` glob.
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
