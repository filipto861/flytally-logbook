# Independent review — FlyTally Logbook 3.8.0 Currency (read-only)

**To:** DeepSeek or Claude (independent architecture/data reviewer). **Do not implement or modify anything.**  
**Repository:** `filipto861/flytally-logbook`; **NO** `flytally-training` changes.  
**Canonical baseline:** `main@4ca2847795435549f36d44f253eb7c105eea6d25` (11 Oct 2026).  
**Candidate:** `docs/v380-currency-m0-discovery`; [draft PR #319](https://github.com/filipto861/flytally-logbook/pull/319).  
**Source document:** [3.8.0 M0 inventory/design gates](3_8_0_CURRENCY_MONETARY_SEMANTICS.md).  
**Product:** 3.7.0 released; 3.8.0 M0 documentation/discovery only; no runtime/migration/FX approved.

## Goal

Challenge the M0 inventory and the *proposed* domain contract **before** any currency-affecting code, migration or historical backfill. The owner must approve behavior and classification choices. Do not mistake the present UI label for historical denomination evidence.

## Read-only findings to independently verify

- Account `user_settings.currency` is editable from Settings (CZK/EUR/USD/GBP); current save actions persist it.
- `flights.price_per_hour`, `rates.price_per_hour`/`dry_price_per_hour`, and `aircraft.default_price_per_hour` carry no denomination in current Logbook schema. Relevant types are `double precision`, not integer minor units.
- `flight_expenses` stores integer minor units plus 3-letter currency (current parser uses 2 decimals).
- `lib/flight-expenses.ts` silently classifies calculated aircraft cost as CZK and rounds before combining totals.
- Flight list/Statistics/Dashboard aggregate or sort numeric costs as if one shared currency; Aircraft Manager labels rates CZK/h.
- Share snapshots (`lib/aircraft-sharing.ts`) transport rates without currency; backup v13 exports raw rows and legacy restore writes currencyless prices. Any new fields must consider certified/voided/archive recovery and historical backup compatibility.
- Connected Neon `Logbook Shadow` primary branch named `production` was inspected with metadata and SELECT-only aggregate queries: 311/311 flights with positive stored price, 33/33 rate rows with positive price, 20/25 aircraft with positive defaults, 0 expense rows, and 5/5 settings currently CZK. **Vercel deployment-to-database connection identity NOT VERIFIED.** These 5 current preferences do NOT establish historical currency evidence.

## Proposed contract to challenge (NOT FROZEN)

1. Account currency is only a **default for new monetary input**, never a retroactive converter.
2. Each newly saved aircraft/default/hourly rate and flight's captured rate includes an explicit denomination; the snapshot is stable if current account/profile currency changes.
3. Expense rows retain their individually supplied currency. Mixed-currency arithmetic, cost ranking and derived metrics must not silently sum or compare. Unknown price currency is distinct from zero/not tracked.
4. Existing legacy price numbers remain intact and `UNKNOWN` until owner-authorized, auditable classification based on reviewed source evidence. No auto-CZK backfill solely from UI labels or present-day preferences.
5. Use additive, nullable columns and rigorously verified local PostgreSQL migrations/rollback and server-side tenancy; backup/restore and sharing compatibility are prerequisites, not optional polish.
6. Domain-calculation provenance, UI clarity, rounding/precision, old backup versions and auditability have equal priority to convenience.

## Questions — answer with source-backed alternatives

1. Is the proposed **account-default + per-rate + per-flight-snapshot** authority model correct? What is the minimal set of persisted fields to prevent mutable-profile leakage? Does the same rate currency safely govern dry and wet rate?
2. What fail-closed behavior is appropriate for 311 existing positive-price flight rows and known historical rate rows without denomination? Should an explicit user attestation exist; how to prevent silent bulk relabeling and ensure audit/rollback?
3. Are current `double precision` rates and `expenseTotals` rounding safe enough for this milestone, or should a reviewed `NUMERIC`/minor-unit strategy be part of M2? How to avoid loss on historical read/write and rates with cent fractions?
4. Must we limit currency choices to explicit supported 2-decimal ISO currencies initially? How would currencies with 0 or 3 minor digits be represented without falsifying amounts?
5. What is the minimal safe design for Dashboard/Statistics/flight-list cost sorting and analytics when known currencies differ or legacy unknowns exist? Where must unknown be visible separately from zeros?
6. Where do backup v13, canonical restore, **legacy** restore, aircraft share snapshots, certified/voided histories and privacy filters require schema or format version gates? Which tests must precede a release?
7. Which code paths/schema tables are absent from the inventory? Check source paths and regression suites on the current main; GitHub code-search indexing was unavailable to the lead.
8. Any migration/certification/auth/performance regressions or reversible rollout concerns that warrant splitting M2–M5 differently?

## Constraints / Do-Not

- **Read-only review only**; no PR changes, write SQL, deployment, feature flags, FX provider, live conversion or destructive test execution.
- Preserve source data and typed null/unknown semantics; no "missing = zero"; no retroactive denomination from account preferences.
- Don't change Flight Entry regulatory evidence or certified revision fingerprints as an incidental financial feature.
- Training, maps and external-provider work are out of scope.

## Requested response

1. Verdict: `APPROVE` / `APPROVE WITH CHANGES` / `BLOCK`.
2. Severity-ordered findings: exact file/source reference, observed fact vs hypothesis, smallest correction and acceptance test.
3. D1–D4 owner decision options with recommended default and explicit trade-offs.
4. Final frozen proposal suitable for phased implementation only **after** lead reconciliation and owner acceptance.
5. Mark any uninspected parts `NOT VERIFIED`, tests/build/PostgreSQL/browser `NOT RUN`, and do not assert authority approvals.
