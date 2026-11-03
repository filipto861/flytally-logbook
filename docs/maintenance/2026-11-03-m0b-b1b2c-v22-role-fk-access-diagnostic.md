# M0-B B1b.2c — real-declared FK shape, owner role and dual Trash caller test (DRAFT)

**UTC:** 2026-11-03. **Repository:** `filipto861/flytally-logbook`, `main@c9c2f60303236113a223942072311f5e37f876f7`. This work is stacked on Draft #464 `c1876b64fa35325b77895377aeb6b3bd390e612e` (Draft ancestors #463→#455; B0 #454 separate). Owner approved **retention A as design direction only** (existing 90-day Trash, followed by a *working* additional 12-calendar-month minimal owner/kind/event UID marker from stored `purge_after`). The legal/privacy basis, scope and account-erasure exceptions are unapproved release blockers. The owner rejected DeepSeek review; none requested or performed. **No actual app/schema/migration/runtime/Neon/prod SQL changed.**

## Actual source-defined relationships (not a production `pg_catalog` audit)

This fixture mirrors only particular FK shapes actually authored in `lib/db-optimization.ts`, `lib/v159-schema.ts` and `lib/flight-sharing.ts`:

| Relationship | Source definition | Security observation |
| --- | --- | --- |
| `flight_expenses(flight_id,user_id)` → `flights(id,user_id)` | Explicit **composite** owner FK | Database rejects another account's expense child |
| `flight_connected_crew(source_flight_id,source_user_id)` → `flights(id,user_id)` | Explicit **composite** source owner FK | Database rejects a mismatched source owner's crew association |
| `flight_participations(source_flight_id)` → `flights(id)` | **Numeric-only** source FK; source_user_id is separate | **PostgreSQL accepts** a participant row falsely declaring a different `source_user_id`. This is **negative evidence**, not a feature. Server must validate the real source owner before trusting evidence; stronger additive constraints require a separate catalog/legacy migration review |
| `flight_verifications(flight_id)` / `instructor_flight_approvals(flight_id)` | **Numeric-only** parent FKs; pilot/signer/student columns are distinct | Do not infer database owner enforcement. Signed evidence cannot be rebound to a new local numeric ID or re-signed |
| `flight_source_provenance` participant copy | Composite FK for **participant** flight, not unconditional active source FK | Preserve post-void source provenance; do not add a misleading active-source FK that would cascade away signed lineage |
| `fstd_sessions` and `fstd_certified_revisions` | Their CREATE TABLE shapes have no composite active-parent FK | No automatic generalization from `flights` to FSTD |
| `deleted_flights` | Expiring JSONB archive with old `original_flight_id`, `restored_at`, `restored_flight_id` | Recovery keeps archived row until expiry; `restored_flight_id` is **not** in source guaranteed owner/UID FK. New model must independently validate owner + actual active-event UID before deleting a restored archive |

The script creates a **subset** of those tables, including `flight_audit_log`, FSTD sessions and a separate synthetic `voided` marker. It is **not an identical complete production schema**, and does not prove existing production catalog, trigger, row role, source signature, V14 issuer or application authentication.

## Test-only privilege isolation — separate from current app reality

`tooling/m0b-b1b2c-role-fk-privilege-probe.mjs` checks target URL + explicit flag + actual PG16 version/database/role/address, creates a randomized **disposable schema**, then creates four randomized **NOLOGIN test roles** only within the already verified disposable PG16 cluster:
- Pilot A and Pilot B each get `USAGE` on the schema and `EXECUTE` for their own test-only fixed-owner cleanup wrapper. They get **no direct table DML**, no other pilot's cleanup wrapper, no generic owner-target cleanup and no system sweep/privacy erase access.
- Sweep role gets only `EXECUTE` on a test-only owner-sorted bounded sweep wrapper. A regular pilot cannot call it.
- Privacy role gets only `EXECUTE` on the separate minimal `purged` marker erasure wrapper. A pilot cannot call this. In this test that role can choose a target account; **real privacy authorization, erasure scope, legal holds and audit treatment are outside this fixture**.

The test harness uses a privileged PostgreSQL fixture owner to `SET ROLE` for negative access checks; this **emulates privileges**, but **DOES NOT establish that Neon production uses separate per-user SQL roles**. The application currently uses a shared `lib/db.ts` SQL client; production identity, sessions and job credentials require independent source/Neon verification. A PostgreSQL service function accepting `p_owner` alone does **not** authenticate a user, and a user-settable `current_setting` must not be promoted into a trusted issuer.

Both test-only `SECURITY DEFINER` wrappers and the **deferred constraint trigger** need explicit, reviewed privilege boundaries and a pinned `search_path` with schema-qualified table/function names. The first CI attempt showed that leaving the deferred trigger as `SECURITY INVOKER` under the low-privilege pilot role led to **FAIL** at commit when checking the internal identity table; granting unqualified table access to the pilot would be the **wrong fix**. The fixture instead made the protected validation trigger a schema-owner `SECURITY DEFINER` with a pinned search path; that is a design option requiring production privilege/security audit, **not** blanket permission to introduce `SECURITY DEFINER` into app migrations.

**Important**: A per-pilot SQL role and fixed-ID wrapper is a **test device**; creating a PostgreSQL role per user is NOT an approved deployment architecture. A separate decision must specify real Neon HTTP/SQL role separation, trusted server-auth bridge, revocation, SECURITY DEFINER hardening and rollback before any production code.

## Negative/positive behavior proved in isolated PostgreSQL 16.15

- Composite owner FKs reject foreign flight expenses and connected-crew sources.
- Numeric-only `flight_participations` FK permits a deliberately mismatched claimed owner; the fixture detects this discrepancy, does not use it as verified regulatory evidence.
- Pilot NOLOGIN SQL role cannot select/delete raw archive tables, invoke generic owner-target function, execute other pilot's cleanup/sweep, or erase markers; sweep and privacy roles likewise have distinct exposed wrappers.
- Before `purge_after`: pilot cleanup does not delete the archive. At/after: shared per-owner operation removes un-restored archive payload and sets `trash→purged` marker with the **working** `purge_after + INTERVAL '12 months'` cutoff, while separately removing an **already restored** historical archive without changing active event UID.
- System sweep uses the same per-owner cleanup internals in deterministic owner order. Other users' archived data remain until their owner scope is selected. A synthetic `voided` identity, native audit exemplar, FSTD records and owner-independent participant evidence are not swept.
- Deliberately mismatched `restored_flight_id` (other owner's active row) aborts the cleanup transaction and leaves the archive intact; correction to matching `(user_id,event_uid)` allows it.
- Privileged owner-specific removal of minimal `purged` markers does not erase active identities or another user's evidence; ordinary pilot lacks this action.
- Legacy archive with absent UID can expire without fabricating a verified issuer.

**Do not overclaim:** role fixture uses a disposable superuser to seed tables and temporary roles, and two *modeled* server entrypoints. It does not exercise the actual `listDeletedFlights()` / `runPrivacyRetentionSweep()` functions or the production auth flow, transaction semantics of real Neon HTTP, true two-client lock contention, user-account erasure, signed historical data, or any actual V22 migration.

## CI failure history and source-bound evidence

- [Actions #41601813807](https://github.com/filipto861/flytally-logbook/actions/runs/41601813807) **FAIL** at `f8505a70d95d8a3d1151cbdafebe1d094714df59`: Node preflight 7/7, but commit-deferred trigger invoked by low-privilege role lacked SELECT on identity registry. **Finding retained**, not disguised as a PASS.
- [Actions #41601933497](https://github.com/filipto861/flytally-logbook/actions/runs/41601933497) **FAIL** at `bc4c3ca173a1f25cbc91879222ad37a9ff9428b6`: script edit corrupted a PostgreSQL `$...$` function quote, diagnosed and corrected without broadening privileges. Historical failure retained.
- **[Actions #41602112295](https://github.com/filipto861/flytally-logbook/actions/runs/41602112295) SUCCESS** at **exact executable code SHA** `f03a8a2c2bae5b477460f783043bdf79824b86a6`: Node24 `--check` **PASS**, owned disposable-target guard **7/7 PASS**, real PG **16.15 9/9 PASS** including FK negative tests, role privilege boundaries, dual cleanup, spoofed Restore ID failure/rollback and privacy marker separation. Random synthetic schema and test roles removed. No production data touched.

## Separate requirements before deployable V22

1. **Real physical DB catalog:** after explicit approval and positive isolated target verification, gather `pg_constraint`, `pg_trigger`, `pg_index`, migration registry, existing NULL/legacy counts and roles on an **owned disposable clone**, not against production. Source CREATE TABLE shape != installed production schema.
2. **App auth design:** identify canonical `requireUser` + separate authorized retention job entrypoint; prove one identity cannot impersonate another. Decide server-to-DB role/service credential mapping; do not grant raw app users `SECURITY DEFINER` bypasses. Enumerate all writer calls before owner-gate ordering changes.
3. **Additive compatibility:** preserve M0-A and existing v21 runtime, nullable legacy UIDs and signed/native audit. Update **both** direct expired Trash DELETE statements behind a backward-compatible, OFF rollout gate **before** installing strict registry constraints. A restored archive's active identity must remain active.
4. **Real transaction parity:** verify first-statement owner gate + fresh post-lock predicates and rollback via the actual Neon HTTP client and on positively owned test DB; do not assume `SECURITY DEFINER` fixture matches SQL HTTP transaction batching. Validate concurrent independent users and cross-user signed/provenance scenarios.
5. **Erasures:** actual `eraseAccountForPrivacy()` currently does not delete `flights` or `fstd_sessions`, only related data/deactivation. Owner-linked UID marker minimization, other owners' evidence, signed void/audit retention and right-of-erasure exceptions require legal/privacy product decision. Working +12-calendar-month UID marker is not a legally approved retention period.
6. **Release authority:** no `DATABASE_SCHEMA_VERSION=22` auto-register, production schema migration, merge, deploy, feature-flag change or full-account Restore activation without separately explicit Filip approval and SHA-bound risk gates.

**ONE NEXT STEP:** reconcile the real app authentication and job invocation paths with the protected SQL transaction boundary; design a **test-only Neon HTTP parity and two-client lock/role comparison plan** on a separately approved, positively identified isolated environment, without production access or enabling Restore.
