# 3.8.0 A1-T2c — Atomic Flight Trash Restore: Source Contract & Review Gate

**12 October 2026 · DESIGN ONLY · no SQL execution, runtime edits, migrations, or deploy.**

## 0. Verified baseline

- `flytally-logbook` `main@4ca2847795435549f36d44f253eb7c105eea6d25`, runtime `DATABASE_SCHEMA_VERSION=20` (`lib/migration-plan.ts`). Four currency drafts #319–#322 plus A1-T1 #323, A1-T2a #324 and nested A1-T2b #325 are **unmerged**.
- A1-T2b exact owner-local SHA `2d4699deb4e31630f5b719cef9cdf6b61258bdc3`: Windows Node24 project typecheck PASS, target guard 8/8 PASS, **actual disposable PG16 3/3 PASS**, 127.0.0.1:50275 DB identity and server shutdown PASS. This proves ONLY a reduced-v20 catalog/v21-shape rehearsal, not restore or full-v20 equivalence. See `docs/product/3_8_0_CURRENCY_A1T2B_DISPOSABLE_PG16_HANDOFF.md`.
- Primary restore source: `lib/flight-trash.ts` (main blob `2c51c760b1bd52a7544c51bd6dedf4f050dd573b`), `lib/db.ts`, `lib/local-postgres.ts`, `lib/db-optimization.ts`, `lib/v159-schema.ts`, unregistered #322 v21 SQL. These sources supersede earlier reviewer examples.

## 1. Canonical existing behavior to preserve

1. `moveFlightToTrash` saves `to_jsonb(f)` and ordered `to_jsonb(t)` / `to_jsonb(e)` in `deleted_flights` (`flight_data`, `tracks_data`, `expenses_data`), with `user_id`, `original_flight_id`, `purge_after`, `restored_at`, `restored_flight_id`.
2. `restoreDeletedFlightRecord` deliberately inserts a **new numeric sequence flight ID** and reparents new track/expense identities. Do NOT write original archived IDs into the new rows; do NOT blindly restore every JSON field.
3. Preserve the existing natural-identity duplicate predicate exactly: `user_id`, `date`, `UPPER(TRIM(registration))`, `COALESCE(off_block,'')`, normalized `departure`, normalized `arrival`. `idx_logbook_flights_restore_key` is **non-unique**; no claim of `23505` or universal race protection.
4. Existing error shape is `{flightId?:number;error?:string}`; retain exact user-visible duplicate and expired/not-found categories, while surfacing corrupt/protected snapshot failure without exposing raw SQL/DB details.
5. The current code filters nonpositive expenses and substitutes missing archived currency with `CZK`: these are **future exact-write data-loss hazards** and MUST be replaced by validation/fail-closed behavior, not emulated. Archive `track_points` are not preserved by current trash snapshots; keep this preexisting limitation explicit, do not silently call a restore complete for omitted track-point evidence.

## 2. Candidate data contract — prerequisites, not implementation

- Authenticated owner/trash ID, not user-supplied mutable row ownership. `flight_data.id` and `flight_data.user_id` must match numeric `deleted_flights.original_flight_id` and `deleted_flights.user_id`. Every archived track/expense must carry correctly typed original `flight_id`, `user_id`, and unique valid positive original row IDs. Missing/malformed/unsafe integers => reject.
- Source is in scope only while `restored_at IS NULL` and `purge_after > NOW()`; avoid reading stale/unlocked archived snapshots as authority.
- Original flight and external DB evidence must be checked for certification/correction/void/locked/participant state. `flight_certified_revisions` may contain history not evident in JSON. Never inject the draft A1-T1 no-history stub into runtime. Protected histories fail closed.
- Monetary v20: no invention of a flight-price denomination; NULL v21 triplet means legacy unresolved flight pricing, not zero. Expenses have a **recorded NOT NULL** `currency`; absent/NULL/malformed currency rejects instead of default `CZK`. Legacy `(amount_encoding, amount_minor_units)=(NULL,NULL)` is the old two-decimal **encoding**, independent of the currency's ISO exponent.
- Exact v21 flight tuple `(price_currency_code,price_currency_minor_units,price_per_hour_decimal)` is all present or all absent; validate exact decimal **as source text** from PostgreSQL NUMERIC, no JavaScript floating-point reconstitution. Hourly-rate decimal precision is not capped by the ISO minor-unit exponent. Exact v21 expense `(currency,amount_minor,amount_encoding,amount_minor_units)` preserves all values; `amount_minor` requires `0 < amount_minor <= 1,000,000,000` in existing v159 DB constraints.
- A1-T1 validators from Draft #323 and A1-T2a shape helper from Draft #324 are dependencies not yet merged: do not silently bypass them or change their contracts while planning an isolated SQL prototype.
- Schema capability: `v20` means don't reference v21 columns; `v21_shape` by itself does not establish constraints, valid registry or write authority; `partial_v21/unknown` => unavailable. v20 destination plus exact v21 payload => **fail closed**, not legacy-data projection.
- Keep explicit per-version SQL projection for `flights`, `flight_tracks`, `flight_expenses`; no `INSERT ... SELECT *`, `json_populate_record` wholesale, undocumented defaults, hidden normalization or extrapolation.

## 3. Transaction design proof obligations

1. A **single atomic transaction** across restored flight, all archived tracks, all archived expenses, trash marker. Any validation/insertion/count/content failure must roll back **all rows**, retaining original trash state; sequence gaps after rollback are acceptable.
2. SQL design must be feasible with the repo's `@neondatabase/serverless` HTTP-style `sql.transaction([...])` **static query batch** (`lib/db.ts`) and local psql-based adapter (`lib/local-postgres.ts`). Pre-read alone is NOT the transaction authority; row eligibility/ownership/protection/byte-consistency must be rechecked at the transaction boundary.
3. Serialize two **independent PostgreSQL sessions** on the same `deleted_flights.id` with demonstrably effective row lock and one restore result. Verify that `SELECT ... FOR UPDATE` syntax and semantics work within the actual proposed multi-statement batch before relying on it.
4. A pre-allocated new sequence ID is NOT proof a flight was inserted. Distinguish 0 eligible archive rows from an eligible archive whose restored INSERT yields zero due to natural-key duplicate. Avoid marking a row restored if no flight is present.
5. Assertions must be runtime deterministic and transaction-failing. Do NOT use `CASE ... THEN 1/0` (planner hazards) or raw bound parameters inside PL/pgSQL `DO $$ ... $$`; a DO block cannot accept ordinary external bind arguments. Derive counts from DB-locked snapshots or safe transaction-local staging. Prove temp table visibility/transaction cleanup under local PG16 and, separately, Neon HTTP before any runtime integration.
6. Count checks AND **content-level roundtrip** checks for each restored track/expense, including exact legacy/v21 money, ownership and canonical source identity. Equal row counts alone are insufficient; no child should be silently filtered, inferred or defaulted in conflict with source.
7. Restore marker must reference the actual new flight ID; returned marker exactly one row on success, zero on already-restored/stale/expired case, with prior API mapping preserved. Distinguish zero-write terminal outcome from rollback-worthy conflict/corruption.
8. Cross-trash same-natural-key conflict is not resolved by the current non-unique index. Design must explicitly state tested guarantees and unprotected cross-writer races; any strengthening of concurrency or canonical uniqueness requires separate backward-compatibility/owner review, not a speculative new unique index.

## 4. Required disposable PostgreSQL 16 proof matrix (NOT RUN)

| ID | Check | Acceptance |
| --- | --- | --- |
| T2c-01 | v20 valid archive legacy pricing + legacy expense | New numeric IDs, preserved monetary values, exact parentage and marker |
| T2c-02 | Candidate v21 JPY/EUR/KWD exact flight price and expense tuple | Byte/decimal-string preserving roundtrip, no FX/inferred units |
| T2c-03 | v20 target receiving future exact v21 payload | Fail closed, zero rows touched |
| T2c-04 | Missing currency, invalid/missing amount, partial encoding/currency tuple | Reject, zero restored children and marker |
| T2c-05 | User/original-ID mismatch in flight/track/expense | Reject, zero-write |
| T2c-06 | Protected, certified, revised, locked or external certified revision evidence | Reject/no historical evidence rewrite |
| T2c-07 | Expired, already restored and stale snapshot | Stable current API result, no mutation |
| T2c-08 | Existing normalized natural-key duplicate | Duplicate response, no flight/child rows, no marker |
| T2c-09 | Forced child FK/CHECK/error midway | Entire transaction rollback, no orphan/marker |
| T2c-10 | Two separate sessions concurrently restoring SAME trash ID | Exactly one successful new flight; no duplicate, marker consistent |
| T2c-11 | Two trash IDs / concurrent writers same natural key | Characterize actual nonunique-index behavior; no claim without proof |
| T2c-12 | Bad/empty/malformed JSON arrays, inconsistent row count/content | Atomic failure; never silently drop evidence |
| T2c-13 | Repeated calls / original sequence ID reuse | New ID mapping valid, no unintended collision or duplicate |
| T2c-14 | PG16 temp table / DO / static multi-statement transaction semantics | SQL execution and rollback demonstrated in real PG16 |
| T2c-15 | Regression with current v20 certifications/track schemas and source applicability | No bypass of DB triggers or owner authority |
| T2c-16 | Neon HTTP read-only/isolated transaction compatibility gate | Separate documented proof before any real app runtime wiring; no unauthorized remote writes |

## 5. Staged implementation, owner authorization and exclusions

- **A1-T2c D0 (this document):** exact-source contract / risk discovery and independent DeepSeek/Claude read-only review. No SQL writing or database access.
- **A1-T2c D1 (after review):** minimal PG16-only atomic transaction prototype on an owned freshly disposable target, with version-aware fixture and T2c-01..15 tests. New independent draft branch; no runtime import. Do not claim Neon compatibility from local results.
- **A1-T2c D2:** explicit HTTP transaction compatibility evidence; if unsupported, redesign transaction architecture rather than decompose an atomic restore into multiple HTTP writes.
- **A1-T3 (separate owner approval):** guarded integration into `lib/flight-trash.ts`, full runtime/regression/DB/Neon checks, reconciliation of #323/#324/#325 branches. Only after this stage can direct restore behavior change.
- Follow-on milestones **A1-C** (signed portable restore collisions), **A1-F** (full v20/source-backed signed-v13 rehearsal) and **A1-G** (source/rollout) remain separate hard release gates. D1–D4 frozen. No main merge, production deploy, data migration, v21 registration, historical backfill, silent FX, or changes to `flytally-training`.

**Decision pending:** independent review must reconcile concurrency and static transaction feasibility against real PostgreSQL and Neon HTTP semantics before an exact SQL patch is approved.