# FlyTally Logbook 3.5.0 — M4 Backup v13 Review Reconciliation

**Date:** 6 October 2026  
**Status:** IMPLEMENTED — VERIFICATION PENDING  
**Scope:** Portable backup / exact account restore v13 for certified-flight void history

## Independent review result

Independent review returned **APPROVE WITH CHANGES**. The review correctly identified three material areas:
- version-aware v13 history sections and signing;
- symmetric active/tombstone restore conflicts;
- stale `track_points` backup-stack drift.

One proposed mechanism is **not adopted** after reconciliation with the actual v20 trigger contract: a transaction-local restore marker / trigger exception.

## Reconciliation against the repository

### 1. Restore marker / dedicated trigger bypass — NOT ADOPTED

The review assumed historical child rows cannot be restored while current archive triggers remain enabled. Actual v20 behavior is different:

- `logbook_validate_void_archive_child_insert()` allows a child INSERT when its parent tombstone has `created_txid = txid_current()`;
- a v13 restore creates the tombstone parent and all children in the **same atomic restore transaction**;
- `logbook_require_void_archive_separation()` is deferred and succeeds when no active source row coexists at COMMIT;
- archive UPDATE/DELETE remains blocked by `logbook_protect_void_archive()`.

Therefore a restore-mode GUC or trigger exception is unnecessary and would add a new bypass surface.

Frozen implementation rule:
- `created_txid` is transaction-control metadata, **not portable historical evidence**;
- v13 export does not serialize `created_txid`;
- restore inserts the historical tombstone with all protected audit fields preserved but assigns `created_txid = txid_current()`;
- children are inserted in that same transaction and must satisfy the existing trigger;
- no trigger is disabled and no restore marker is introduced.

### 2. Symmetric active/tombstone guard — ACCEPTED, ALREADY DB-BACKED, ADD PREFLIGHT

v20 already enforces both directions:
- tombstone INSERT + active same owner/id → deferred separation trigger rejects COMMIT;
- active flight INSERT + existing tombstone same owner/id → `trg_logbook_prevent_voided_flight_id_reuse` rejects INSERT.

M4 adds parser/preflight conflict checks as an earlier explicit failure, while retaining the DB triggers as final authority.

### 3. `track_points` compatibility — ACCEPTED WITH REPOSITORY-SPECIFIC CORRECTION

Repository history shows `track_points` has been a portable-format compatibility section since v4, but the legacy restore path did **not** use it to reconstruct GPS. It restored canonical `flight_tracks.coordinates_json` / `overview_coordinates_json` directly.

Current exact-restore code later drifted into querying/inserting a `track_points` table that is not part of the current schema.

Frozen policy:
- v4–v12: keep parsing and count validation for the legacy `track_points` section;
- current restore never queries or INSERTs `track_points`;
- legacy point rows are parser-only compatibility baggage; canonical GPS restore remains `flight_tracks`;
- v13 generated backups omit `track_points` entirely;
- no synthetic point-to-track conversion is introduced because there is no source-backed need for it and historical restore semantics already relied on `flight_tracks`.

### 4. v13 protected history — ACCEPTED

v13 requires these new sections:
- `voided_certified_flights`
- `voided_flight_certified_revisions`
- `voided_flight_verifications`
- `voided_flight_archive_items`
- `flight_source_provenance`

Rules:
- tombstones are history-only; `flight_snapshot` is never materialized into `flights`;
- protected IDs, hashes, timestamps, reason, operation token and JSON evidence are preserved;
- `created_txid` is intentionally regenerated for the restore transaction;
- child rows must reference an included/restored parent tombstone;
- provenance owned by the restoring participant account is preserved;
- source-tombstone FK may resolve either to an included same-account tombstone or an already-existing matching tombstone in the target database;
- participant-owned copies remain active independent records.

### 5. Signing / version semantics — ACCEPTED

- generated format moves from v12 to v13;
- the existing HMAC payload already includes `backupVersion`, so v13 is cryptographically version-bound without changing signature version;
- v12 and older files keep their existing required-section contract;
- v13 requires the five history/provenance sections;
- unsigned/invalid v13 portable files are not allowed to restore protected void history; stored server backups remain trusted;
- v12 behavior is not retroactively tightened.

### 6. Internal protected-evidence integrity — REQUIRED

The outer v13 server signature authenticates the complete portable payload, but restore also validates the archive's own evidence model before mutation:
- deterministic SHA-256 is recomputed for parent `flight_snapshot`, certified revision `snapshot_data`, verification `source_data` and generic archive-item `source_data`;
- preserved current/revision certification fingerprints are re-verified with the canonical certification engine;
- archived signed/revoked verification evidence must still pass the existing HMAC verification contract;
- child revision/verification identity is bound to its parent tombstone before restore.


## M4 restore invariants

Before mutation:
1. all v13 history section counts match payload content;
2. tombstones are owned by the source account and unique by owner/original flight id;
3. no v13 payload contains both an active source flight and its tombstone identity;
4. every archived child resolves to a payload tombstone;
5. same-account bound provenance revision/hash agrees with its tombstone;
6. target active/tombstone conflicts fail before INSERT when detectable.

Inside one transaction:
7. active rows restore only from the active `flights` section;
8. tombstones restore only to `voided_certified_flights`;
9. `created_txid` is set to the current restore transaction;
10. child archives are inserted in the same transaction and satisfy existing v20 triggers;
11. provenance is inserted only after participant active rows and required tombstones are available;
12. any FK, trigger, count or identity failure rolls back the entire transaction.

Before COMMIT:
13. no active owner/id coexists with a restored tombstone;
14. restored history counts equal the validated add plan;
15. no tombstone snapshot was used to create an active flight.

## Required verification

At minimum:
- v13 parser required-section/count/ownership tests;
- v12 compatibility test with legacy `track_points` and no current point table;
- v13 backup generation test proving `track_points` omitted and five history sections included;
- real PostgreSQL restore test for tombstone + children in one transaction using the unmodified v20 triggers;
- active→tombstone and tombstone→active conflict rollback tests;
- orphan child and provenance hash mismatch rejection;
- participant-owned copy + source tombstone history restore;
- repeated identical restore is idempotent; conflicting protected history fails closed;
- invalid/unsigned v13 protected-history restore rejected;
- TypeScript, targeted suite, full PostgreSQL restore acceptance, production build.


### 6. Participant provenance immutability — HARDENED

Repository review found that `flight_source_provenance` was permanent by product contract but still lacked its own mutation guard. v20 now enforces it explicitly:
- DELETE is rejected;
- protected source/participant fields cannot change;
- an existing non-null `source_voided_flight_id` cannot be changed or cleared;
- the normal operational NULL → tombstone binding is allowed only when the exact source tombstone (user/id/revision/hash) was created in the same transaction;
- restore may INSERT an already-bound provenance row only when the referenced tombstone matches the stored source identity exactly.

This closes the reviewer’s provenance-integrity concern without introducing a restore bypass.
