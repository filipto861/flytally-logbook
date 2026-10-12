# Currency 3.8.0 — A1-T2b disposable PostgreSQL 16 catalog rehearsal

**12 October 2026 · DRAFT ONLY · NOT a runtime restore implementation**

## Identity and dependencies

- Repository: `filipto861/flytally-logbook`.
- Base branch: `feat/3.8.0-a1-t2a-currency-schema-capability` ([Draft PR #324](https://github.com/filipto861/flytally-logbook/pull/324)), exact base HEAD `ee51e41b202e2626458de001d4fe57578c507cdc`.
- A1-T2b branch: `feat/3.8.0-a1-t2b-disposable-pg16-catalog`, **nested review against A1-T2a**, not merged into `main`.
- Unregistered SQL fixture is an exact copy of [draft #322](https://github.com/filipto861/flytally-logbook/pull/322), source Git blob `74b482b265cf3085a99ccbf2837614f382b04ed5`. Test computes and checks that blob SHA **before DDL**.
- Runtime `lib/flight-trash.ts`, `lib/db.ts`, migration version `20`, currency writers, signed backup, Neon and Training are **not touched**.

## What this batch can and cannot prove

- New pure guard in `tooling/currency-a1t2b-local-target.ts`: only a URL for user `flytally`, database `flytally_currency_test`, literal host `127.0.0.1`, nonstandard explicit port, no password/query/fragment; actual backend DB, user, address, port and PostgreSQL **16** also checked **before any DDL**. Libpq `PG*` overrides are cleared before starting `psql`.
- New integration test `tests/integration/postgres-currency-a1t2b-catalog.test.ts`: creates an isolated random **reduced v20 fixture schema**, classifies `v20`, executes the pinned unregistered v21 DDL **twice** in that schema, verifies `v21_shape` and four constraints, then checks missing column and wrong type produce `partial_v21`. Drops only the random schema in `finally`.
- Passing this test proves **schema-catalog introspection and additive candidate behavior on a reduced fixture only**. It does **not** prove complete v20 equivalence, certified-flight correctness, trash restore atomicity, concurrent two-session restore, signed v13 roundtrips, Neon HTTP behavior, or writer safety. It does not register v21.
- Existing `inspectCurrencySchema()` returns `v21_shape`, **not** `v21 approved` and not an authorization to write.

## Execute on owner's Windows workstation

Prerequisites: Git, Node **24.x**, PostgreSQL **16** binaries at `%ProgramFiles%\PostgreSQL\16\bin`, clean tracked files, no untracked TypeScript, and the exact A1-T2b branch checked out.

```powershell
git fetch origin
git switch feat/3.8.0-a1-t2b-disposable-pg16-catalog
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-a1t2b-local.ps1
```

The runner creates a new temporary native PG16 cluster and `flytally_currency_test` on a dynamically allocated loopback port, sets both `FLYTALLY_POSTGRES_INTEGRATION=1` and `FLYTALLY_A1T2B_DISPOSABLE=1`, runs exact-HEAD `npm run typecheck`, guard unit tests and the focused PostgreSQL integration test, then stops and deletes its own cluster if shutdown succeeds. Existing local PostgreSQL instances, user's untracked files, Neon and Vercel are not modified.

**Fail closed:** wrong branch, dirty tracked files, untracked TypeScript, Node not 24, missing PG16, wrong server identity, fixture Git SHA drift, query failure or test failure must prevent a PASS. The runner preserves a possibly still-running temporary cluster after failed shutdown instead of deleting its files.

## Evidence status (recorded at authorship)

| Gate | Status |
| --- | --- |
| Guard targeted test on Node 22.16.0 | **8/8 PASS** (local sandbox) |
| Isolated strict TypeScript for guard, TS 5.8.3 | **PASS** (local sandbox) |
| Integration test TypeScript syntax check, Node 22 | **PASS** (local sandbox) |
| Exact fixture match | **Verified GitHub blob**; same as draft #322 |
| Full-repository Node 24 typecheck | **NOT RUN** |
| Windows PowerShell/native temporary PostgreSQL 16 runner | **NOT RUN** |
| Actual PG16 catalog/DDL assertions | **NOT RUN** |
| CI, Neon HTTP, full signed v13 and full v20 equivalence | **NOT RUN** |
| Migration registration, merge, production deploy | **NOT PERFORMED** |

## Next gate

After a successful owner-local A1-T2b run, review exact branch/commit and test output. Then proceed to **A1-T2c atomic trash-restore SQL prototype**, retaining all earlier B1–B5 guards: numeric IDs, locked source snapshots, exact amounts, no loss of monetary evidence, protection/correction checks, preexisting duplicate semantics, child record completeness/ownership, independent-session concurrency and full rollback. A1-T3 runtime integration remains blocked until these validations and a separate Neon HTTP transaction compatibility assessment pass. A1-C, A1-F and A1-G remain separate open milestones.
