# FlyTally Logbook DATA-1E3 D4 A2 — C2 observation persistence & candidate v14 MVCC manifest (V7)

**2026-10-31 — DESIGN CANDIDATE, NOT AN APPROVED SCHEMA OR RELEASE.** This is the next technical design milestone following the owner's **approved design directions**: Option 2 separate imported immutable audit history; signed-v13 strict A; L1 imported UNATTACHED; N2-S native sidecar; R1 import-time-only original-source membership; V13-I original signed-v13 audit-to-ledger; conditional V14-C/C2; and, newly, **R1 K1 + T1 + E** (versioned keyring, category/purpose-specific lawful retention, authorized exceptional erasure with anti-resurrection). This document does **not** approve concrete SQL, constraints, canonicalisation algorithm, version-14 wire implementation, new secrets, legal retention intervals, restore/migration/merge/deploy.

## 1. Exact source and source-backed arithmetic

- `filipto861/flytally-logbook`: verified canonical main `807f281e5870164b794d001480ecc84e0b45aea5`; work Draft [#451](https://github.com/filipto861/flytally-logbook/pull/451) stacked on Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. Frozen executable/test candidate `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` (Draft #449) is not current production.
- **Direct source extraction** from `lib/account-backup.ts` frozen Git blob `f97464b04c1fc00eb94fb9e7bce30aed67933dd2`: existing `snapshotResults=await sql.transaction([...],{isolationLevel:"RepeatableRead",readOnly:true})` has exactly **32 SQL result sets** = Q00 pre-probe + **Q01–Q30 existing account sections**, profile Q30 + Q31 post-probe. `lib/account-backup-snapshot.ts` currently requires precisely 32 and compares both `pg_current_snapshot()` values; `lib/account-backup-presign.ts` only signs version 13.
- Earlier N2-S candidate `30 + 4 + 2 = 36` adds only native identities, imported events, explicit empty links, owner lineage. C2 one-to-many **independent immutable signed observation** needs its own queried section under the two-table design. **Proposed v14 C2 manifest = 30 existing + 5 added + 2 probes = 37 results (indexes 0…36)**, not 36. `37` is **a precisely indexed candidate** under the assumed five additional queried sections, **not a final frozen number** until exact schema, release acceptance and cross-provider transaction constraints are reviewed.
- Existing confirmed unsafe `lib/account-restore-v6.ts:224,268–269` global audit MAX, native DELETE and archived audit insert `ON CONFLICT DO NOTHING` remain a hard P0 stop; V7 does not fix or waive them. V13 and V14 may not fall back to unsafe F9 when a flag or schema is unavailable.

## 2. Candidate physical/logical entities (no SQL)

**A. Existing native `flight_audit_log`:** unchanged `BIGSERIAL` row and original fields, stored genuine local trigger events retained. Untrusted historical source rows never enter it. Actor field is a stored claim, **not** independently verified human editor.

**B. New `native_audit_event_identities` (N2-S sidecar):** exact one-to-one local `(native_audit_id,native_user_id)` mapping to original event, DB-generated immutable `event_uid`, `assignment_kind=at_event_insert | migration_backfill`, `assigned_at` and generator version. Mapping is transactional at native event creation, historical mappings added *insert-only* (no native UPDATE/DELETE). Enforce FK/owner/uniqueness/RESTRICT-or-NO-ACTION, consistent current owner and complete coverage before signing. UUID does not identify a physical instance; backfilled UUID does not authenticate historical origin.

**C. New `imported_audit_events` (one destination-scoped logical historical event):** locally generated storage identity; authenticated destination account and **original signed source-user claim**, source family (`legacy_v13_imported` vs `native_v14_imported`), original native numeric audit/flight IDs as *source metadata only*, optional true native `event_uid` only for v14 source-native events, its authenticated `uid_assignment_kind`, source original action/actor/changed_at, original old/new event JSONB, strict versioned canonical-event hash, original provenance tier and L1 UNATTACHED state. No destination flight FK is inferred; false actor attribution and automatic certification/recency credit forbidden. Do not normalize missing into null or numeric zero.

**D. New `imported_audit_observations` (one row per DISTINCT signed source snapshot claim of an imported event):** immutable, account-bound reference to C plus a separately tracked original `signed_source_user_id`, **full signed source snapshot digest**, source format/version, signature envelope version/algorithm and key reference if actually in that format (v13 has no key ID), result `verified_at_import_only` and import timestamp/operation, source native `event_uid` and assignment kind (where applicable), source numeric IDs, event canonicalization scheme/version/hash and **independently retained complete original semantic event fields or a reviewer-proven equivalently immutable per-observation representation**. Do not store signature secret or imply a retained, independently verifiable original source-row inclusion proof once full archive is pruned. A signed v14 re-export of an **already imported** v13/native observation is a *transport wrapper*, not a new native event or replacement for that observation's original signer/digest.

**E. `imported_event_flight_links`:** required explicit zero-row section `[]` under L1. No table may acquire guessed cross-account numeric-flight joins; nonempty restore payload means BLOCK. A future owner-approved L2 would be a separate version/review.

**F. `origin_lineage`:** minimum one owner-scoped declared origin record in the candidate, labelled `DECLARED/UNVERIFIED`, not physical DB uniqueness or approved source lineage. Sign this exact claim; avoid per-backup “verified instance” extrapolation. Exact DB storage shape vs signed section is still subject to review.

**G. Exceptional erasure/re-import suppression controls:** R1 E requires an independently authorized, privacy-reviewed mechanism whose effects cannot be reverted by importing a stale v13/v14 backup. **Do not blindly include a reimport suppression table/keys in the portable backup** (that might itself restore obsolete prohibition or personally identifying data). The required independently durable policy authority, disaster recovery and any additional signed metadata are unresolved; if a new backup section is necessary, **37 is superseded**. No ordinary DELETE grant or database-wide CASCADE is authorized.

## 3. One-to-many identity and atomic arbitration (proposal, unresolved indexes/DDL)

- **Exactly repeated signed v14 snapshot digest**: authentic full-content/owner/identity equality => `IDENTICAL` (no new event or observation). Same digest plus any difference in original canonical fields, signer/owner, assignment, time/actor, source IDs or algorithm => entire main restore `CONFLICT`/rollback.
- **Different authentic v14 digests**, same signed source user and `at_event_insert` UID and *complete canonical event/identity equality*: append a **new independent D observation** and optionally group under one provisional C logical event. Immutable D rows stay countable. Neither copied UUID nor signing key attests physical database origin.
- Same native UID with different content, original actor, timestamp, account claim, UID assignment, canonical version or source ID => whole restore BLOCK; cross-user UID collision is not a shared event. No fuzzy/equal-timestamp/numeric-ID merge.
- `migration_backfill` UID overlapping across **distinct signed v14 digests** => BLOCK even with identical event unless **new, separately approved strong lineage evidence** exists; initial design includes no exemption. Different UIDs with equal event bodies stay different, unless another explicit owner policy says otherwise.
- **Signed v13 remains strict A**: same source user and same numeric original source audit ID from distinct signed-v13 digests always BLOCK, even if event bytes equal. Same signed v13 digest exact replay requires full event match. Signed-v13 event remains `legacy_v13_imported`, never upgraded into native-v14 UID.
- **Re-import of v14-wrapped historical imported events:** preserve original v13/v14 source observation identity/proof tier and allow exact equality replay without synthesizing a new original source-native observation. If original snapshot claims conflict with incoming wrapper, BLOCK rather than “last wins”. The extra *transport* signature is not newly authenticated original historical pilot action.
- All arbitration account-scoped and DB-transaction authoritative, with proven two concurrent PostgreSQL sessions and actual Neon HTTP fixed-query transaction behavior. `ON CONFLICT DO NOTHING`, mutable application-side preview or a sequence-wide `MAX(id)` check is NOT a security decision. A committed complete `pre_restore` safety archive must precede the separate atomic main restore; any failure preserves that archive and rolls back main mutations.

## 4. Candidate exact Q00–Q36 result-position manifest (v14 only)

All v13 Q00–Q30 meanings and ordering are preserved here for traceable review. Q31–Q35 are **new proposed v14 C2 queries**; Q36 is the final same-transaction probe. The implementation may select another order only after the manifest and validators are versioned together.

| Query ID | 0-based result index | Payload section | Structural requirement |
| --- | --- | --- | --- |
| Q00 | 00 | `mvcc_probe_before` | Exactly one read-only REPEATABLE READ probe row |
| Q01 | 01 | `flights` | Existing v13 query and ownership semantics |
| Q02 | 02 | `aircraft` | Existing v13 query and ownership semantics |
| Q03 | 03 | `rates` | Existing v13 query and ownership semantics |
| Q04 | 04 | `airports` | Existing v13 query and ownership semantics |
| Q05 | 05 | `expiries` | Existing v13 query and ownership semantics |
| Q06 | 06 | `settings` | Existing v13 query and ownership semantics |
| Q07 | 07 | `flight_tracks` | Existing v13 query and ownership semantics |
| Q08 | 08 | `audit_log` | Native local audit rows only (unchanged v13 shape) |
| Q09 | 09 | `fstd_sessions` | Existing v13 query and ownership semantics |
| Q10 | 10 | `flight_certified_revisions` | Existing v13 query and ownership semantics |
| Q11 | 11 | `fstd_certified_revisions` | Existing v13 query and ownership semantics |
| Q12 | 12 | `deleted_flights` | Existing v13 query and ownership semantics |
| Q13 | 13 | `pilot_connections` | Existing v13 query and ownership semantics |
| Q14 | 14 | `flight_participations` | Existing v13 query and ownership semantics |
| Q15 | 15 | `instructor_flight_approvals` | Existing v13 query and ownership semantics |
| Q16 | 16 | `pilot_licences` | Existing v13 query and ownership semantics |
| Q17 | 17 | `pilot_qualifications` | Existing v13 query and ownership semantics |
| Q18 | 18 | `user_notifications` | Existing v13 query and ownership semantics |
| Q19 | 19 | `flight_verifications` | Existing v13 query and ownership semantics |
| Q20 | 20 | `connection_audit_log` | Existing v13 query and ownership semantics |
| Q21 | 21 | `flight_expenses` | Existing v13 query and ownership semantics |
| Q22 | 22 | `spl_recency_evidence` | Existing v13 query and ownership semantics |
| Q23 | 23 | `helicopter_recency_evidence` | Existing v13 query and ownership semantics |
| Q24 | 24 | `bpl_recency_evidence` | Existing v13 query and ownership semantics |
| Q25 | 25 | `voided_certified_flights` | Existing v13 query and ownership semantics |
| Q26 | 26 | `voided_flight_certified_revisions` | Existing v13 query and ownership semantics |
| Q27 | 27 | `voided_flight_verifications` | Existing v13 query and ownership semantics |
| Q28 | 28 | `voided_flight_archive_items` | Existing v13 query and ownership semantics |
| Q29 | 29 | `flight_source_provenance` | Existing v13 query and ownership semantics |
| Q30 | 30 | `profile` | Exactly one authenticated profile row |
| Q31 | 31 | `native_audit_event_identities` | One-to-one complete native audit mapping, same account, no orphan |
| Q32 | 32 | `imported_audit_events` | All owner-scoped immutable logical imported event rows |
| Q33 | 33 | `imported_audit_observations` | All owner-scoped immutable observations and exact event references, no missing originals |
| Q34 | 34 | `imported_event_flight_links` | Explicit empty result/array, count exactly 0 under L1 |
| Q35 | 35 | `origin_lineage` | Precisely one owner-scoped **DECLARED/UNVERIFIED** lineage record in this candidate |
| Q36 | 36 | `mvcc_probe_after` | One probe; identical snapshot ID, read-only and repeatable-read state |

**Result validator:** refuse non-array/missing/extra slot, bad counts/types, absent/extra profile, owner mismatch, missing identity map, observation referential mismatch, invalid empty-link semantics, missing/invalid lineage claim, probe inequality, unknown signature/key ID/canonicalization version, unsupported v15+, partial/overlimit source. Never sign a source that cannot pass restore validators. `Q34` still consumes a query result even if it always returns `[]`. Rows returned by each query must follow stable total ordering to support deterministic digest; source order and exact generated SQL require a subsequent design/implementation review. No arbitrary extra `SELECT` appended without changing count and tests.

**First-release key lifecycle:** v13 source signatures retain their unchanged v1 bytes and accepted legacy verifier semantics; v14 uses owner-approved R1 K1 new versioned key reference and authenticated envelope (exact serialization and format-version method **OPEN**), missing/compromised/unavailable key => no trust downgrade. No production key content in signed source or documentation. R1 T1 applies lawful category-bounded retention without inventing durations; E erasure and anti-resurrection must be proven before ledger writes.

## 5. Acceptance suite and reviewer freeze — NOT RUN

1. **Manifest**: automatically compare frozen 32 source queries/labels with v14 candidate Q00–Q36; explicit slot ownership, order, count, MVCC state/profile, deterministic materialization; 37 only if precisely five new sections. Missing/extra slots reject.
2. **C2**: native exact replay 1 observation; two different equal `at_event_insert` signed v14 digests ⇒ one provisional logical event and **two** immutable observations; changed event/actor/owner/UID scheme and same digest contradiction reject all.
3. **v13/V14 lineage**: v13 strict A cross-digest always rejects; v13 carried inside v14 never gets synthetic native UID; `migration_backfill` across distinct digests rejects; clone ancestor vs post-fork events in isolated PG16.
4. **Data integrity**: versioned canonical JSONB/v14 hash vectors with integer bounds, JS precision, timezone and timestamp representations, duplicate JSON keys, missing vs null, arrays, Unicode; reject unsupported rather than coercing. A raw HMAC/source digest alone never proves physical database uniqueness.
5. **Owner/locks**: concurrent import/erase/restore, participant/actor mix, no cross-tenant leak, no dangling observation/sidecar, trigger preservation; real PG16 2-session and Neon HTTP parity, not mocks only.
6. **R1 K1/T1/E**: old-v13 valid under allowlisted eligible verifier; unknown/retired/compromised key fail closed, signed source original unchanged; backup pruning unchanged unless separately approved; legally authorized exceptional erasure cannot be undone by old pre_restore or saved portable backup. No erasure without legal/privacy authorization and non-resurrection proof.
7. **All routes and OFF**: download/automatic/manual/pre_restore/stored-readback/restore/flag OFF preserve both audit ledgers, native mapping, signed observations and all other v13 data; old F9 MAX/delete/unchecked conflict route absent before schema feature release; full backup passes before first ledger write.
8. **Adversarial independent read-only audit** on frozen full SHA and **complete transitive source set**, including `lib/account-backup.ts`, `lib/account-backup-snapshot.ts`, `lib/portable-backup.ts`, `lib/account-backup-presign.ts`, `lib/account-restore-v6.ts`, `lib/db-optimization.ts`, `lib/backup-authenticity.ts`, `lib/verification-signature.ts`, `lib/backup-center.ts`, `lib/privacy-account.ts`, security/certification/currency/auth dependencies, and every V3/V5/V6/V7 design. Previous V3 reviewer `BLOCK — DESIGN ONLY` is NOT cleared by this lead-only proposal.

**Open blockers:** D observation storage granularity/privacy vs independent immutability; exact DB composite constraints and SQL lock strategy; canonicalization scheme/golden vectors; K1 legacy key inventory/compromise review; third-party/regulatory rights and erasure propagation/backup resurrection; precise 37-slot feasible read-only PostgreSQL/Neon HTTP snapshot; signed-v14 transport-vs-native import semantics; source-bound independent reviewer verdict; runtime tests. Until these are resolved **implementation stays blocked**. Do not merge, deploy, migrate, change production DB/flags/keys, delete evidence, touch Training, or claim v14 is implemented.

**ONE NEXT STEP:** freeze a dependency-complete SHA-bound security reviewer package for the proposed V7 observation model and 37-slot candidate, obtain independent read-only DeepSeek/Claude review, and reconcile P0/P1 findings before asking the owner to authorize one small implementation milestone.
