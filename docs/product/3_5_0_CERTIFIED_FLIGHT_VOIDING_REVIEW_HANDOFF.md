# Independent review handoff — 3.5.0 Certified Flight Voiding

**Review status:** COMPLETED — APPROVE WITH CHANGES, reconciled 6 October 2026

## Request

Read-only architecture/data-integrity review. Do not write implementation code.

## Context

FlyTally Logbook currently makes certified flights immutable. Filip approved a new product capability: an owning pilot may remove a certified flight from all active logbook use, while its audit/certification history remains permanently preserved.

After voiding, the flight must:
- disappear from normal Flights/detail/navigation;
- contribute zero to Dashboard, Statistics, Map, Print/Export, professional experience and every recency/compliance engine;
- stop being publicly shared;
- stop driving pending collaboration workflows;
- remain permanently auditable with original certification fingerprint/revision plus who/when/why it was voided.

Hard deletion of protected evidence is forbidden.

## Current repository facts

- Active authority table: `flights`.
- Certified rows are protected by `trg_logbook_protect_locked_flight`, which rejects certified DELETE and only allows a narrowly defined correction transition.
- Direct consumers of `flights` are numerous and decentralized, including Flights list/detail/navigation, dashboard/statistics/map, aeroplane/SPL/BPL/helicopter recency, professional experience, print/export and public sharing.
- Several regulatory services use `FROM flights ... WHERE certified_at IS NOT NULL` directly.
- `flight_certified_revisions` is a separate archive without a parent FK.
- `flight_audit_log` is separate and records create/update/delete.
- instructor approvals, participations and verifications have `ON DELETE CASCADE` source-flight FKs.
- connected crew, expenses and public shares also have flight-owner FKs with delete cascade.
- participant-created copies are independently owned `flights`; they must not be deleted when the source pilot voids their source.
- reviewer handoff originally assumed portable backup v11; repository reconciliation found that current export is v12 (server-authenticated backup), so certified-void archive support is assigned to v13.

## Draft recommendation

Use a permanent `voided_certified_flights` tombstone/archive and remove the row from active `flights` atomically.

Why:
- exclusion from operational/regulatory consumers is fail-closed by construction;
- adding only `voided_at` would require every existing/future direct SQL consumer to remember the exclusion;
- the repository already has a large direct-query surface, so one missed filter is an unacceptable false-credit risk.

Draft tombstone payload:
- original flight/owner identity;
- full certified flight JSON;
- current certification hash/version/revision/timestamps;
- void actor/timestamp/reason;
- certified revision history snapshot;
- verifications/signatures snapshot;
- instructor approvals snapshot;
- participation/connected-crew snapshot;
- public-share snapshot;
- expenses;
- GPS tracks / legacy track evidence needed for audit/backup.

Protection trigger change:
- certified DELETE remains forbidden unless a matching permanent tombstone already exists for the same owner, flight id, revision and certification hash;
- tombstone insert + workflow state transitions + delete happen in one DB transaction.

Backup:
- bump portable backup format;
- include void tombstones;
- restore tombstones as history only;
- never recreate a voided tombstone as active `flights`.

## Questions

1. Do you agree archive+delete is safer than in-row `voided_at` for this repository? If not, give a concrete enforcement mechanism that prevents missed-query leakage.
2. What evidence must remain relational vs can safely be immutable JSON in the tombstone?
3. How should source provenance for already-accepted participant copies be retained after source deletion?
4. Is allowing certified DELETE only when a matching tombstone exists a sufficient database-level invariant? What race/trigger/FK hazards remain?
5. What backup/restore invariants are mandatory to prevent accidental resurrection of voided records?
6. Should audit access reuse `/flights/[id]/audit` as a tombstone fallback or use a separate immutable audit-only route?
7. Identify any hidden integrity, recency, sharing, notification, or restore risks in this design.

## DO

- prioritize fail-closed behavior and protected evidence;
- assume DB schema v19 and certification payload v8 at baseline;
- preserve participant ownership independence;
- preserve backward compatibility for existing active/certified flights.

## DO NOT

- recommend hard-delete without permanent evidence;
- rely on UI-only filtering/authorization;
- treat missing evidence as zero/default;
- silently restore/re-certify an old fingerprint;
- claim regulatory authority approval.

## Acceptance for review

Return:
- APPROVE / APPROVE WITH CHANGES / REJECT;
- required changes before implementation;
- migration hazards;
- test cases that must exist before merge.
