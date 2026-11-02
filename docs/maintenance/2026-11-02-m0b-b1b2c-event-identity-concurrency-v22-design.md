# M0-B B1b.2c — event identity + account-scoped transaction contract (DESIGN, NOT EXECUTED)

**2026-11-02T20:48Z.** Repository: `filipto861/flytally-logbook`; verified `main@c9c2f60303236113a223942072311f5e37f876f7`, parent work `fix/logbook-m0b-b1b2b-lock-contention-20261102@49f7aeb85e5e61b3256d28cfb4937d38d33dba13` (Draft #458, stacked over Draft #457/#456/#455). B0 design is separate Draft #454. This document is an architectural **proposal for owner/reviewer acceptance**, not an applied contract, release or migration. Runtime remains protected by M0-A.

## 1. Source reconciliation / non-negotiable constraints

- Existing [writer and constraint inventory](2026-11-02-m0b-b1b2c-writer-constraint-inventory.md) shows Create/GPS import/shared materialization use `flightFingerprint` advisory locks, while Edit, FSTD, Trash, certification and void use different or no such locks. In `lib/flight-dedup.ts` fingerprint = user/date/registration/off-block/departure/arrival. Neither that tuple nor `flightRestoreKey` is established as globally unique; regular flight/FSTD indices are non-UNIQUE.
- In dormant `lib/account-restore-v6.ts`, `LOCK TABLE ... SHARE ROW EXCLUSIVE MODE NOWAIT` prevents waiting for an existing writer but, when acquired, still blocks other users' INSERTs. PostgreSQL16 independent-session test in Actions #41520038331 demonstrated this at code/test SHA `b5c95731efe93bfe9556c929274bd833a11bb1a7`; it is **not** an acceptable live design. Replace it, do not merely remove NOWAIT.
- `lib/db.ts` uses `@neondatabase/serverless` HTTP `neon(...)` and `sql.transaction(queries)`; local PG adapter != proved Neon HTTP parity. A fixed batch must not depend on interleaved JavaScript branches or implicitly shared snapshots.
- B0 D1–D3 direction: only same authenticated account + verified signed trust; preserve native audit, separate append-only imported audit; require coherent signed v14; M0-A remains first/active. Integer source ID and v13 signature do not prove instance/issuer continuity. Unsupported origin/issuer/key rotation => UNAVAILABLE, not presumed equal.

## 2. Proposed identity model: four different concepts

1. **Local row key**: existing database `flights.id` / `fstd_sessions.id`, installation-local, mutable only as storage linkage. Never use a backup's numeric row ID to UPDATE an existing unrelated record.
2. **Stable account-owned event UID**: server-minted random 128-bit UUID bound to event kind (`flight` | `fstd`) and authenticated owner. Stable across edit, certification, correction and archival transitions, but **not** evidence that two accounts share regulatory credit. A participant copy receives its own UID; source link is explicit independent provenance.
3. **Source/issuer identity**: authenticated signing issuer/namespace plus verified account continuity and exact backup origin; distinguish a self-declared instance UUID from a cryptographically trusted issuer. Trust is derived from verified key/scope/rotation policy, never from an unverified field in uploaded JSON or coincident `profile.id`.
4. **Human dedup fingerprint**: the existing operational heuristic, permitted to collide for distinct legitimate flights. May signal `REVIEW_REQUIRED`, not automatically prove same event, auto-merge, import credit or be converted into a UNIQUE key.

**Immutable cross-lifecycle registry (proposed):** `account_event_identities(user_id, kind, event_uid, state, current_row_id, provenance_assurance, created_at, ...)` with `PRIMARY KEY(user_id,kind,event_uid)` and CHECK state in `active/trash/voided` (exact enum to freeze), ownership FK(s) wherever topology allows. Never delete/reissue UID on ordinary Trash, restoration or certified void; transition state with audit, and reject active/tombstone conflict. `current_row_id` references must be ownership-checked without creating circular unsafe cascades. Explicit parent-to-revision/child identity validation still required. **Not approved DDL.**

**Legacy and migration:** add nullable `event_uid` to active flights/FSTD and tombstone/archive mapping first. Generate new local UIDs for *existing live* rows only under a separately approved, audited backfill; mark `local-backfill-unproven` as origin assurance. Do **not** pretend that backfilled UIDs establish equality with older exported v13 rows, another installation, or previous Trash/void histories. Do not overwrite legacy row IDs or dedup heuristics. New signed v14 snapshots can persist UIDs thereafter. Before complete migration, missing UID => `UNAVAILABLE` for *full restore*, not a guessed zero/default.

## 3. Database-enforced writer coordination, not a restore-only advisory lock

**Recommended candidate for review:** one **account-scoped guard row** per user in a dedicated `account_write_gates(user_id PRIMARY KEY REFERENCES users(id), ...)` table. Every relevant normal writer is forced through a DB trigger (not just a cooperating action/service) BEFORE INSERT/UPDATE/DELETE; the trigger acquires the same account guard-row `FOR UPDATE`. The restore transaction first acquires that *same* row guard, then re-reads conflicts in **later SQL statements**, before making any restoration write. Only one user's writes serialize; different pilots use distinct rows. Bounds/lock_timeout and retry policy require explicit acceptance. Do not lock `users` globally or rely on `SHARE ROW EXCLUSIVE` table locks.

**Coverage, not an opt-in convention:** triggers must cover both flight and FSTD parents, revisions, ordinary Trash/recovery and void tombstones, tracks/points, expenses, participants, approvals, signature/verifications, provenance, linked crew and every protected child/relevant audit/provenance writer discovered in final inventory. Tables without direct `user_id` need owner resolution through a trustworthy parent FK; owner change and unresolved owner must fail closed. Confirm extension/maintenance roles cannot bypass the contract; same-user multi-row mutations must acquire sorted unique user IDs to avoid AB/BA deadlocks. Test mixed source/participant users and trigger recursion/locking order. This remains **UNVERIFIED** until complete schema coverage and PG16 testing.

**Important PostgreSQL snapshot detail:** do not acquire the guard in the same SELECT/INSERT statement that first evaluates restore conflict predicates, since a statement's READ COMMITTED snapshot can precede waiting for the guard. Use a separate guard-acquisition statement followed by fresh statements inside one transaction; validate actual PostgreSQL and Neon HTTP semantics. A concurrent normal writer must itself be trigger-gated and cannot commit an identity-changing row while restore's account guard is held. Trigger-based serialization is a proposal, not proof until every writer is covered.

**DB invariants remain necessary:** unique `(user_id,kind,event_uid)` across lifecycle registry and account-scoped parent UID/index (nullable legacy partial UNIQUE), FKs/ownership, immutability of UID after insert, non-reusable certified/void identifiers, protected revision number/hash evidence, append-only imported historical audit with its own destination PK. Reject identical-looking but differently signed/certified events unless explicitly and safely proven; `ON CONFLICT DO NOTHING` is not evidence of identity. Preserve trigger-created native audit and avoid `MAX(id)/DELETE` surgery.

**Rejected shortcuts:** (a) whole-table LOCK/NOWAIT (proven cross-user blocking), (b) restore-only advisory lock (ordinary writers bypass it), (c) UNIQUE on `flightFingerprint` (new unsupported business rule), (d) source numeric IDs as global event identities, (e) only app-level checks before `sql.transaction` (TOCTOU), (f) SERIALIZABLE alone without tested retry/conflict and identity enforcement.

## 4. V22 additive schema rollout proposal — NO SQL APPLIED

**Phase A — inspect, no mutation:** on positively identified read-only *test* fixtures only, inventory duplicate fingerprints and actual active/void/trash source relationships, nullable source event IDs, historical audit integrity, FK/ownership shape, trigger inventory and trigger ordering. Never read/export actual private flight/GPS data to logs. Prod DB target UNKNOWN; no production query/migration is approved.

**Phase B — additive opt-in design:** propose versioned DDL for `account_event_identities`, `account_write_gates`, nullable `event_uid` columns, account-scoped partial UNIQUE constraints and no-cascade FK mappings, immutability guards, owner-gate trigger function and targeted table triggers. Exact `v22` migration name/registry/rollback and how on-demand `ensureDatabaseOptimizations()` might auto-run DDL MUST be reconciled before any executable code is committed. No deploy of auto-migrating route code before explicit separate approval.

**Phase C — isolated dry run:** only disposable, positively identified loopback PostgreSQL16 fixture; validate migration twice (idempotence), pre-/post-schema app compatibility, generated UID uniqueness, legacy null behavior, missing/malformed rows, read/write trigger enforcement and absence of unrelated-user lock contention. Never execute destructive tests against Neon staging/production. Isolated Neon HTTP parity requires separately owned, verified non-production endpoint and explicit permission; never infer it from a local adapter.

**Phase D — later controlled rollout:** separate owner decision for deployment order, production DB migration, backfill/flags and rollback. Prefer add schema while app M0-A remains blocked, then source-v14/ledger correctness, only finally B3/B4 Restore activation. The old v13 signed payloads remain immutable. No silent default, auto enablement, early trigger activation or implicit remote SQL.

## 5. V14 export/import trust and evidence

- Define version-specific v14 envelope (not v13 parser fallback) with verified issuer/key ID, explicit account continuity evidence, a signed same-snapshot manifest listing **all** owned active parent/event UUIDs, FSTD, deleted/voided histories, certified revisions and protected children, plus two separately named ledgers: `native_audit` and `imported_audit`. Bind each event/row membership to an authenticated digest and account/event identity; handle key rotation and cloned DBs explicitly.
- Build all eligible sections under one coherent repeatable-read snapshot before signing; `Promise.all` independent HTTP reads is not a coherent MVCC snapshot. Preserve existing backup/check/download availability while M0-A blocks full restore.
- Native `flight_audit_log`: never DELETE/overwrite/import source audit IDs. Imported historical ledger: append-only with local PK, source issuer/account/event/audit-ID identity + exact payload hash, signed backup membership/digest and operation ID. Require full equality for allowed idempotent replay; distinct uncertain source digest/issuer => conflict or UNAVAILABLE, never silently dedupe.
- Restore safety pre-backup and operation ID must be durable and reconcilable before atomic commit; ambiguous commit acknowledgement => `NEEDS_RECONCILIATION`, not blind retry. Return actual committed rows, never preview counts. Untrusted foreign participant credit/approvals and unknown source instance remain withheld or UNAVAILABLE.
- Preserve independent single-flight Trash semantics, native audit, per-participant regulatory evidence and no synthetic signed certification.

## 6. Acceptance matrix / stop conditions

| Case | Must prove before B1b.2c implementation is accepted |
| --- | --- |
| Same UID simultaneous restore and Create | one canonical owner identity, no wrong-ID updates; rollback/conflict atomic |
| Flight Edit changes old/new fingerprint during restore | event UID stable, later conflict predicate reads latest committed state |
| FSTD Create/Edit/Delete/Correct vs restore | parent/revision hash and account ownership protected; no missing-as-zero |
| Two unrelated users simultaneously write | independent inserts/updates succeed without global table lock |
| Trash recovery / certified void vs restore | no accidental active resurrection of tombstone or protected child |
| Shared participant and cross-user linked rows | independent evidence and no cross-user ID reuse, deterministic lock order |
| Bad/missing UID; v13/unsigned; issuer/key rotation unknown | fail closed before mutation, preserve audit |
| v14 source audit replay / different digest | append-only, membership proof, same event exact match or conflict |
| Mid-batch failure/ambiguous acknowledgement | whole commit rollback/reconciliation; native audit retained |
| Neon HTTP fixed-batch + PG16 multi-session | actual evidence on isolated targets, source SHA recorded |

**Gates:** targeted Node/domain/source tests, full Node, TypeScript/build, signed-v14 parser/snapshot tests, canonical owner Windows six-PG16 164/164 or updated hash-pinned inventory, two-session PG16, isolated actual Neon HTTP parity, browser/risk plan and formal exact-candidate release gate where selected. None of these **new B1b.2c** gates has run. Existing Actions #41520038331 belongs only to earlier B1b.2b code/test SHA.

**BLOCKERS for freeze:** issuer account continuity (X1), v14 membership/retention (X2/X3), complete trigger/constraint coverage and deadlock ordering, SQL snapshot/Neon fixed-batch proof (X4), legacy compatibility (X6), explicit staging/prod migration/activation governance (X5).

## 7. Independent read-only review packet

Before implementing or proposing executable DDL, request **one** DeepSeek/Claude read-only architecture/security review under `docs/AI_HANDOFF_TEMPLATE.md`; reviewer has NO write/merge/deploy authority. Freeze the exact PR head SHA for the request.

1. Can a per-account guard-row trigger system on every affected DML path and a separate statement-level restore preflight truly eliminate TOCTOU, including PG READ COMMITTED and Neon HTTP batching?
2. Enumerate missing writer/child/audit tables, deadlock risks (multi-user sharing), trigger user-identity resolution and bypass/rollback possibilities. Is an alternative typed event/parent row-level uniqueness protocol safer at lower blast radius?
3. Are event UID, origin issuer, v14 membership and native/imported audit distinct enough to prevent false same-event or false regulatory evidence across restored instances and account mappings?
4. Can v22 be truly additive/backward-compatible when the current app auto-runs schema optimization, with zero unintended production migration until separately authorized?

**ONE NEXT STEP:** independent read-only review and decision reconciliation against exact code/DDL scope; only then a separately scoped isolated V22 SQL/trigger prototype with M0-A full restore still blocked. **DO NOT** merge, deploy, apply prod DB migration, restore, delete, change prod flags or touch Training.
