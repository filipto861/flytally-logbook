# M0-B B1b.2c — source-schema compatibility and retention boundary (DESIGN ONLY)

> **OWNER DECISION UPDATE — 2026-11-03 (supersedes earlier “A/B OPEN” in this dated analysis):** option **A** accepted as design direction, **90-day Trash** and **working additional 12 calendar months** for a minimal owner-linked event UID marker measured from `purge_after`; legal/privacy retention and erasure assessment remains a mandatory release gate. See [decision](2026-11-03-m0b-b1b2c-retention-a-owner-decision.md). [Isolated test #41598681099](https://github.com/filipto861/flytally-logbook/actions/runs/41598681099) at executable source `f18e873aa549160e0ee876fb1d825d28ca3a2131`: PG16.15 **8/8 PASS**; no V22 production migration or release authorization.


> **New isolated test evidence (2026-11-03):** [GitHub Actions #41596162456](https://github.com/filipto861/flytally-logbook/actions/runs/41596162456) at exact executable SHA `a966ee5805a120f52d5707183a5667a5e2c71b53` on disposable PG16.15: safe-target **7/7** and synthetic real-shaped nullable UID/FK/Trash variant tests **7/7 PASS**. Source shape remains unverified against live DB; test **does not** approve A or B retention. See [checkpoint](2026-11-03-m0b-b1b2c-v22-compatibility-retention-checkpoint.md).


**Date:** 2026-11-03 UTC. **Repo:** `filipto861/flytally-logbook`. Verified `main@c9c2f60303236113a223942072311f5e37f876f7`; examined stacked Draft #461 `b852114307b37dd6f17442a430bdfb6bee2af0b6` (base #460, ancestors #459–#455; B0 #454 separate). Owner requires continuation **without DeepSeek**. No production database connection, SQL, schema migration, runtime change, merge, deploy or flag adjustment.

## Authority and evidence

This is a proposed **compatibility/retention decision document**, not an approved V22 schema, live catalog verification, application implementation or test result. Its source facts come from the actual `lib/db-optimization.ts`, `lib/v159-schema.ts`, `lib/flight-sharing.ts`, `lib/flight-trash.ts`, `lib/privacy-account.ts`, `lib/migration-plan.ts`, and relevant writer services at the exact Draft #461 HEAD. Earlier PG16 synthetic tests [lock 4/4](https://github.com/filipto861/flytally-logbook/actions/runs/41592224174) and [lifecycle 7/7](https://github.com/filipto861/flytally-logbook/actions/runs/41594393542) demonstrate isolated toy-table mechanics **only on their prior exact tested SHAs**. Real application schema/backfill/retention/Neon HTTP parity not tested.

## Actual source-defined owner/FK matrix — not every table is equivalent

| Relation | Explicit source declaration | Design implication |
| --- | --- | --- |
| `flights` | Composite `UNIQUE(id,user_id)` in `lib/v159-schema.ts:20` and `lib/db-optimization.ts:454`. | Numeric PK remains local storage identity, not transportable/source issuer identity. |
| `flight_expenses` | Composite FK `(flight_id,user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE` in `v159-schema.ts:21–30`. | Preserve owner-qualified child FK. |
| `flight_connected_crew` | Composite **source** FK `(source_flight_id,source_user_id)` in `db-optimization.ts:470–480`; connected user separate. | A source event relationship crosses two users; do not grant independent recipient credit. |
| `flight_public_shares` | Composite FK `(flight_id,user_id)` in `flight-sharing.ts:11`; token revoked separately. | Token is authorization state, not event issuer proof. |
| `flight_source_provenance` | Composite **participant-copy** FK `(participant_flight_id,participant_user_id)` in `db-optimization.ts:632–649`; source reference is `(source_flight_id,source_user_id,source_revision,source_hash)`, optional source Void archive ID. | Do not add unconditional FK to an active source row that can legally be voided; immutable origin may outlive it. |
| `flight_participations` | `source_flight_id REFERENCES flights(id)`, `participant_flight_id REFERENCES flights(id) ON DELETE SET NULL` with separate source/participant user IDs (`db-optimization.ts:369–381`). | Source schema does **not** declare composite owner FKs for these numeric references. Cross-owner authorization needs explicit validation. |
| `flight_verifications` | `flight_id REFERENCES flights(id)`, separate `flight_user_id`, `signer_user_id` and signed revision/hash (`db-optimization.ts:426–435`). | Cannot rebind a signature by matching a numeric ID or heuristic fingerprint. |
| `instructor_flight_approvals` | `flight_id REFERENCES flights(id)`, distinct student/instructor IDs (`db-optimization.ts:353–364`). | Not a composite owner FK; preserve signer/owner roles. |
| `flight_certified_revisions` | `(user_id,flight_id,revision_number)` UNIQUE, **no parent FK in this CREATE TABLE** (`db-optimization.ts:196–209`). | Do not add a cascade to active flight; historical certified revision must not be deleted accidentally. |
| `fstd_sessions` | `id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL`, signed/certified fields and trigger, **no composite `(id,user_id)` UNIQUE declared here** (`db-optimization.ts:162–177`). | Must not assume FSTD has the same owner FK foundation as flights. |
| `fstd_certified_revisions` | `(user_id,fstd_session_id,revision_number)` UNIQUE, **no parent FK in CREATE TABLE** (`db-optimization.ts:254–267`). | Corrected FSTD revisions require own protected linkage. |
| `deleted_flights` | Historical `original_flight_id`, JSONB snapshots, `purge_after DEFAULT NOW() + INTERVAL '90 days'`; no active FK (parent was deleted), `db-optimization.ts:88–94`. | A snapshot's numeric original ID is not durable event identity; older archives have no authenticated V22 UID. |
| `voided_certified_flights` | `(user_id,original_flight_id)` UNIQUE, immutable archives with source revision/hash/snapshot; existing same-transaction and deferred exclusion triggers (`db-optimization.ts:567–586,720–793`). | Preserve archival source numbers and signed hash. Never automatically resurrect active flight or replace current void protections. |
| `flight_audit_log` | Local `flight_id` and `user_id` in native AFTER flight DML trigger; **no active parent FK in CREATE TABLE** (`db-optimization.ts:39–78`). | No cascade from active row; imported history must be distinct/append-only in B2. |

**Scope of negative claims:** “No FK declared in inspected CREATE TABLE” does **not** prove its absence in an actual deployed database. Other legacy migrations and physical `pg_catalog` may differ. Production catalog/roles/flags are UNKNOWN; do not infer production readiness.

## Trash retention conflict, now found in TWO actual writer paths

1. Schema default is a 90-day Trash expiry (`db-optimization.ts:88–94`).
2. Background/account privacy sweep runs `DELETE FROM deleted_flights WHERE purge_after<=NOW()` (`lib/privacy-account.ts:44–52`).
3. **User-facing Trash listing also deletes expired records on read**, scoped to that user (`lib/flight-trash.ts:11`).
4. Single-flight Trash recovery checks `restored_at IS NULL AND purge_after>NOW()` and rematerializes a **different local flight row ID** (`lib/flight-trash.ts:88–94,229–251`).
5. `lib/privacy-account.ts:55–90` includes account-erasure changes and cross-account evidence status updates. A new UID retention policy cannot be assumed to outlive an erasure request; potential owner-linked UUID data may remain personal data.

The existing synthetic lifecycle prototype enforces one `active`, `trash` or `voided` row at transaction commit. It would **REJECT** a 90-day Trash payload purge while the registry remains `trash`. Porting that trigger into application schema would break both existing cleanup paths. Therefore **no migration V22 is safe yet**.

## V22 additive contract candidate (NOT FROZEN, NO SQL EXECUTED)

- Preserve all existing numeric IDs, certified revision/history, native audit, void immutable archive, composite FKs and source/participant roles. Do not rewrite historic signed JSON/hashes or invent issuer identity.
- Suggested expansion only: *nullable* `event_uid UUID` on `flights` and `fstd_sessions`; per-owner **partial UNIQUE** `(user_id,event_uid) WHERE event_uid IS NOT NULL` (separately per parent table). This must not be backfilled as trusted identity, and old writers must remain compatible. No natural-key/fingerprint UNIQUE.
- Future `event_identity_registry(owner_id,kind,event_uid,life_state,trust_state,...)` may distinguish `locally_issued`, `legacy_local_unproven`, and `verified_import` after a separate V14 issuer/account-continuity contract. These labels are **proposals**, not current schema or proof. Native participant copy gets its own event UID, never the source event's UID.
- Candidate state transitions: `active -> trash -> active` and `active -> voided`; `voided -> active` forbidden. Legacy Trash without verified UID could receive a *new local* UID on an approved recovered event with a distinct **unproven legacy source** record, not assertion of source event equality.
- A per-owner/event lock must be **the first separate transaction statement**, before row/child locks and mutation predicates; post-lock evidence read must be a later READ COMMITTED statement. Acquire multiple affected account scopes in deterministic order. Database uniqueness/owner constraints, not row-trigger-only gates or advisory locks, must protect noncooperating writers. Previous isolated PG16 test reproduced inverted account/row deadlock.
- **Do not** simply bump `DATABASE_SCHEMA_VERSION=21`: runtime `ensureDatabaseOptimizations()` applies pending versions; its V21 exception is explicitly gated in `lib/db-optimization.ts:1078–1096`. V22 requires separately approved environment-scoped migration/activation and old-app/new-schema compatibility tests.

## Retention decision required before lifecycle DDL

| Candidate | Expired Trash handling | Safety trade-off |
| --- | --- | --- |
| **A: purge payload, retain minimal scoped identity marker** | Atomically remove Trash JSON/GPS/expenses, set identity state to `purged`, store only a limited owner/UID claim under an explicitly approved finite retention+erasure policy. | Prevents silent duplicate resurrection during claim validity, but `(owner_id, UID)` remains linkable and can be personal data. Legal basis, duration and account-erasure semantics are OPEN. |
| **B: purge payload AND identity marker** | No historical owner/UID reservation remains; full-account Restore for ambiguous erased/expired lineage must be **UNAVAILABLE** unless independent trusted issuer proof and separately approved policy permits it. | Preserves data minimization but no guarantee of replay/idempotency after metadata erasure. |
| **C: keep all Trash snapshots indefinitely** | Retain every archived flight. | **Reject as default**: contradicts existing 90-day purge and silently expands potentially sensitive data retention. |

**Engineering preference for the NEXT TEST ONLY:** implement isolated A/B simulations in a disposable PostgreSQL16 namespace; do not adopt either as production policy. If provenance is absent, malformed, legacy or erased, fail closed. Certified Void archives are **not** ordinary expiring Trash and have separate audit/privacy rules.

## Real-schema-equivalent acceptance before any V22 application proposal

1. Build a **positive-identity disposable PG16** clone that includes existing relevant FK shapes, native audit, certified revision, source participation/void and BOTH Trash expiry writers. Compare `pg_constraint`, `pg_index`, `pg_trigger` to actual source definitions; verify any detected mismatch rather than silently fixing fixtures.
2. Assert old rows with `NULL event_uid` can still be updated by legacy writers; new owner-bound UUID collisions reject noncooperating inserts; cross-owner and duplicate heuristic fingerprint are distinguished; FSTD certification revision remains intact.
3. Compare A/B expiry (both listing and privacy sweep), single-flight Trash recovery and owner account erase. Never retain owner-linked UID indefinitely by default. Verify correct rollback, no native audit rewrite and no unintended source/provenance cascading.
4. Test unrelated pilots' writes during full restored event reservation, plus strict lock order for Create/Edit/FSTD/Trash/Void/shared; no global table locks.
5. Test signed coherent V14 issuer (separate B2) and actual Neon HTTP fixed-batch semantics on a **separately owned isolated endpoint** before any runtime Restore. This has **NOT RUN**.
6. Require additive migration plan with *explicit owner permission* for target/schema activation; current `main` and production remain M0-A. No merge or deployment inferred.

## Current evidence ledger

**Current work:** source-only design. New V22 SQL/actual PG16 real-schema compatibility/Neon HTTP/Node build/Playwright/production smoke: **NOT RUN**. Historic synthetic PG16 PASS is **not** transferred to this design. Source code map is **PARTIAL** relative to actual physical catalog. Production Vercel `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY, app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; production DB/schema/flags UNKNOWN. No DeepSeek review by owner decision.

**ONE NEXT STEP:** model A/B Trash purge and legacy FSTD/owner FK compatibility in a new test-only disposable PG16 experiment, then present retention policy consequences for an owner decision before any V22 migration.
