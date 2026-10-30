# DATA-1E3 D4 A2 — immutable imported-audit provenance architecture (OPTION 2, DESIGN ONLY)

**Decision/date:** 2026-10-30 — the owner explicitly approved **Option 2 as a direction for detailed architectural design only**. This does **NOT** approve schema, migration, application code, feature-flag activation, merge, deploy, production writes, restore, backfill, or backup-format change. Specific field names/DDL below are **PROPOSALS**, not implemented or frozen product schema.

**Repository:** \`filipto861/flytally-logbook\`. Canonical \`main@807f281e5870164b794d001480ecc84e0b45aea5\`. Parent docs-only Draft #450 \`b8ccc583c033f7d9b70f2e3b84000320d066b01a\`; underlying immutable executable \`6fd5597aec03ee7b6cbab4dafd98228fafdaaea1\` in #449 (same executable as bounded owner-local A1 PG16 PASS \`0891ae0fb5f1a1c99a6982f55e7f701411bee001\`). This document is a **new design candidate**, not a patch.

## 0. Why a new model is necessary

Current \`lib/db-optimization.ts:39-43\` defines \`flight_audit_log.id BIGSERIAL PRIMARY KEY\` globally; \`lib/db-optimization.ts:60-80\` automatically appends \`created/updated/deleted\` rows. Current signed-v13 \`lib/account-backup.ts:31,64-66\` exports original audit IDs, while \`lib/account-restore-v6.ts:224,268-269\` captures global MAX before transaction, broadly DELETES events generated after it and imports archive rows with \`ON CONFLICT DO NOTHING\`. It may remove independent history (synthetic SQL F9 confirmed) or drop archived events on collision (confirmed source mechanism, complete app runtime not tested). Preview \`lib/account-restore-v6.ts:135,178\` knows only user-scoped IDs and skips content-mismatched same IDs. The owner requires **all independent events, all genuine trigger events and all archived evidence to survive without hidden changes**.

**Architectural principle:** a database-local row ID must never double as the original signed archive's global identity. The model distinguishes **where the event was originally observed** from **where the event was stored in this destination**, with explicit authority and no history deletion.

## 1. Chosen architecture for design comparison — separate append-only imported ledger (recommended candidate)

Retain \`flight_audit_log\` *as-is* as the **native, database-trigger-generated ledger** for compatibility; add a separate table named *tentatively* \`imported_flight_audit_events\` for backed-up historical evidence. Never insert an archive's original numeric audit ID directly into \`flight_audit_log.id\`. The imported table's own local ID sequence is independent and must be newly generated, not copied from archive. No trigger-generated event needs to be deleted to make space for archived identities.

**Proposed DDL shape (pseudocode ONLY, not migration to execute):**

\`\`\`sql
-- DESIGN PSEUDOCODE ONLY. DO NOT APPLY.
CREATE TABLE imported_flight_audit_events (
  local_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,             -- source audit flight identity; no inferred FK
  source_user_id BIGINT NOT NULL,
  source_audit_id BIGINT NOT NULL,
  origin_namespace TEXT NOT NULL,       -- proven identity domain, not arbitrary title
  source_backup_digest TEXT NOT NULL,   -- signed snapshot provenance (SHA-256)
  source_backup_version INTEGER NOT NULL,
  source_authenticity TEXT NOT NULL,     -- verified / legacy-unverified, source-backed
  event_fingerprint TEXT NOT NULL,      -- canonical full immutable event equality
  original_event JSONB NOT NULL,        -- all original event fields, including source id
  first_import_operation_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, origin_namespace, source_audit_id)
);
-- Access, bounds, checks, indexes, audit immutability/anti-delete and migration
-- details must be designed and tested, not presumed from this sketch.
\`\`\`

**Never silently rewrite \`source_audit_id\`, signed \`original_event\`, timestamp, action, actor or payload data**. The ledger's \`local_id\` is storage-only and must not be exposed as if it were the original audit ID. No \`ON CONFLICT DO NOTHING\` with no equality check; a uniqueness conflict either proves a complete identical event or **fails the whole main restore transaction**. In particular, \`event_fingerprint\` by itself is NOT sufficient to establish a trusted origin.

**Why a separate ledger over columns on \`flight_audit_log\`:** lowest blast radius to the native trigger's existing write contract, preserves native \`BIGSERIAL\` and existing database paths, separates imported signed historical data from new actual database transitions, avoids mandatory broad update/backfill of native rows. **Costs:** export/read/view/authorization become a two-source projection; backup versioning and immutable ledger lifecycle need careful proof. Adding columns to native audit remains an alternative if read/export complexity or referential constraints make a separate ledger unsafe, but it is NOT the selected candidate for this design milestone.

### 1.1 Authenticated source namespace — the critical unresolved identity problem

- New **proposed v14** backups may carry a durable, signed \`source_instance_id\` minted by a versioned installation-level schema migration. Its lifecycle, tenant scoping and integrity claims require independent review. A content hash does not substitute for source identity; don't invent historical instance UUIDs for v5–v13.
- Historical v13 signed backups have \`profile.id\`, backup digest and server signature but **no authenticated source-instance identifier**. Their \`source_user_id\` alone cannot prove identity across independent databases, restores or signing-key rotations. For v13, a conservative **snapshot origin namespace** may be derived from signed \`source_backup_digest\` plus a validated source-user identity; this supports exact replay of the *same signed backup* but not automatically deduplication across two different snapshots of the same event.
- A separate **legacy equivalence index** across snapshots is a *proposed* controlled reconciliation of \`(destination account, signed source user, source audit ID, full event fingerprint)\`; equality could allow dedup only if trusted original namespace is demonstrated. Same claimed source ID with differing content or unknown issuer origin MUST **NEEDS REVIEW / FAIL CLOSED**, never silently merge or duplicate.
- For unsigned v5–v12 sources, mark authenticity as unverified, enforce strict account owner/file binding and parser relationship checks, never imply cryptographic attestation, and do not elevate them to server-verified history. Confirm current parser's actual version-specific trust gates before finalizing this policy.
- **Open blocker L-IDENTITY:** define unambiguous namespace/equivalence for *multiple* signed v13 backups of the same source. Without proof of issuer/domain, idempotence is guaranteed only within an exact digest; other cases must explicitly fail closed, not produce duplicates. This is a reviewer/owner decision gate before implementation.

### 1.2 Event content and integrity

- Immutable event fields: \`id\` (original source ID), \`flight_id\`, \`user_id\`, \`actor_user_id\`, \`action\`, \`old_data\`, \`new_data\`, \`changed_at\`. Preserve null versus non-null, canonical JSONB meaning, timestamp zone equivalence and numeric precision; never \`JSON.stringify\` loosely and declare identity.
- \`source_backup_digest\` refers to the **entire original verified signed payload** (for v13). Store no raw signature secrets. Keep the signed original row semantically preserved in \`original_event\` and calculate a versioned canonical event fingerprint with a deterministic, tested domain separator; \`source_backup_digest\` alone cannot detect per-event discrepancy after capture without a complete original backup.
- Reject malformed payload, duplicate source IDs in the same namespace, missing/mismatched original flight ownership/actor evidence or ambiguous cross-account links before any main-restore write; deleted/voided flights may have valid historical events without an active parent row. **Do not invent \`FOREIGN KEY(flight_id) REFERENCES flights\`** or cascade deletion for archived history without proving all legacy states and voiding behavior.
- Read-only **evidence assurance** must distinguish \`server-signature verified\`, \`legacy/unverified\`, and \`source fidelity checked against retained digest/row fingerprint\`. Never treat these as regulatory approval or independent flight certification.

### 1.3 Immutable write and authorization

- A dedicated server-side import operation, not a public table write. Full authenticated account binding; v13 server signature and digest verified prior to trusting imported history; legacy unknown signed provenance explicitly labelled and restricted by actual policy.
- **Append-only** is a database contract, not merely TypeScript convention: propose permission-restricted insert role and/or audited \`BEFORE UPDATE OR DELETE\` rejection for ledger rows, including actor rules; precise migration/effectivity and service-owner privileges need design. Preserve lifecycle for lawful erasure as a separate explicitly authorized administrative process, not regular restore.
- No client-controlled origin namespace / operation tag without server verification. Consider domain-scoped unique constraints and account-keyed indexes only after review of binding and conflict model. No raw old/new JSON, GPS, names or HMAC payloads in logs, errors, PR tests or checkpoint data.
- On conflict, fail atomically with generic user-safe message; maintain previously committed independent audit events and \`pre_restore\` backup, distinguish its separate transaction from main restore rollback. Never count a staged/attempted event as successfully restored.

## 2. Import/write transaction contract — no broad audit DELETE

Proposed high-level algorithm, **not executable SQL**:

1. **Prepare (read-only):** authenticate \`userId\`, parse archive within size/structure bounds, verify digest/signature (or legacy trust classification), validate account-binding/relationships/certified/voided/shared evidence, validate archive event structure and namespace, preview \`add / identical / conflict / unavailable\`. Identify any possible native-vs-imported duplicate by full event content and provenance rather than global row \`id\`.
2. **Safety backup:** existing \`createStoredBackup(userId,"pre_restore")\` is a distinct committed operation. **GATE:** if it is still v13 and cannot preserve imported ledger data, restore must FAIL CLOSED before any mutation; cannot sign an incomplete safety backup. Upgrade export+snapshot and pre-sign validation *before* activating new importer. This is a dependency, not a follow-on cosmetic change.
3. **Main atomic transaction:** stage new flight/FSTD rows with existing A1 strict identity rules; preserve every native audit trigger event; import original archived audit records into the separate ledger with **new local storage IDs**, exact preserved source events and explicit source provenance. Do not call \`MAX(audit.id)\` for cleanup; do not DELETE native audit; do not skip unverified archival conflicts. Ensure idempotent skip only after same-namespace full immutable-equivalence evidence, enforced within transaction. Other protected rows and counts A3/A4 retain independent gates.
4. **Neon HTTP compatibility:** current \`sql.transaction(queries)\` is a fixed ordered query batch, not a general interactive transaction; any intermediate result-dependent branching must be expressed as verified SQL CTE/conditional assertions or the explicitly reviewed adapter API. No independently scheduled \`SELECT\`/INSERT outside transaction for authoritative decisions; preview is advisory. Avoid unsafe local adapter parity assumptions and ensure statement-count budget.
5. **Commit / rollback:** all main-restore writes (including imported ledger) either commit together or roll back. Generated native audit and unrelated independent events must never be deleted. Unexpected collision must fail closed, not leave partial new events, not return optimistic \`plan.preview.add\`. \`pre_restore\` safety backup, if created, remains independently.
6. **Output:** distinguish **imported historical events**, **newly generated local events**, and **already-present verified identical events** with actual committed counts after A3 fix. Error wording includes rollback/safety-backup state, no private identity or SQL fragments.

**Migration gate:** introduce **proposed schema migration v22** separately from SQL runtime activation. This is not approved for execution. Must be additive, repeatable, fail closed if missing, versioned schema/flag-gated; no auto fallback to still-unsafe F9 legacy restore if feature is OFF. Test both flag ON and OFF against legacy flows. DO NOT run a migration or change prod feature flags without explicit separate owner authorization and verified target.

## 3. Backup format / continuity: v13 cannot silently become incomplete

Current \`lib/account-backup.ts:22-66\` exports a single v13 \`audit_log\` from native audit only, in a read-only repeatable-read signed snapshot. \`lib/account-backup-presign.ts\` explicitly requires \`version===13\`; \`lib/portable-backup.ts:133-143\` treats **any** version \`>=13\` as v13 required-section schema; \`lib/backup-authenticity.ts\` signs payload version+source account+digest. Therefore a design that only adds a ledger would silently omit it from v13 export and **make the pre_restore safety snapshot incomplete**.

**Proposed new format \`v14\` (not frozen):**
- Keep v13 original \`audit_log\` semantics and signature intact for reading existing backups. V14 carries **separate, explicitly named arrays** for native current audit events and imported historical provenance events, not a mixed set of incompatible identities. Exact names and redaction/scope to be decided after compatibility audit; count each section accurately.
- Every imported ledger export item includes its verified/or-unverified source namespace (not invented from current target), original \`source_audit_id\`, immutable event payload and fingerprint, original backup digest/format and original source account binding. New v14 snapshots should also contain the verified current DB instance namespace if such a concept is adopted; do not claim an existing v13 issuer namespace is known.
- Export in **one read-only REPEATABLE READ transaction** covering *both* native and imported audit and all other protected sections. If required ledger schema is missing/unknown, **fail closed** rather than export a signed, silently truncated history. \`account_backups\` stored snapshots, manual export, before-restore safety snapshot, signing and HMAC verification MUST all be updated consistently.
- V14 must have explicit parser dispatch and version-specific array requirements, size bounds, counts and provenance validation. Do not let \`>=13\` permissive parsing treat unknown future versions as v13. Existing signed v13 backups remain unchanged and verifiable with their original digest/signature; **no payload rewrite/resign**.
- Compatibility test matrix: v5–v12 legacy, authentic/invalid v13, new v14, unknown v15, empty and large audits, mixed native/imported audit, successive backups/reimports, voided/deleted flights and separate R1/R2 signature/verification evidence. Preserve old v13 parser paths for archives; only issue new v13 if complete by definition (likely not once ledger exists), otherwise use v14 or explicitly deny export.
- **Open blocker B-TRUST:** signature issuer/domain/key rotation and mapping across backups; \`source_backup_digest\` proves a particular payload was seen, not that different signed backups' rows share a globally verified issuer. Need source-backed decision before idempotence/format freeze.

## 4. Read/UX contract (design only; no UI changes)

- Existing \`lib/data/flight-audit.ts:8-15\` reads 100 account-scoped rows from native audit ordered by \`changed_at DESC, id DESC\`, joins actor display name. Proposed read projection merges two **explicitly labelled** sources: \`Local database event\` and \`Imported historical event\` (verified versus legacy-unverified). No fabricated chronology, actor, identity, or regulatory status.
- Native trigger events generated by restoration are **real** but cannot truthfully be attributed to an interactive user action solely because the trigger set \`actor_user_id=NEW.user_id\`; until an approved operation-origin write contract is implemented, UI must not claim “pilot edited this flight.” A future explicit restore operation provenance tag requires separate source-backed trigger/transaction design; never infer it from \`changed_at\`, ID ranges, or \`xmin\`.
- Cross-source ordering: sort by event timestamp, then deterministic source-kind and source-origin/local identifiers as tie-breakers (not a fabricated global numeric ID). Per-flight and per-account filters must be applied to **both** sources **before** the limit/pagination. \`LIMIT 100\` native-only is no longer a complete view; propose stable cursor pagination and \`archived evidence available\` indicator only with verified query semantics.
- Preserve existing native UI components, focus/keyboard/touch, theme and user-controlled navigation. Pending/rollback messages unambiguous; no raw SQL/PII in messages. **Motion: NONE**. No new dependencies, branding or styling changes. Real responsive/iPad/mobile/light/dark/night/VoiceOver Safari remain **NOT RUN** because no UI implementation is requested or built.
- The **certified revision/verification history** at \`app/(protected)/flights/[id]/audit/page.tsx\` remains separate authoritative evidence; do NOT derive statutory current/licence credit from mixed material audit events.

## 5. Alternative considered: additive columns on existing native audit table

A single \`flight_audit_log\` table with \`origin_kind\`, \`source_audit_id\`, \`origin_namespace\`, \`source_backup_digest\`, \`restore_operation_id\` and a local surrogate \`id\` can reduce dual-read/export surface. However, it changes the trigger/table security and archival-collision semantics directly, exposes source identity to legacy consumers, requires backfill defaults for all native rows and more complex constraints for native-versus-imported events. No current source evidence proves it cheaper or safer. Keep this as **secondary design**, not approved implementation.

## 6. Milestone order and acceptance / gates (all future tests NOT RUN)

| Stage | Scope | Acceptance and failure evidence | DO NOT |
| --- | --- | --- | --- |
| **A2-DESIGN (current)** | Owner-approved direction only, separate ledger vs additive column comparison, v13-v14 compatibility and cross-backup identity proof | exact source map, decision log, independent read-only reviewer verdict/reconciliation, explicit open namespace and trust blockers; Draft docs-only, no runtime/sql | No schema/feature code/migration/DB |
| **A2-CONTRACT** | Freeze source-event namespace/equality/immutability, versioned export/restore, tenant access and trigger semantics; approved DDL proposal | reviewer-confirmed true positive nonempty signed-v13 and v14 with overlapping source/local IDs; baseline compatibility; exact SHA risk plan | No production change; separate owner approval required |
| **A2-PG-TEST** | New one-use, positively identified local PostgreSQL16 canonical-v21(+proposed v22) synthetic fixture with genuine trigger install and two sessions | independent post-preview event survives; foreign-owner ID overlap; same-owner mismatched/equal; two backups same source; rollback stage; safety snapshot completeness; exact v13/v14 signatures; actor/void history; sequence behavior; cleanup and exact SHA; tests PASS not claimed until executed | No remote/Neon/destructive prod test |
| **A2-IMPLEMENT** | Small additive schema/migration implementation + server API, serialization/export, read projection staged independently | Node/TS/PG parity, existing A1 baseline 4/4 + 4 two-session cases PASS, protected child/cert evidence unchanged; committed counts A3 and independent A4/D2 gates | No merge/deploy/production migrations/flags without separate approvals |
| **A2-RELEASE** | Distinct reviewed candidate and production rollout/rollback plan | full signed-v13 authentication, provider schema verification, full Node/build/browser/risk and production smoke at exact SHA; rollback compatibility demonstrable | Never equate schema migration with deployment authorization |

**Specific proposed A2 acceptance fixtures:** A2-P01 independent same-user append between preview and commit; P02 independent other-user append; P03 signed source ID 1 colliding with native destination ID 1 **still succeeds as two labelled evidence records** (given distinct verified origin); P04 same source namespace+ID **identical content** rerun yields no duplicate; P05 same namespace+ID **different content** fails transaction; P06 same signed snapshot repeat idempotent; P07 two distinct signed snapshots with overlapping events: identify or fail closed, no duplicate; P08 legacy v5–v12 unverified provenance label; P09 signed v13 digest tamper/actor mismatch rejection; P10 fully verified v14 roundtrip including ledger; P11 native trigger created+updated preserved with historical rows; P12 new pre_restore safety backup contains both ledgers and remains after main restore rollback; P13 native and imported consumers have stable order/limit and no cross-owner leaks; P14 A1 four races, R1/R2/voided/fstd/verifications/GPS unchanged; P15 no trigger disable, no broad MAX/DELETE and no optimistic reported inserts; P16 roll-forward/rollback and schema missing/flag OFF fail closed. **Every test synthetic and bounded; no private data.**

## 7. Explicit decision log / review questions

- **APPROVED by owner:** Option 2 *as architectural direction for detailed design*. The owner has **NOT** chosen the final table/columns, whether v14 is final, how legacy namespaces resolve, or authorized any DB operation. The previous D4-A audit rule (keep independent + genuine generated events, never silent audit loss) remains frozen.
- **PROPOSED by lead (requires reviewer):** separate append-only imported ledger, local generated storage ID, original signed source ID/payload, provenance digest/fingerprint, conservative namespace, explicitly versioned v14 export, strict fail-closed ambiguous cross-snapshot replay, dual read and no existing native audit delete.
- **OPEN decision 1:** credible namespace/issuer identity for v13 and v5–v12, and deterministic dedupe across multiple signed snapshots. If impossible, explicitly limit legacy cross-snapshot idempotence; never fabricate source instance ID.
- **OPEN decision 2:** whether a separate ledger or additive columns minimize overall data-integrity/restore risk; confirm authenticated query/migration and shared/void actor constraints.
- **OPEN decision 3:** exact API trust classification, v14 section naming and version-specific validation, anti-tamper origin binding and operation provenance. A v13 signature is verified only under the actual server key and exact digest.
- **OPEN decision 4:** disabling old F9 runtime path under flag OFF; no unsafe fallback, no incomplete stored/pre_restore v13 backups; migration needs separate owner approval.
- **OPEN decision 5:** whether native generated events should be tagged with restore origin by a new reviewed trigger contract or merely shown neutrally until proven. Avoid claiming historical actions by the account owner.

**ONE NEXT STEP:** request one **independent read-only architecture/security review of this new concrete ledger-vs-columns and v13→v14 design** at exact candidate SHA, resolving origin-namespace and snapshot completeness blockers; reconcile reviewer findings before seeking approval for any SQL/implementation milestone.

## Evidence and deployment statement

Current branch is documentation only; technical tests **NOT RUN/N/A** on design SHA. No schema changes, DB queries, migrations, flags, merges, or deployments. Canonical current production still serves earlier confirmed SHA; actual production schema/flags/DB details **UNKNOWN**. All prior A1 PASS applies only to explicitly recorded selected-source SQL candidate and scope.
