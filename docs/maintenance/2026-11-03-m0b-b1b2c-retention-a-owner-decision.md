# M0-B B1b.2c — owner decision: finite Trash identity retention A

**Decision date:** 2026-11-03T07:49:06.338Z. **Repository:** `filipto861/flytally-logbook`. **Canonical main at decision:** `c9c2f60303236113a223942072311f5e37f876f7`. **Base:** Draft PR #462 at `5fd3a4e36c02a7d27be0e6816ada5a5016e492f5`. **Owner explicitly said “dobre tak souhlasim”** in response to the proposal to adopt option A as design direction, with 90-day Trash, a **proposed** 12-month minimal UID reservation, and legal/privacy assessment before any production implementation. No DeepSeek or other external AI review requested. Neither migration nor deployment approved.

## Status and decision precision

- **APPROVED — product/engineering direction:** A instead of B. Avoid permanent retention of full deleted-flight content merely to preserve event identity. Treat unknown/erased source provenance as UNAVAILABLE for full-account Restore.
- **WORKING DESIGN PARAMETER, NOT FINAL LAWFUL RETENTION:** Keep only a minimum owner-scoped event identity claim for **12 calendar months after the existing stored `deleted_flights.purge_after` cutoff**. This defines a concrete isolated test target, **not** a verified legal basis or irrevocable right to retain personal data. Legal/privacy assessment may shorten/remove this interval and must address right of erasure and regulatory/audit exceptions before shipment.
- **NOT APPROVED:** V22 DDL/migration, enabling full Restore, altering current production Trash cleanup, indefinite UID preservation, automated source-trust promotion, changes to certified Void/archived regulatory evidence, production DB operations, merge, deploy, production feature flags, or Training changes.

## Time model and minimum retained data

1. Existing application schema has `deleted_flights.purge_after = deleted_at + 90 days` by default (`lib/db-optimization.ts:88–92`). Respect the actual persisted `purge_after` value rather than reconstruct it from a guessed deletion date.
2. **Before** the stored `purge_after`: ordinary eligible draft single-flight Trash Restore remains available; signed/certified history restrictions unchanged.
3. **At or after** `purge_after`: delete expired Trash `flight_data`, `tracks_data`, `expenses_data` and all related archived payload in the **same transaction** that moves the corresponding valid owner/kind/event UID registry record from `trash` to `purged`. The two existing deletion paths (`lib/flight-trash.ts:11` user listing and `lib/privacy-account.ts:48` retention sweep) must be reconciled to one owner-safe transaction contract; deploying a strict trigger without migrating these entrypoints would break cleanup.
4. For successfully transitioned and verifiably owned events, set the marker expiry to **`purge_after + INTERVAL '12 months'`**. **Do not extend the marker lifetime because a sweep or UI visit happened late**. Exact boundary is a UTC timestamptz instant with PostgreSQL calendar-month arithmetic, not an approximate 365-day interval.
5. Minimal candidate marker fields: owner-scoped account key, `event_kind`, immutable `event_uid`, lifecycle state `purged`, original Trash cutoff and marker expiry. **No** registration, date of flight, aircraft, route, GPS, financial rows, free text, old source database numeric ID, file name, copied source signature or original backup payload. The marker **may still be personal data** because it links to an account; access controls, purpose, duration and erasure must be reviewed.
6. **At or after marker expiry:** delete the minimal marker unless a separately verified legal retention basis applies. After expiration, no claim of automatic deduplication survives; a later full-account Restore without independently verified issuer/provenance must fail closed. A new random UID assigned to an old legacy Trash recovery is NOT proof of the original account's source event.
7. **Account erasure:** model deletion of the owner-linked minimal markers during the existing erasure transaction unless specifically documented legal evidence demands a separate retention exception. Do not delete or silently transfer other participants' independently owned regulatory evidence, immutable Void history or audit data. The erasure workflow itself is not redesigned by this approval.
8. **Certified Void and protected audit:** distinct regulatory/audit lifecycle, not ordinary 90-day Trash. Do not apply the new Trash purge TTL to their records or alter signed revisions.

## Invariants before runtime implementation

- Database-level uniqueness `(owner_id,event_kind,event_uid)` and immutable owner binding; no fingerprint-as-key or inferred source identity.
- Single transaction: fresh owner/child state check, defined first-lock order, move `trash→purged`, delete payload; failures leave previous state and data intact. Old **direct** purge SQL must not be left installed after a strict registry trigger goes live.
- Duplicate normal event IDs are rejected while a marker exists. **After its deletion a database cannot prove the deleted identity existed**; restoration logic must report UNAVAILABLE on untrusted historical input, never claim to deduplicate an unknown erased event.
- Privacy erasure is an independently authorized operation; a mere session-controlled flag is not sufficient DB authorization. Non-cooperating SQL writers and privileges need tests.
- All active/legacy flight/FSTD user-scoped FKs, signed corrections, source/participant provenance and native audit must retain their current semantics. Missing `event_uid` is never automatically treated as verified or zero.

## Isolated proof / acceptance scope

- Dedicated test-only executable `tooling/m0b-b1b2c-retention-a-window-probe.mjs` uses the already published owned-local PG16 target guard, synthetic data and a random disposable schema.
- Required outcomes: no deletion before 90-day boundary; payload deletion/registry state at cutoff; marker deadline fixed to cutoff+12 calendar months; same-account UID collision while marker retained; no marker removal before deadline; deletion at the exact deadline; per-owner modeled account-erasure isolation; and legacy NULL-UID expiry without invented origin.
- **Important limit:** this fixture is an engineering demonstration, **not** full real-schema, PostgreSQL privilege/authorization, actual Neon HTTP, production privacy compliance, V14 issuer-signature or complete flight writer proof.
- Current source-controlled `DATABASE_SCHEMA_VERSION=21` must remain unchanged; future V22 schema-first work requires explicit owner authorization and per-environment target verification, never automatic runtime application.

## One next step

Finish exact-source disposable PG16 retention-A boundary verification, then design a **schema-first, explicitly gated V22 candidate and erasure/privilege acceptance plan** without changing application runtime or production; legal/privacy review remains a release blocker. No DeepSeek review.
