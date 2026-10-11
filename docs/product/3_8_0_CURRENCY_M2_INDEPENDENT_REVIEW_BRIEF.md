# Independent read-only architecture review — FlyTally Logbook 3.8.0 M2 monetary schema

**Reviewer:** DeepSeek (or Claude), independent read-only review. **Do not implement, edit Git/DB, approve production, or reinterpret owner D1–D4.**

## Current actual state

- Repo: `filipto861/flytally-logbook`. Verified `main@4ca2847795435549f36d44f253eb7c105eea6d25`, shipped package 3.7.0. Draft docs PR #319, exact arithmetic draft PR #320, nested ISO monetary registry draft PR #321 (all open/unmerged). No version bump, merge, schema/production change.
- **Owner product scope D1–D4 is frozen**: [record](3_8_0_CURRENCY_OWNER_DECISIONS_2026-10-11.md). D1 Settings default for new money and per-rate override; D2 unresolved legacy until audited owner attestation; D3 no cross-denomination sum or global price sort; D4 all current genuine monetary ISO 4217 currencies/authoritative minor units, no FX.
- **Source-based M2 draft:** [additive migration technical proposal](3_8_0_CURRENCY_M2_SCHEMA_DESIGN.md). It is a **review candidate**, not approved SQL or accepted rounding policy. Consult [M0 inventory](3_8_0_CURRENCY_MONETARY_SEMANTICS.md), [DeepSeek first reconciliation](3_8_0_CURRENCY_REVIEW_RECONCILIATION.md) and [registry source gate](3_8_0_CURRENCY_M1_ISO_REGISTRY.md).
- Canonical migration engine: `lib/migration-plan.ts` (declares v20) and `lib/db-optimization.ts` (`ensureDatabaseOptimizations` **automatically applies missing migrations** through SQL transactions during runtime). **Do not register v21** until approved local PG tests and exact environment target check.
- Source tables on connected Neon *Logbook Shadow* branch `br-dark-math-b1snjzub`: 20 applied migration records, 311 flights, 108 certified, 110 locked, 57 certified revision rows, one void tombstone, zero expenses and zero NULL effective-date rates. Production Vercel binding **NOT VERIFIED**. This is read-only source evidence from one branch, not authorization to change it.
- Financial storage today: `flights.price_per_hour`, `rates.price_per_hour/dry_price_per_hour`, `aircraft.default_price_per_hour` are nullable `double precision` without currency; `user_settings.currency` is a mutable default; `flight_expenses.amount_minor BIGINT` + alpha-3 `currency` assumes 2 decimals in legacy parser.
- Protected-history paths: `lib/certification-integrity.ts`, `lib/db-optimization.ts` v20 `logbook_protect_locked_flight`, `lib/account-backup.ts` (portable v13), `lib/account-restore-v6.ts`, `lib/flight-trash.ts`, `lib/aircraft-sharing.ts`, `app/(protected)/connections/aircraft-share-actions.ts`, `app/(protected)/flights/actions.ts`, `app/(protected)/database/actions.ts`.

## Target for review

Proposed **M2-A** is purely additive nullable monetary columns on flights, rates, aircraft and a nullable `flight_expenses.amount_minor_units`; legacy numbers untouched, existing old readers/writers unchanged, no account-default backfill. Exact new rate numeric representation (e.g. `NUMERIC(22,8)`) and wet/dry currency shape are **proposals, not frozen technical choices**. D2 append-only attestation is a **separate M2-B** path. Backup/trash/share write/read paths must be adapted in later milestones with migration ordering. Source authority for the mirrored ISO registry remains direct-SIX-XML **NOT VERIFIED**.

## Review questions — prioritize blockers

1. Is an **additive-only v21** safe in this auto-migrate-on-init architecture, especially with `SELECT *`, triggers using `to_jsonb(OLD)`, certified-flight correction/void snapshot JSON, and v13 signed portable backup+restore?
2. What exact monetary storage/precision is defensible for new rates and calculations (e.g. `NUMERIC(22,8)` vs `NUMERIC` vs decimal string) without corrupting historical double values? Identify quantization, rounding, `bigint` JSON/API and constraint risks with source proof.
3. Should wet/dry rates **share one currency** or persist separately? Identify actual present product semantics and required compatibility.
4. What failsafe **dual-read / dual-write / rollback** allows current runtime on additive schema and future runtime after exact-value writes, retaining denomination metadata on fallback?
5. Can a currency+exponent nullable column pair represent future known/unavailable/unknown/not-tracked states without conflating missing amounts with numeric zero? Which `CHECK` constraints should be DB-enforced vs versioned ISO registry validated server-side?
6. How to preserve **legacy expenses** stored using two-decimal parser, especially past JPY/KWD, when introducing per-currency scale? Is `amount_minor_units NULL` a sufficient backward-compatibility marker?
7. Propose auditable, **append-only owner attestation** for legacy flight/rate monetary value, tied to revision/void tombstone and original amount fingerprint, with no UPDATE to protected flight/archive. How to handle revocation, user scoping, concurrency and restore?
8. Which existing manual/GPS/new/edit, sharing upsert and trash restore paths are missing from M2 draft, and what breakage could arise from `COALESCE(rate.price_per_hour, aircraft.default_price_per_hour)` detaching currency from amount?
9. What minimal **isolated local PostgreSQL test matrix and release sequence** must precede registering v21 and invoking auto-migration, including legacy v13 signed backup, certified corrections, void archives, repeated migration and rollback after first new writes?
10. Identify any hidden **production database target risks**; Vercel deployment binding is unverified and no remote SQL/credentials are authorized.

## Reviewer response contract

Return **APPROVE / APPROVE WITH CHANGES / BLOCK**, severity-ranked findings with path/line and specific supporting repo/schema evidence. Separate (a) verified runtime/schema facts, (b) technical choices needing design, (c) unverified ISO-source/production binding, (d) required tests. Suggest the **smallest safe M2-A milestone** and explicit DO/DO NOT. **Read-only:** do not edit the repository, merge PRs, execute DB writes, run remote migrations or deploy. Do not claim Node24/CI/PG/production PASS without actual exact-head evidence. The owner decides product scope, not the reviewer.
