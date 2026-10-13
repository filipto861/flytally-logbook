# FlyTally 3.8.0 — Temporary Neon acceptance and cleanup evidence

**Date:** 13 October 2026  
**Scope:** isolated Neon database transaction/lock check on **synthetic scratch tables only**. This is NOT a full application or `@neondatabase/serverless` JavaScript client test.

## Isolated target

- Neon project: **Logbook Shadow** (`muddy-dust-14049657`).
- Parent: default branch `production` (`br-dark-math-b1snjzub`); never addressed for SQL writes.
- **Created ephemeral child branch** `ft-380-atomic-acceptance-20261013-temp` (`br-sparkling-leaf-b1giaanc`); verified parent, `primary=false`, `default=false`, state `ready` prior to deletion.
- Query calls supplied explicit `project_id`, `branch_id` and `database_name=neondb`. Actual server version was PostgreSQL `180006` (18.6); local prior D2 source-exact test was native PostgreSQL 16, a **separate** evidence source.
- Created only `ft380_atomic_20261013` schema and scratch tables `trash`, `flows`, and scratch PL/pgSQL function `restore_once`. No changes to `public` tables, real account rows, source logbook flights, app migrations or production branch.

## Actual verified observations

| Gate | Observation | Disposition |
| --- | --- | --- |
| Isolated branch identity | Correct ephemeral child, separate from default | **PASS** |
| Successful atomic SQL batch | Scratch flow `trash_id=202`, `amount_minor=1255`, recorded `CZK` and restore marker both persisted via Neon `run_sql_transaction` | **PASS** |
| Failure and rollback | Intentionally late `amount_minor=-1` constraint rejected the same transaction after earlier INSERT and marker UPDATE | **PASS** |
| Post-failure durable state | `trash_id=101` had `flow_rows=0` and `restored_at IS NULL` | **PASS** |
| Competing same-trash calls | Parallel separate Neon `run_sql` calls of scratch `restore_once(303,...)` returned exactly `restored` and `already_restored`; persisted exactly one valid flow, marker set | **PASS** (Neon connector-level calls) |
| Permanent scratch cleanup | Called `delete_branch` against exact verified ephemeral ID; list afterwards showed branch **absent** | **PASS** |
| Existing branches preserved | Original 4 branches including primary `production` present after cleanup | **PASS** |

## Exact cleanup evidence

- Deleted only newly created `br-sparkling-leaf-b1giaanc` branch; it was checked **nonprimary, nondefault, expected name and parent** immediately before deletion.
- `delete_branch` completed without error. Independent `list_branches` verification showed 4 original branches and no matching temporary branch.
- All synthetic schema objects and test compute from the child branch were removed with that branch. No other branch was deleted; no remote SQL against default branch.

## What this DOES NOT certify

1. These SQL queries used the **Neon connector API** (`run_sql` / `run_sql_transaction`) on PostgreSQL 18, **not** the application `@neondatabase/serverless` `neon(...).transaction([...])` JavaScript implementation. There was no actual SDK-level request, static tagged query array, pooled HTTP semantics, role/auth adapter, or serverless error-mapping test.
2. The tested PL/pgSQL function was a disposable *synthetic* row-lock model; it did **not** execute exact `lib/flight-trash.ts` SQL, did not touch `deleted_flights` production rows, and did not verify cross-trash same-natural-key conflicts or ordinary Add/Edit writers.
3. This did not prove full-v20 signed account backup, v21 migration correctness on Neon, SIX currency registry authority, aircraft certification/shared/void applicability or production runtime behavior.
4. The temporary Neon branch **no longer exists**; it must not be referenced for future tests, and no connection URL/password was retained or published.

## Next release gates

- Separate scoped **JavaScript SDK `@neondatabase/serverless` HTTP transaction** proof on a newly approved short-lived isolated Neon branch or a safe authorized nonproduction target, with the same branch cleanup discipline. Do not describe connector-level evidence as that SDK proof.
- Resolve ordinary Add/Edit vs Restore and different-trash natural-key concurrency guarantees, protected history/participant/void and legacy archive compatibility; reconcile all unmerged v3.8.0 PRs and signed v13 backups. Full Node suites/build/CI/Playwright and release smoke remain pending.
- **No** main merge, production schema migration v21, prod deploy, FX/backfill or `flytally-training` edit was performed during this Neon test and cleanup.
