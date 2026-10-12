# FlyTally Logbook 3.8.0 — M2 additive monetary schema design (review draft)

**Date:** 11 October 2026. **Status: DESIGN / NOT APPROVED FOR MIGRATION OR DEPLOY.**  
**Owner product decisions D1–D4: FROZEN** in [11 October currency decision record](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md). **Technical database shape and rollout still provisional.**  
**Code baseline:** `filipto861/flytally-logbook main@4ca2847795435549f36d44f253eb7c105eea6d25` (shipped package 3.7.0).

**12 October M2-A-1 second independent review:** DeepSeek **APPROVE WITH CHANGES** on signed backup/trash compatibility; [source-verified reconciliation](3_8_0_CURRENCY_M2A1_DEEPSEEK_RECONCILIATION_2026-10-12.md) accepted true data-loss/restore-conflict risks but rejected trigger re-enumeration, missing-paired-CHECK assertion and mandatory v14 format claim. Exact-write rollout remains blocked; v21 unregistered and no production schema action authorized. Earlier dated statements about `NOT RUN` testing below are historical; focused/full PG 6/6 and 106/106 later PASS are recorded in [M2-A-0 handoff](3_8_0_CURRENCY_M2A0_LOCAL_POSTGRES_HANDOFF.md).

## 11 October 2026 independent review disposition (supersedes provisional details below)

The owner-supplied DeepSeek review returned **APPROVE WITH CHANGES**. The review findings were reconciled against actual code in [M2 DeepSeek reconciliation](3_8_0_CURRENCY_M2_DEEPSEEK_RECONCILIATION_2026-10-11.md), and the **isolated, unregistered candidate SQL** is in [draft PR #322](https://github.com/filipto861/flytally-logbook/pull/322).

**Adjusted technical direction for M2-A-0 (still NOT approved for production):** `amount_encoding` explicitly marks future expense rows (old `NULL/NULL` means legacy two-decimal parser encoding, **not** a saved ISO exponent), paired amount/currency/scale constraints fail closed on SQL `NULL`, and one currency applies to the current combined wet/dry rate row. A redundant persisted `money_state` column is **not** added without proof that the tagged read model cannot distinguish `known`, `unknown_currency`, `not_tracked` and `unavailable` from the record and attestation evidence.

The standalone SQL draft uses unconstrained `NUMERIC` as a **candidate only**, not a finalized numeric/rate precision or rounded charge rule. New exact writers remain disabled. An unchanged old runtime cannot provide warnings about metadata it doesn't understand: **before first exact writes**, deploy and verify a metadata-aware backwards-compatible reader and define a rollback barrier (roll forward, or rollback to that compatible reader; never silently rollback to a denomination-blind writer). No live schema registration/execution, app-route import or remote DB writes.

The eight DeepSeek test areas remain relevant but require actual local PostgreSQL evidence. The drafted SQL has only passed in-memory source static predicates; full `node --test`, TypeScript, Node24, PostgreSQL, signed backup restore, v20 certified correction/void and Vercel→Neon identity are **NOT RUN / NOT VERIFIED**.

## 1. Verified current DB/code facts

- Current main `lib/migration-plan.ts` declares **`DATABASE_SCHEMA_VERSION=20`** and 20 known migrations. `lib/db-optimization.ts` `ensureDatabaseOptimizations()` **executes pending migrations during runtime initialization** via `sql.transaction`, so registering `v21` before deployment authorization can change the target DB unexpectedly; do not do it in a read-only design phase.
- Neon `muddy-dust-14049657`, branch `br-dark-math-b1snjzub` (*Logbook Shadow*, branch name production) read-only introspection shows 20 applied migrations (max=20), **311** flights / **108 certified** / **110 locked**, **57** certified flight revisions, **1** voided certified tombstone, **0** expenses and **0** NULL-dated rate rows. **Branch-to-live-Vercel connection NOT VERIFIED**. Counts are evidence for this specific branch, not a public production census.
- `flights.price_per_hour`, `aircraft.default_price_per_hour`, `rates.price_per_hour`/`rates.dry_price_per_hour`: nullable PostgreSQL **`double precision`**, historically **no per-value denomination**. `user_settings.currency` nullable TEXT DEFAULT 'CZK' cannot prove legacy currency.
- `rates` has `UNIQUE(user_id,registration,valid_from)`; date column `valid_from` is nullable. New schema must preserve this identity; do not introduce an unrelated uniqueness key or silently re-key by aircraft ID.
- `flight_expenses` uses `amount_minor BIGINT NOT NULL CHECK(amount_minor > 0 AND <= 1000000000)`, `currency TEXT NOT NULL` checked only for alpha-3 syntax. The current input/parser assumes **two** decimals and does not authenticate an ISO currency. Old values must remain readable without reinterpreting their magnitude.
- `lib/db-optimization.ts` v20 `logbook_protect_locked_flight()` rejects certified-flight changes except exact audited correction transitions and matching archival void transitions. `lib/certification-integrity.ts` v8 payload does not hash flight prices, **but the DB immutability trigger still governs those rows**.
- `lib/flight-trash.ts` has an **explicit-column** restoration SQL for flight fields, currently dropping any prospective new financial metadata; `lib/account-restore-v6.ts` uses PostgreSQL `json_populate_record(NULL::flights/rates/aircraft,...)` and protected revision restoration. Shared-rate import/upsert overwrites same-date rate rows; existing legacy backup format is **v13**.
- Existing `app/(protected)/flights/actions.ts` resolved-price `COALESCE` returns only numeric value, which can detach the chosen amount from its source denomination. M3 must return an atomic amount + currency + exponent + provenance tuple.

## 2. M2-A first-migration objective and boundaries

**Only add nullable columns without defaults or row updates.** Legacy numeric values, certified and voided evidence, and current read/write paths must remain byte-for-byte meaningful. **No `UNKNOWN` pseudo-currency, no automatic CZK, no binary float→decimal backfill, no FX, no client-visible change.**

### Candidate column families — REQUIRE TECHNICAL REVIEW

| Table | Candidate additive metadata | Meaning / unresolved review |
| --- | --- | --- |
| `rates` | `currency_code TEXT NULL`, `currency_minor_units SMALLINT NULL`, `price_per_hour_decimal NUMERIC(...) NULL`, `dry_price_per_hour_decimal NUMERIC(...) NULL` | Explicit effective-date rate currency and **exact** decimal wet/dry rates for *future* canonical writes only; **assumption to review:** wet and dry under one rate row share currency. Their differing denominations would require separate fields. |
| `aircraft` | `default_price_currency_code TEXT NULL`, `default_price_currency_minor_units SMALLINT NULL`, `default_price_per_hour_decimal NUMERIC(...) NULL` | Aircraft default when no date-effective rate; must never be silently substituted for a rate where only a currency or amount is present. |
| `flights` | `price_currency_code TEXT NULL`, `price_currency_minor_units SMALLINT NULL`, `price_per_hour_decimal NUMERIC(...) NULL` | Historical snapshot for each **new** flight write, independent of account preference. Existing certified and draft rows retain NULL metadata on migration. |
| `flight_expenses` | `amount_minor_units SMALLINT NULL` | New amounts carry source-backed denomination precision. **NULL on a legacy expense denotes old two-decimal parser encoding, not necessarily the ISO exponent for its saved currency.** Do not divide legacy JPY/KWD expenses by a newly assumed exponent. |
| `user_settings` | **No new money column needed for M2-A** | `currency` remains only the user default; M3 server validation against trusted current monetary registry is required. |

`NUMERIC(p,s)` precision/scale and rate input limits **are not yet frozen**. `NUMERIC(22,8)` is one implementation candidate; `NUMERIC(19,4)` appeared in DeepSeek's proposal. They should be evaluated against current accepted hourly rate syntax, desired maximum amount, fractional minutes/shares and one final amount quantization; do not blindly choose either. `bigint` objects in code cannot be returned in JSON directly; transport must use validated decimal/integer string.

### First-migration invariant checks (draft, not executable plan)

- Additions **nullable with no DEFAULT** preserve all legacy rows unchanged; no `UPDATE flights` / `UPDATE rates` / `UPDATE aircraft` / `UPDATE flight_expenses` or data repair in M2-A.
- Paired currency+exponent must be either **both NULL** or **both valid** for future writes. A database CHECK may enforce syntax and scale bounds only; it **cannot prove** official ISO current-code membership or historically applicable scale. Server-side registry and immutable recording evidence remain authoritative.
- Legacy rate columns stay present until explicit retirement plan; backward-compatible reads prefer reviewed *new* exact fields only when denomination+scale+value are consistent; otherwise return `unknown_currency` or `unavailable` appropriately. Do not silently use old floating-point fallback as same-currency money.
- Existing expenses have one `currency` but a two-decimal legacy storage convention. The read model requires an explicit `legacy_amount_encoding` path and tests; avoid blanket `COALESCE(amount_minor_units, current_iso_exponent)`.
- M2-A must NOT introduce an attestation table that can bypass certified-flight protections without separate design and tests; D2 ledger is a later isolated M2-B/M3 milestone with append-only/audit/security and valid tombstone snapshot identity.
- No changes to `flights.certification_version` or `flight_certified_revisions`, `voided_*` archives, fingerprint calculation, rate history effective dates, or backup signing merely because new nullable columns exist.
- Backward deployment rollback after new writes **retains** new columns; never `DROP COLUMN` with live data. Before enabling new writes, test old runtime against additive schema, new runtime against migrated schema, and old v13 backup restore under the new runtime.
- Use a separate feature branch for reviewed M2-A code. No automatic migration registration (i.e. do **not** bump `DATABASE_SCHEMA_VERSION` from 20 to 21) until schema/target/deploy guard approved and local PostgreSQL evidence exists.

## 3. Historical attestation must be a separate audit contract

D2 authorizes an **auditably attributable** manual correction, not an immediate free-form update of protected records.

**Technical candidate only:** append-only attestation/revocation events keyed by owner `user_id`, stable record kind and record identity (including certified-flight revision or void tombstone as applicable), original monetary source fingerprint (date/identity/amount and applicable source), selected ISO code and exponent **as of attestation**, actor, time and human basis/evidence. Read-time resolver must validate current owner+exact monetary fingerprint and latest non-revoked event. No actor may assert another user's rate/flight or bypass certified/archive protections. An ambiguous flight identity, stale amount, or mismatched revised/voided source must fail closed. No mass-attestation UI or DB writes before independently reviewed ledger contract.

## 4. Explicit acceptance matrix / gates

| Scenario | Expected |
| --- | --- |
| Add nullable columns to a local v20 fixture DB | Existing row counts, exact old double values, hashes, certification and archived JSON unchanged; new columns NULL |
| Existing v13 portable backup restored into new local schema | No invented currency/exponent and no false import conflict; same protected history preserved |
| A certified/locked flight has M2-A columns | UPDATE attempt on protected row still rejected; correction flow semantics unchanged |
| Existing v20 runtime with additive M2-A schema | Current routes/backup/trash/share remain behaviorally unchanged; no new data silently written |
| New rate written on later M3 writer | One authenticated valid ISO currency+scale+exact price, effective date; snapshot preserves same source tuple |
| New currency default changed from CZK to EUR | Older rate/flight/expense metadata unchanged; account new-entry default only |
| Imported shared rate in EUR to CZK-default account | Retains EUR, no recipient-default relabel; conflicting upsert explicit and auditable |
| Old expense with non-2-decimal code | Legacy two-decimal magnitude preserved; code not interpreted with mutable ISO exponent |
| Mixture of EUR/JPY/unknown costs | Separate figures, mixed price sort disabled; no conversion |
| Rollback after new writes | Return to compatible runtime retaining additive columns; no destructive schema rollback |
| Malformed, partial or inapplicable currency metadata | Unavailable / Needs configuration, never guessed money |

### Required evidence, before any M2 migration execution

1. **Full local repo inventory:** all money-bearing paths, schema/DB migration triggers, certifications, backup/legacy import, trash, rate/share + expense/UI + report output; compare current effective source and frozen ROADMAP.
2. **Independent review:** [DeepSeek/Claude read-only M2 schema review brief](3_8_0_CURRENCY_M2_INDEPENDENT_REVIEW_BRIEF.md) prepared for source-backed critique (precision, shared-rate, historical expense encoding, immutability, restore and rollbacks) **before** costly DB changes; reviewer opinion not authority. **Review response NOT YET RECEIVED**.
3. **Primary SIX source:** actual original List One XML bytes/revision and fund classification independently checked; Node24 exact branch tests for registry + money core. Candidate third-party mirror is flagged `verifiedDirectlyWithSIX:false`.
4. **Local isolated PostgreSQL:** exercise migration twice for idempotence, constraints, 108-like certified/void preservation fixture, rollback/compatibility and v13 restore; record SHA, PG version and exact test commands. **DO NOT** point destructive tests to remote/production Neon.
5. **Production binding:** verify Vercel production environment resolves to intended Neon project/database/branch without leaking credentials; capture private infrastructure evidence. `branch_id=br-dark-math-b1snjzub` being named production is **not proof** of binding.
6. **Feature release:** safe migration ordered **before** any new source/writer depends on fields; rollout/rollback plan, health checks, controlled stop on migration failure. Build PASS alone is not runtime PASS.

## 5. Actual execution state

**DONE in this work cycle:** product D1–D3 owner confirmation; read-only GitHub current main/draft PR check; source/migration path review; Neon **read-only** schema/aggregate census (20 schema versions, 311/108/110/57/1 counts noted above); documented proposed columns/gates and source limitations.

**NOT RUN:** M2 SQL or migration creation/registration, independent M2 reviewer response, isolated PostgreSQL test, project Node24 full tests/typecheck/build, Vercel production DB identity test, original SIX official XML verification, merge, rollout or deploy. `main` remains 3.7.0, schema v20; draft code PRs #320/#321 remain unmerged. **M2-A design is not approved as implementation contract.**
