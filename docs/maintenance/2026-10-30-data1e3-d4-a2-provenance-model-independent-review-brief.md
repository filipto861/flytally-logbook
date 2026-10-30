# Independent read-only review brief — DATA-1E3 D4 A2 Option 2 concrete ledger and backup-continuity design

**Status:** NOT YET REVIEWED. Owner approved Option 2 **for detailed design only** on 2026-10-30. No schema/SQL/API/migration/flag/merge/deploy authorization. Review the proposal itself; earlier DeepSeek reviewed ONLY the problem discovery, not this concrete ledger contract.

## Immutable repository context

- Private \`filipto861/flytally-logbook\`; main \`807f281e5870164b794d001480ecc84e0b45aea5\` at design kickoff.
- Baseline executable \`6fd5597aec03ee7b6cbab4dafd98228fafdaaea1\` (Draft #449), reviewed A2 source observations on docs-only Draft #450 \`b8ccc583c033f7d9b70f2e3b84000320d066b01a\`. Current proposed design in \`docs/maintenance/2026-10-30-data1e3-d4-a2-immutable-audit-provenance-architecture-v1.md\` (read actual current SHA). New Draft PR on top of #450, not main.
- Previous bounded A1 owner-local PG16 exact source \`0891ae0fb5f1a1c99a6982f55e7f701411bee001\`: baseline 4/4 and four two-session flight/FSTD parent-collision cases PASS, selected triggers only; NOT full canonical v21/signed-v13 app.
- Prior independent DeepSeek A2 read-only **APPROVE WITH CHANGES** (eight P1-P3 source findings) reconciled in \`docs/maintenance/2026-10-30-data1e3-d4-a2-deepseek-review-reconciliation-and-decision.md\`. It specifically did NOT approve Option B schema, did not run PG/Neon, and a proposed \`xmin\` generated-audit DELETE was rejected as incompatible with the owner's retention policy.

## Exact source to check

Read \`lib/db-optimization.ts:39-80\`, \`lib/account-restore-v6.ts:33,47-60,119-195,220-285\`, \`lib/account-backup.ts:16-67\`, \`lib/account-backup-presign.ts\` (\`version===13\` hard gate), \`lib/portable-backup.ts:6-12,124-145,222-265\` (legacy sections, \`>=13\` handling, integrity), \`lib/backup-authenticity.ts\`, \`lib/account-backup-snapshot.ts\`, \`app/(protected)/export/actions.ts:62-87\`, \`lib/data/flight-audit.ts\`, \`lib/local-postgres-transaction.ts\`, \`lib/db.ts\`, \`lib/flight-trash.ts\`, \`lib/migration-plan.ts\` (\`DATABASE_SCHEMA_VERSION=21\`), \`lib/runtime-schema.ts\`, \`lib/recovery-conflict.ts\`, signed-v13/voided/PG16 tests and authoritative ROADMAP/ARCHITECTURE/DEVELOPMENT. If inaccessible, mark UNVERIFIED, do not guess.

## Design to challenge

**Proposed separate append-only imported-audit ledger** alongside existing \`flight_audit_log\`. Local \`local_id\` newly allocated, explicit original \`source_audit_id\`, \`source_user_id\`, \`source_backup_digest\`, authenticated/unverified origin namespace, immutable full \`original_event\`, verified event digest, import operation provenance. No broad DELETE, no real trigger suppression, no silent skip on conflict. Proposed future **v14** export carrying native and imported histories in distinct sections under one signed, repeatable-read snapshot. Existing signed v13 remains byte-/digest-stable on read; pre_restore stored backup must become complete before ledger import enabled. Dual-read consumer must preserve tenant isolation and distinguish imported vs native event without falsely attributing a trigger transition to a pilot action.

**The following are OPEN, not resolved by a design document:**
- Historical signed v13 contains no source-instance/issuer ID. Same source ID across different snapshots (or app signing-key rotation) cannot automatically be treated as same event; review fail-closed and reliable dedup bounds. Must not invent global namespace. Is an external backup digest sufficient for exact replay? For cross-snapshot replay?
- Without persisting the original **entire signed backup payload + signature** (or an independently authenticated per-event proof), how can a stored row later prove that its original event actually appeared in the claimed signed v13 snapshot? A digest pointer is not itself a cryptographic membership proof. Review exact evidence claims, retention cost and privacy before approval.
- Exact JSONB/timestamptz/numeric canonical fingerprint semantics; \`original_event JSONB\` may not preserve serialized source bytes, even if semantically equivalent. Define signed-v13 proof vs byte preservation.
- Trusted source account binding, historical actor (may be different account), deleted/voided flight audit events without live parents, certification independence, importing same account twice, shared participant evidence and legacy v5-v12 authenticity semantics.
- Unique constraint and transaction-safe equality under two real sessions and Neon HTTP fixed query batch, without \`ON CONFLICT DO NOTHING\` silent skip.
- v14 unknown-version **fail closed** parser dispatch, pre-sign validation, storage snapshot, HMAC/signature, schema version vs portable format; v13 exporter no longer permitted to call itself complete after importing ledger.
- Rollout order: additive proposed schema v22, runtime flag OFF behavior must not expose original F9 unsafe restore, migration target explicit and deployment separately owner-approved. Avoid automatic backfill/destruction/restore.
- Query/access: native 100-row limit, stable cursor merging two ledgers, original actor and generated trigger event truthful labelling. Apple Design principles only for a later separate UI task; current PR docs-only.

## Required reviewer output

1. Verdict APPROVE / APPROVE WITH CHANGES / BLOCK **for architecture only**. No SQL execution.
2. P0-P3 table: exact \`path:line@fullSHA\`, CONFIRMED/SOURCE-DERIVED/UNVERIFIED, severity, data-loss/PII/cross-tenant impact, safest correction.
3. Verdict on **separate ledger vs additive columns**; recommend smallest safe v22 DDL and authenticated namespace algorithm only where actually provable, otherwise explicit blocker/owner decision.
4. Show concrete transaction timeline for simultaneous restore of two valid signed snapshots, overlap with independent event append, and exact same origin ID with different payload. Show whether both **positive restore** and **atomic rollback** are possible with current Neon HTTP fixed batch.
5. Assess evidence cryptographic chain and backup v13->proposed v14 trust/snapshot completeness; no overclaim about ability to reverify source signatures.
6. Provide a small, testable, ordered milestone plan with 12–16 **positive and negative** synthetic canonical PG16 fixtures (true two sessions), verified flag OFF and old v13 behavior, authenticated app/Neon parity, UI separate. Distinguish source check from real DB evidence.
7. List exact new owner choices necessary before an actual schema/migration/code implementation (not authorization to perform one).
8. ONE NEXT STEP only.

**DO NOT:** edit code, run a database, connect to GitHub/Neon/production if not accessible, merge, deploy, change migrations/flags or access real flight/GPS/PII. If no full access, return UNVERIFIED for that gate. A reviewer never approves production.

**ONE NEXT STEP:** independent read-only source-backed review of this new proposed D4 A2 v22/v14 provenance architecture; reconcile findings against exact source before any product SQL milestone.
