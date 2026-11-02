# M0-B: audit-safe full-account recovery — discovery and proposed contract

**Status:** DISCOVERY, DESIGN PROPOSAL / PENDING OWNER SCOPE DECISION. UTC 2026-11-02. Source verified from filipto861/flytally-logbook main@c9c2f60303236113a223942072311f5e37f876f7. Work branch docs/logbook-m0b-discovery-20261102; recheck actual HEAD. This is NOT implemented, merged, deployed, or approved as a schema migration. M0-A remains live in Vercel deployment dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub at application SHA f8116a7311abbdc9e1a269e133fccd7f8533f5c0.

**Permission:** Owner said "super tak pokračujeme" after shipping M0-A. This authorizes read-only discovery and a draft proposal, NOT new restoration code, runtime activation, schema changes, merge, production DB/flags or deployment. The previous skip-review decision concerned M0-A; no external second-AI review has been initiated.

## Verified current-main source map

| Contract | Evidence in current main | Risk / constraint |
| --- | --- | --- |
| M0-A containment | lib/account-restore-containment.ts; app/(protected)/export/actions.ts:66-96; lib/account-restore-v6.ts:221-223 | Upload/stored full-account restore intents and direct writers fail closed; preview, backup create/check/download and single-flight Trash remain independent. Preserve containment until a later separately authorized release. |
| Restore preflight | lib/account-restore-v6.ts:48-86,120-215 | ID and natural-key classification takes place outside the mutation transaction. Some ID matches silently skip, while certain protected fingerprints are checked. Preview does NOT lock current state or authorize mutation. |
| Dormant writer | lib/account-restore-v6.ts:221-286 | Read global flight_audit_log MAX(id), INSERT flight/FSTD parents ON CONFLICT DO NOTHING followed by ID-based UPDATE, DELETE generated audit rows above MAX, then import source audit rows using original IDs with ON CONFLICT DO NOTHING. This can silently skip collisions, affect wrong parent, or destroy independent audit events if enabled. |
| Native audit | lib/db-optimization.ts:39-80 | flight_audit_log has database-global BIGSERIAL id, real create/update/delete triggers and owner-as-actor assignment; native IDs are not portable source-instance identifiers. Never relabel restored trigger events as a real user's direct action without evidence. |
| Backup builder | lib/account-backup.ts:13-52 | Version 13 signed payload, many table SELECTs issued together via Promise.all; NO single explicitly consistent read-only REPEATABLE READ snapshot in current main. Draft snapshot/presign modules referenced by open DATA-1 PRs are NOT merged into main. |
| Backup parser/trust | lib/portable-backup.ts:133-144,248-264; lib/backup-authenticity.ts | Signature binds version, source user and complete payload digest; signed v13 does NOT prove source database instance ID. Current parser dispatch treats all versions >=13 as v13 sections and needs strict version-by-version handling for future formats. |
| Audit read | lib/data/flight-audit.ts | Native audit only, account+flight scoped, LIMIT 100. Imported historical events would require separately authorized two-source read with explicit truthful provenance/ordering. |
| DB adapters | lib/db.ts; lib/local-postgres.ts | Production uses Neon serverless HTTP, local tests use own adapter. A fixed transaction batch cannot rely on an interactive query result outside the atomic write. |
| Schema version | lib/migration-plan.ts | DATABASE_SCHEMA_VERSION=21 in current runtime. Proposed imported audit ledger/v22 and new backup v14 are NOT in main. |

## Existing open Drafts are references, NOT release candidates

- PR #448 is a proposed narrower fix for flight/FSTD parent-ID collisions. It is stacked on unmerged DATA-1 PRs and has not been brought into current main.
- PR #451 is a design-only Option 2 for a separate append-only imported audit ledger, native trigger audit preservation, signed v14 export/parser, dual-source audit read and possible additive schema v22. It is NOT a migration or approved implementation.
- PR #451's owner-policy notes record Option A for legacy signed v13: exact replay of the SAME signed snapshot may be idempotent only with complete event equality; overlapping claimed source-user/audit ID between DIFFERENT signed-v13 digests FAIL CLOSED even if event content equals. Signed v13 still lacks proved source-instance namespace. Reconfirm this during M0-B before implementation.
- Drafts #433–#450 also contain partial snapshot, pre-sign, Neon HTTP, trust and test pieces. Do not cherry-pick automatically, assume their proofs apply to new main, merge stacks, or disturb existing PRs.

## Proposed M0-B milestones (NOT owner-frozen)

| Stage | Proposed implementation boundary | Acceptance (currently NOT RUN) |
| --- | --- | --- |
| B0 design / owner freeze | Decide trust versions, source-identity, audit provenance, ID collision, certified/voided/shared linkage, backup snapshot and exact restore transaction semantics. Decide whether Option 2 ledger and v14 become frozen. | Reconciled source mapping, explicit owner choices and negative/positive matrix; no runtime edits. |
| B1 strictly safe parent/child identities | Prohibit silent conflicting flight/FSTD parents, revisions, GPS and expenses; check account authorization, void/tombstone, shared participant and certified evidence. Ensure atomic revalidation (not just preview). | Owned local PostgreSQL16 real two-session collisions, rollback and tenant tests, no overwritten parents/certified data. |
| B2 provenance and complete backup | If approved: independent append-only imported audit ledger, versioned signed v14 with both native and imported history, explicit snapshot consistency, strict legacy/unknown-version handling and original v13 verification preserved. | Signed v13/v14, corrupted, missing, concurrent snapshot, multi-source replay, cross-digest conflict, provenance integrity and safety-backup completeness. |
| B3 transactional restore, still blocked | Remove MAX/audit DELETE/import-ID path; preserve native audit triggers and immutable imported events; exact replay only with verified full equality and transaction-bound conflicts; honest row counts and no false actor/regulatory attribution. Keep M0-A blocking all full restores. | Full synthetic failure-injection rollback; simultaneous restore and independent edit; source-target ID collision; Neon HTTP transaction parity; repeat restore. |
| B4 formal release and separate enablement | After B1–B3 acceptance, validate on/off compatibility and draft deployment, migration and rollback plans; only then seek separate owner approval for production migration, release and restore enablement. | Exact-candidate source/domain/Node/TS/build, canonical owned PG16, risk-selected authenticated browser, target-specific production smoke; native Safari if UI relevant. |

### Minimum synthetic failure/positive matrix (all M0-B NOT RUN)

1. Same primary ID but unrelated flight/FSTD; reject without update.
2. Same natural flight key but different source ID; reject absent proven mapping.
3. Two concurrent sessions restoring same missing parent: only safe commit or verified identical replay.
4. Same certified revision number but different hash: deny entirely.
5. Missing or broken revision chain: deny entirely.
6. Active flight versus voided tombstone conflict in both directions: deny.
7. Shared participation/instructor verification from a different owner: preserve authority; no fabricated credit.
8. Original archived audit ID collides with unrelated native event: preserve both without rewriting source ID.
9. Independent native edit between preview and restore commit: no audit deletion/overwrite.
10. Same signed v13 snapshot replay exactly: idempotent only after full equality proof.
11. Different v13 signed digests claim same source audit identity: reject under prior design-only owner policy.
12. Unsigned/invalid/unknown future-format, corrupted and oversized backups: fail closed.
13. Concurrent update during multi-section signed backup export: no torn snapshot.
14. Mid-restore SQL failure: full main transaction rollback, truthful counts/error/safety backup.
15. Import/re-export retains both ledgers with correct signatures, owner and voided/GPS history.
16. Another user's independent writes never altered; tenant isolation verified.
17. If UI changes approved: keyboard/focus/mobile/error states, no claim native Safari PASS from Chromium emulation.

## Owner decisions required before any implementation

**D1 trust:** Conservative proposal: first allow write recovery only from same-account **verified signed** current version (v13 initially, later v14); older unsigned v4–v11 preview-only until distinct proof/policy. Unknown or invalid input fail closed.

**D2 audit:** Carry forward PR #451's separate immutable imported audit ledger plus v14 design direction. Preserve native trigger ledger; no origin fraud or silent audit omission. Exact v22 DDL, per-row proof and cross-snapshot issuer namespace are OPEN.

**D3 activation:** Implement/verify corrected engine and any additive migration with public M0-A full restore still blocked. Production schema migration, release deploy and enabling full restore are **separate owner decisions** after actual environment checks.

**Recommended draft:** D1 verified-only; D2 separate imported ledger/v14 design-first; D3 staged, blocked-by-default rollout. These are NOT frozen product decisions.

## Evidence, DO NOT, and next step

- Main source/GitHub/production deployment VERIFIED at stated baseline; other PRs inventoried. No source/tests modified in this discovery. Node, TypeScript, DB, browser, build, Neon HTTP and live production functional tests **NOT RUN for M0-B**. Historical M0-A owner Windows PG16 164/164, Chromium risk 8/8 and formal release PASS are NOT M0-B acceptance.
- Production DB/schema/flags live readback UNKNOWN, no production migration/restore/delete/flag or Training operation. M0-A stays enabled. No secrets/PII/GPS files created.
- Main blockers: signed-v13 issuer/instance ambiguity, per-event membership evidence, safe parent/child remap, original actor truthfulness, mixed-time snapshot consistency, fixed-batch Neon transaction races, v14 schema/export and backward compatibility.
- **ONE NEXT STEP:** Owner decides D1–D3 and authorizes the isolated B0 contract-design scope. No code/schema changes or restore re-enable before that decision.
