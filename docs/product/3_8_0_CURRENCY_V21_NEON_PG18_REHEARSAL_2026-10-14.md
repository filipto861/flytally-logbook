# Currency 3.8.0 — v21 Neon PostgreSQL 18.6 isolated rehearsal (14 October 2026)

## Authority, scope and source
Owner expressly approved creation of an **isolated temporary Neon branch**, execution of migration rehearsal there and mandatory deletion. This is **not** approval to run v21 against primary production, to register it in migrations or to deploy 3.8.0.

- Repo: `filipto861/flytally-logbook`; Draft PR [#338](https://github.com/filipto861/flytally-logbook/pull/338).
- SQL source at pre-rehearsal docs HEAD `739871c41ea7c34855c7c8740226b09221661ad6`: `sql/drafts/3_8_0_currency_v21_additive_candidate.sql`. Same migration SQL as owner-local full acceptance on code SHA `669708fec856f5e88072a474f2b97b573a7881f6`; only docs differed.
- Existing candidate file warns against **any remote database execution**. This specific isolated remote testing was explicitly owner-authorized as a narrow exception for a disposable child. The source remains review-only and unregistered, not authorized for production.
- Neon project: **Logbook Shadow**, `muddy-dust-14049657`; immutable parent `production` / `br-dark-math-b1snjzub`; database `neondb`; server `18.6 (c021049)`.
- Temporary branch: `ft-380-v21-pg18-rehearsal-20261014` / `br-gentle-glade-b1erhgaj` from parent ID above, verified `primary=false`, `default=false`, `ready` before SQL.
- Branch creation first rejected an attempt to set a prohibited suspend interval (HTTP 412); a separate list confirmed **no branch** created. A retry with default compute configuration created the branch.
- All Neon SQL calls supplied **explicit child branch ID and database**; only catalog SELECTs targeted primary production.

## Baseline (read-only against new child)
| Check | Observed |
|---|---|
| Schema registry | Versions 1–20 contiguous; count 20, sum 210 |
| Rates | 33 |
| Aircraft | 25 |
| Flights | 315 |
| Flight expenses | 0 |
| Deleted flights | 8 |
| Account backups | 24 |
| New v21 columns | 0 |
| New v21 CHECKs | 0 |
| Existing noninternal triggers on relevant tables | 5 |

## Execution and postflight
Parsed the pinned SQL source into exactly **four** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements plus **four** guarded `DO $currency$` CHECK-constraint statements (the source's `BEGIN/COMMIT` wrapper excluded because the Neon connector transaction owns the transaction). Verified no unexplained SQL text remained after decomposition.

1. Executed a v20 database/registry precondition `DO` followed by these eight source-exact DDL statements in **one Neon connector `run_sql_transaction`** on the explicit temporary branch: **PASS, no statement errors**.
2. On child, confirmed **12/12** v21 metadata columns across `rates` (4), `aircraft` (3), `flights` (3), `flight_expenses` (2); each is **nullable, no default**, and type matches TEXT/SMALLINT/NUMERIC candidate.
3. Confirmed four exact-name CHECK constraints, each `convalidated=true`. New monetary metadata non-null counts in the cloned legacy records were **zero**.
4. Reexecuted the same eight source-exact statements on the child: **PASS, no errors** (DDL-level idempotence).
5. Rechecked child: registry still v20; unchanged table counts **33 / 25 / 315 / 0 / 8 / 24**, v21 columns 12, validated constraints 4.
6. Independent primary **read-only** query: registry still v20; columns 0, constraints 0, same six table counts. No production DDL or DML.
7. Requested extra PostgreSQL18 synthetic temporary-row CHECK tests using temporary `LIKE ... INCLUDING CONSTRAINTS` tables. The tool safety policy **blocked the request before a test result**, therefore all proposed PG18 positive/negative sample-row assertions are **NOT RUN**, not PASS. The previously verified local PostgreSQL16 suite (8/8) covers its own exact/invalid monetary tuple cases, not this PostgreSQL18 test.

**Evidence limits:** row counts and schema preservation are directly checked; pre/post row-content hashes were not captured. Zero existing `flight_expenses` rows means no real legacy expense row on this branch was used for a compatibility scan. Constraint validation and successful DDL on the real historical schema do not prove every application writer/reader. Connector transaction execution is not the actual application's `@neondatabase/serverless` JavaScript transaction path. No on-Neon full signed-v13 recovery, historical shared/certified/void matrix, full production smoke, or migration failure-path proof was run. The optional synthetic checks were security-blocked.

## Mandatory cleanup (completed)
- Independently confirmed **child ID**, exact name, parent ID, `primary=false`, `default=false` and expected postflight/production states **before deletion**.
- Called Neon `delete_branch` **only** for `br-gentle-glade-b1erhgaj`.
- Subsequently listed all branches and filtered by the child name: **temporary child absent**.
- The four pre-existing project branches remain, and original `production` branch `br-dark-math-b1snjzub` is still **primary/default**.
- No DB credentials, user-row content, or decrypted URL persisted in this document.

## Status / next decisions
**Scoped PG18 remote-schema rehearsal PASS; optional PG18 active tuple rejection NOT RUN; temporary branch cleanup VERIFIED.** This does not lift the migration gate.

Prior to production, reconcile ISO 4217 source attestation caveat, exact sharing/old-value presentation boundaries, signed v13 and certified/void/provenance evidence, protected backup/rollback or forward-fix plan, and app `@neondatabase/serverless` integration behavior. Independent DeepSeek review of v21 and a documented release/owner go/no-go remain recommended. PR #338 stays **Draft**; do not register or run v21 in production without separately authorized release gate.
