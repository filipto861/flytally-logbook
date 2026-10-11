# FlyTally Logbook 3.8.0 — Currency / monetary semantics

**Status:** ACTIVE / M0 source discovery and M1 preparation; DeepSeek review **RECONCILED**, **owner D1–D4 currency product decisions APPROVED 11 October 2026**; [frozen decisions](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md) and [M2 additive schema proposal](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md). [M1 Batch 1 isolated exact arithmetic implementation](3_8_0_CURRENCY_M1_CORE_IMPLEMENTATION.md) in draft PR #320 and [M1 Batch 2 ISO 4217 candidate registry](3_8_0_CURRENCY_M1_ISO_REGISTRY.md) in nested draft PR #321 are **UNMERGED/NOT IN APP RUNTIME**; original SIX XML byte verification pending; full design NOT APPROVED.  
**Baseline:** `filipto861/flytally-logbook` `main@4ca2847795435549f36d44f253eb7c105eea6d25` (11 October 2026).  
**Issue:** [#136](https://github.com/filipto861/flytally-logbook/issues/136).  
**Product baseline:** 3.7.0 DONE/PRODUCTION. **Repo boundary:** Logbook only; no Training changes.

## Objective and hard boundaries

A monetary value must carry a known, persisted denomination before being displayed, aggregated, sorted against other amounts or transferred to another user. Do not convert amounts merely because a pilot changes the Settings currency. Do not silently relabel legacy numbers or infer a historical currency from a **mutable present-day** setting. No automatic FX, no speculative exchange rate and no destructive rewrite of financial evidence.

**Existing behavior is not yet the target contract.** The following inventory records implementation facts and candidate risks, not a claim that the application is already multi-currency-correct.

## M0 actual-source inventory

| Data/surface | Observed on main | Risk / decision required |
| --- | --- | --- |
| `user_settings.currency`; Settings | `app/(protected)/profile/page.tsx` exposes CZK/EUR/USD/GBP; `profile/actions.ts` stores the value. | Setting is not an authoritative denomination on historical rates or flights. Decide whether this is a **new-entry default only**, with strict validation. |
| `aircraft.default_price_per_hour` | `lib/data/database.ts`, `app/(protected)/database/actions.ts`, `components/aircraft-manager.tsx` read/write a numeric price; UI labels CZK/h. | Persisted rate has no per-value currency evidence. |
| `rates.price_per_hour`, `rates.dry_price_per_hour` | `lib/rate-history.ts` selects dates; `app/(protected)/database/actions.ts` stores rates; `components/aircraft-manager.tsx` labels CZK/h. | Rate history needs effective-date-preserving denomination and valid fallback rules; cannot use current account currency for old rows. |
| `flights.price_per_hour` | `app/(protected)/flights/actions.ts` snapshots a date-effective aircraft rate on save; edit can preserve the snapshot. | Every flight price must keep its historical denomination, independently of future aircraft rate/profile/account changes. Certified record boundary must be checked before adding columns. |
| `flight_expenses.amount_minor`, `flight_expenses.currency` | `lib/flight-expenses.ts`, `lib/v159-schema.ts` and database migration 14 record a 3-letter currency alongside integer minor units; expense rows are user-owned financial metadata outside the certified fingerprint. | Preserve known denominations. Do not combine different currencies; do not change expense amount or certification meaning. Validate invalid persisted strings fail closed. |
| `expenseTotals` / personal costs | `lib/flight-expenses.ts` injects derived aircraft cost as **CZK** and rounds before combining with expense minor units. `components/flight-expenses-editor.tsx` defaults new expenses to CZK. | Hard-coded denomination and rounding are explicit debt. Do not "fix" by substituting current Settings currency for historical aircraft prices. |
| Flight list/detail | `app/(protected)/flights/page.tsx` labels cost CZK; `app/(protected)/flights/[id]/page.tsx` sends derived cost to the expense editor; `lib/data/flights-fast.ts` sorts monetary cost. | Cross-currency ranking and totals are undefined absent FX; unknown denomination must not masquerade as zero or CZK. |
| Dashboard / Statistics | `lib/data/dashboard.ts` and `lib/data/pilot-insights.ts` sum numeric cost values; `app/(protected)/statistics/page.tsx` labels results CZK. | Preserve current performance characteristics while making grouping/filtering and unknown states explicit. |
| Aircraft sharing | `lib/aircraft-sharing.ts` parses `currentRate` and `rateHistory` without currency in the snapshot contract. | Preserve denomination through share/import and reject ambiguous monetary writes; historical payloads remain compatible but unresolved. |
| Portable backup / restore | `lib/account-backup.ts` exports raw rows; `lib/portable-backup.ts` validates format **v13**; `app/(protected)/export/actions.ts` supports legacy restore and writes currencyless aircraft/rate/flight amounts. | New format/schema implications must be reviewed. Keep old backups readable without manufacturing currency evidence, including voided/certified archives. |
| Print/export and share privacy | `lib/logbook-print.ts` and export/share paths require an explicit leakage and currency audit before alteration. | Preserve personal-cost privacy; never append monetary details to public sharing implicitly. |

Other money-bearing contexts must be re-checked with a full code search or locally checked-out repository before M1 signoff. Connected GitHub code search returned no indexed matches; this inventory was verified by reading the named live files directly and by tracking changed paths of relevant merged PRs. It is **not** an exhaustive repository-wide grep.

## M0 supplemental database observation — READ ONLY (11 October 2026)

The connected Neon project named **Logbook Shadow**, on its primary/default branch named **production**, was inspected using table-schema metadata and `SELECT`-only aggregate queries. **The environment-to-Vercel production database binding was not independently verified**; therefore these are branch observations, not final production census authority. No account IDs, individual record amounts or user identities are copied here.

| Aggregate / schema fact | Observed on connected branch |
| --- | ---: |
| `flights` rows; rows with positive `price_per_hour` | 311; 311 |
| `rates` rows; positive price or dry price | 33; 33 |
| `aircraft` rows; positive `default_price_per_hour` | 25; 20 |
| `flight_expenses` rows / distinct expense currencies | 0 / 0 |
| `user_settings` rows; missing or malformed `currency` | 5; 0 |
| Selected current settings currency, aggregated | 5 accounts with CZK |

Schema introspection shows `flights.price_per_hour`, `aircraft.default_price_per_hour`, `rates.price_per_hour` and `rates.dry_price_per_hour` are nullable `double precision` **without currency columns**. Expense amounts use `BIGINT amount_minor` and `TEXT currency NOT NULL` with a 3-letter-code CHECK. Settings currency is nullable `TEXT` defaulting to `CZK`.

**Implication:** A live account preference of CZK for all five accounts does **not** prove denomination at the time of the 311 saved flights or 33 rate events. Price decimals currently use floating-point storage, so rounding and a prospective minor-unit/NUMERIC contract require explicit analysis. M0 did **not** perform a data migration, backfill, restore, write query, materialized snapshot, test-fixture mutation, or change to application configuration.

**Independent review:** [read-only review brief](3_8_0_CURRENCY_INDEPENDENT_REVIEW_BRIEF.md) sent; DeepSeek returned **APPROVE WITH CHANGES**. [Source-backed reconciliation and owner decision matrix](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md) completed. **Owner froze D1–D4 on 11 Oct 2026:** account currency default only, explicit per-rate override, unknown legacy amounts pending audited attestation, no mixed/unknown-cost price sorting or cross-currency sums, and full active monetary ISO currency coverage. Exact schema/rounding/attestation design remains pending; this is NOT an approved migration or integrated runtime contract.

## M0 unknowns (no guessing)

1. **Production census partially observed, NOT FINAL:** connected Logbook Shadow branch aggregate is recorded above; verify deployed Vercel database binding before asserting production authority. Break down historical amounts by creation era and path only with privacy-safe aggregate queries; do not copy PII or raw user monetary records into handoffs.
2. **Source evidence for historical CZK:** existing UI labels CZK but code labels alone do not justify an unqualified production-wide historical backfill. Require documented provenance, owner policy and a reversible/auditable strategy.
3. **Column and backup compatibility:** DeepSeek's hypothesized lack of dated-rate uniqueness was corrected: connected Neon has `UNIQUE (user_id, registration, valid_from)`, with 0 NULL-date rows in its read-only census; NULL-date duplicates remain a possible legacy edge under standard UNIQUE semantics. Exact DDL, dependent SQL projections, certified/voided archives, legacy restore, aircraft import, and migration sequence still require full local audit before choosing a backup version bump.
4. **Currency precision/validation — D4 owner-approved coverage:** all active **monetary** ISO 4217 currencies (not every ISO 4217 fund, test, metal or non-currency code), including all published applicable minor-unit exponents; current expense implementation assumes 2 decimals and accepts any 3 letters. Before writing code, ingest and verify SIX List One + amendments and reviewed monetary classification/precision; preserve historical codes and their scale without using mutable present-day reference data. Detailed contract: [reconciliation D4](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md#owner-decision-d4--approved-11-october-2026).
5. **Visual/client workflow:** changes need targeted desktop/iPad portrait/landscape/mobile + light/dark acceptance, including Settings, Aircraft rates, New/Edit/GPS, locked flight expense editor, list, Dashboard and Statistics.
6. **Operational census and backup dry run:** not performed; production/remote databases must not be targeted by destructive test commands.

## Owner-approved product contract — technical implementation requires further review

**Approved product direction (D1–D4 frozen):** See the [independent review reconciliation](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md) for material corrections: certified rows cannot simply be UPDATEd, historical floating-point conversion is not automatically lossless, backup forward-compatibility is not promised, and currently suggested expense currencies include CHF/PLN. Settings currency is a *default for new* monetary entries, not a conversion control. Each newly entered aircraft rate, default rate and derived flight snapshot persists a valid denomination; per-expense currency remains independently editable. Existing known currencies are immutable evidence. A legacy price with no verifiable denomination remains `UNKNOWN`/`Needs configuration` until an authorized, auditable classification; changing account currency never backfills it. Aggregates are grouped by known currency, with unknown-denomination amounts shown separately as unresolved; no cross-currency sum, comparison, highest-cost ranking or silent FX.

**Owner decisions — ALL APPROVED 11 Oct 2026:**
- **D1:** account preference is the **default for new money only**; per-rate currency override is allowed; saved financial snapshots retain source currency.
- **D2:** legacy denomination without provenance remains unresolved; owner may later attest explicitly and auditably, without mutating certified or voided evidence.
- **D3:** ambiguous global highest-cost ranking is disabled if currencies are mixed or unknown; single known-currency ranking remains valid; no FX or cross-currency sums.
- **D4:** **every active ISO 4217 monetary currency** with the source-backed exponent (including monetary X codes); source registry and technical precision gate not yet verified.
- [Canonical product freeze](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md) has precedence over earlier pending-review wording; exact columns/rounding/attestation and [M2 additive schema design](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md) are **not yet technically frozen**.

## Milestones / dependencies / acceptance

| Milestone | Deliverable | Verification / completion gate |
| --- | --- | --- |
| **M0 — Read-only discovery (ACTIVE)** | Source inventory; identify owner decisions, current code assumptions, backup/schema consumers and production census plan; do not mutate data. | Document is source-backed; inventory completeness and unknowns clear; **no runtime claim**. |
| **M1 — Frozen contract** | Explicit authority matrix for account, default rate, rate timeline, flight snapshot, expense, derived total, archive, share, export/restore; ISO currency source/scale governance; exact mutation semantics; migration design. Independent DeepSeek review reconciled with code. | **D1–D4 PRODUCT APPROVED**, but precision/rounding, historical attestation, source registry parity, compatibility and migration contract/tests remain. |
| **M2 — Schema/additive compatibility** | Reviewed nullable denomination columns as needed; safe idempotent sequential migration; retained legacy unknown values; non-destructive read-only preflight and isolated local PostgreSQL acceptance. | No historical numeric changes; legacy data readable; migration/rollback and remote target protection proven. |
| **M3 — Write and snapshot paths** | Account validation, aircraft/rates, Manual/Edit/GPS and aircraft share imports use explicit persisted denominations; protected flights unchanged unless correction flow allows it. | Direct domain, auth and local PostgreSQL tests for missing/invalid/known money; no saved-rate silent reassignment. |
| **M4 — Read models / UX** | All monetary surfaces derive display from stored denomination, not present-day Settings; grouped totals and explicit unknown states; remove false cross-currency sums/sort. | Unit + SQL + targeted browser/responsive evidence; no N+1/performance regressions. |
| **M5 — Recovery, portability, collaboration** | Portable backup format evolution if needed, strict backward compatibility, canonical and legacy restore, trash/void archives and aircraft sharing currency provenance. | Real isolated restore roundtrip, versioned compatibility and privacy/security tests. |
| **M6 — Release acceptance** | Exact-head risk planner, local verification incl. required PostgreSQL/browser/scale, version 3.8.0 only after gates; docs update; verified deploy/migration/smoke. | No invented PASS, migration, merge or deploy. Last read-only production census and pre/postflight controls documented. |

### DO / DO NOT
- DO use the canonical flight model and existing date-effective rate snapshot; source state and historical snapshots are different authorities.
- DO preserve `undefined` = unchanged, explicit null = clear, supplied value = set when new patch contracts are introduced.
- DO keep certified/voided integrity and personal expenses separate, user-scoped, auditable.
- DO inspect explicit database/schema and backup ownership before introducing columns; keep schema and backup format counters independent of product version.
- DO NOT auto-convert, use today's account preference to relabel yesterday's price, replace unknown with zero, or mix currencies in arithmetic.
- DO NOT modify `flytally-training`, map-provider work, unrelated regulatory logic or production data within M0/M1.

## Evidence / execution log

- **11 Oct 2026:** GitHub connector read `main@4ca2847795435549f36d44f253eb7c105eea6d25`, ROADMAP, FEATURES, ARCHITECTURE, AGENTS, CHANGELOG, issue #136 and the listed runtime/tests. Relevant existing tests: `tests/flight-expenses.test.ts`, `tests/billing-rate-history.test.ts`, `tests/portable-backup.test.ts`.
- **M0 document write:** source/design documentation only. **TypeScript, Node/unit, build, PostgreSQL, Playwright, CI, production smoke: NOT RUN / N/A to this documentation-only change.** No runtime, DB migration, backup format, production or external provider changes.
- **11 Oct 2026 supplementary Neon read-only gate:** inspected primary `production` branch of connected Logbook Shadow project, ran aggregate SELECT and confirmed monetary column types/nullability. No mutation; independent Vercel DB target binding remains NOT VERIFIED.
- **Next:** follow [frozen D1–D4 decision record](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md), verify official SIX XML against [registry candidate](3_8_0_CURRENCY_M1_ISO_REGISTRY.md), run source generator and exact-head Node24 tests for draft [PR #321](https://github.com/filipto861/flytally-logbook/pull/321), complete full source inventory and independent [M2 additive schema design](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md) review. Do not register/execute new migrations before those gates. D4 owner-approved; independent review already reconciled. Do not repeat it without material new evidence.
