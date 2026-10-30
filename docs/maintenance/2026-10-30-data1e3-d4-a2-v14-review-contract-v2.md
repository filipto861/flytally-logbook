# FlyTally D4 A2 — v14 N2/R1 contract for independent review (V2)

**2026-10-30 — DESIGN-ONLY REVIEW CANDIDATE; not executable or approved DDL.**

Repository `filipto861/flytally-logbook`. Verified main `807f281e5870164b794d001480ecc84e0b45aea5`, executable A1 source `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` in stacked Draft PR #449; Draft #451 parent `8a874a3f7c3488f15fb59cbdc10aa4c79fadaa6b` on Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. Actual PR #451 review HEAD must be checked after the docs checkpoint. Production Vercel READY previous build `55c8076e1eb8104c14392e15b272b33e0eb29607`; DB/schema/flags UNKNOWN.

## Owner-approved DESIGN directions (only)

- **Option 2:** separate append-only imported audit evidence from existing native `flight_audit_log`; preserve all real native trigger events and original signed archive evidence.
- **v13 A:** two distinct valid signed v13 payload digests asserting the same source user + source audit ID **fail closed**, even if full event content matches. Exact identical signed snapshot replay can be idempotent only after full equality check.
- **L1:** imported history remains account-scoped and **unattached** to any destination flight; numeric source flight ID, matching dates and account UI assertions are not association proof.
- **N2:** direction to assign a stable random UUID to each natively generated audit event without changing its existing numeric `BIGSERIAL id`. Historical UID assigned during migration must be labelled migration-time, not retrospectively original.
- **R1:** retain immutable original event JSONB, versioned canonical event fingerprint, source signed snapshot digest and import-verification claim. Do not duplicate the entire original backup by default; once the original signed file is unavailable, independent original-event membership verification is **UNAVAILABLE**.

These direction approvals do **not** approve specific column names, migration v22, backfill, implemented behavior, v14 format activation, DB actions, flags, merge or deploy.

## Verified source anchors

- `lib/db-optimization.ts:39-80`: native BIGSERIAL flight audit and automatic triggers; actor ID is the account owner, not independently proven human editor.
- `lib/account-backup.ts:22-67`: signed v13 with `audit_log` from native-only `SELECT *`, one read-only repeatable-read 32-result snapshot.
- `lib/account-backup-snapshot.ts:44-70`: exactly 32 results, two matching MVCC probes, 30 account SELECTs.
- `lib/account-backup-presign.ts:32-39`: requires version===13; `lib/portable-backup.ts:124-145,248-263`: version>=13 currently takes v13 sections.
- `lib/backup-authenticity.ts:7-20`: source user and whole serialized payload digest signed; no authenticated database-instance identity or independently verifiable row inclusion after file deletion.
- `lib/account-backup.ts:31` and `lib/account-restore-v6.ts:269`: legacy `SELECT *` and `json_populate_record(NULL::flight_audit_log,...) ` are sensitive to schema shape and default UUID handling.
- `lib/account-restore-v6.ts:224,268-269`: existing MAX-audit, native audit DELETE and `ON CONFLICT DO NOTHING` are NOT acceptable as the new A2 restore.
- `lib/backup-center.ts:13-56`: automatic/manual/pre_restore stored backups and existing automatic pruning; `lib/data/flight-audit.ts:8-14`: native-only account-flight query LIMIT 100.
- `lib/migration-plan.ts:1-27`: schema version 21, not proposed v22.

## Proposed N2 event UID contract — needs independent challenge

Native `flight_audit_log.id` stays the local PK; future events get immutable generated `event_uid` (UUID, random with unique constraint), `uid_assignment_kind=at_event_insert`, and independent assignment metadata. Prior untagged events may get `event_uid` through a verified migration-only backfill, `uid_assignment_kind=migration_backfill`, with original action, actor, flight, date, old/new JSON, original ID left unchanged. Backfill UID does not authenticate the original event time or origin. No implicit zero/null replacement. Do not assume UUID default applies to `INSERT ... SELECT (json_populate_record(...)).*` with explicit null columns.

Two databases cloned after UID issuance copy identical ancestor UUIDs; independently added subsequent events should receive distinct random UIDs even if the numeric PK is reused. A copied installation UUID is a lineage claim and cannot prove same physical database. Same UID with conflicting event content or owner => atomic conflict. Prior histories separately backfilled after cloning do NOT become equivalent merely because dates/content/numeric IDs align. A malicious clone or key compromise is not ruled out by random UUID. A **sidecar UID table** is an explicit reviewer alternative to changing the native audit row shape; judge blast radius against data integrity, legacy restore and trigger preservation.

**Design hard gate:** before any native-column addition, demonstrate v13 read/export and restore under new schema including signature validity, legacy `json_populate_record` compatibility, trigger generation during backfill, unique/immutability constraints and ownership. If no safe backward-compatible sequence exists, do NOT apply v22.

## Proposed R1 evidence-level contract

At import, parse and positively verify the signed source snapshot while complete file exists; authenticate account, validate source event membership, tenant ownership, action/actor and original ID. Store event original data plus signed-snapshot digest, signed source user, source format/version, canonicalization version, deterministic hash and import operation evidence. The source event remains immutable even after re-export via v14; the wrapping v14 digest is new observation evidence, **not** the original source identity.

Distinguish:
1. `source_signature_verified_at_import`: an importer validated source signed snapshot, not a persistent self-contained row inclusion proof.
2. `stored_event_hash_valid`: current stored JSONB matches versioned canonical fingerprint, not independent source certification.
3. `independently_recheck_source_membership`: **UNAVAILABLE** without retained original signed archive or a separately reviewed event-inclusion proof.

Canonical hash must be versioned and domain-separated: precise JSON numeric precision, timezone normalization, missing versus null, arrays, key ordering, duplicate keys and JS/PostgreSQL JSONB conversion must be defined with test vectors. Fail closed on unsupported source representation. R1 must not preserve extra unbounded raw backups/PII or modify current stored backup prune policy by implication. Explicit exceptional legal erasure needs separately authorized audited mechanism; normal imported-ledger UPDATE/DELETE denied.

## Proposed v14 first-release archive and strict L1 semantics

**Wire version 14 only after separate approval; preserve signed-v13 original format verbatim.** Required sections: every current v13 required data array and profile, native `audit_log` (NEVER imported rows), separate `imported_audit_events`, explicit `imported_event_flight_links: []` with count 0 under L1, owner-scoped `origin_lineage` metadata clearly labelled as declared/derived (not independent physical attestation), canonicalization/UID scheme versions, exact array counts, format and signature envelope. Nonempty links under L1 must REJECT, not silently drop.

**Candidate versioned 35-result MVCC layout:** existing 30 account data SELECTs + `imported_audit_events` owner-scoped SELECT + an explicit zero-row L1 link SELECT + one-row owner-scoped lineage SELECT + two matching transaction probes = 35. That count only applies if the final query array has these exact slots; it remains UNTESTED. Validate isolation `RepeatableRead`, read-only, same snapshot probe before/after, all account arrays/counts and one profile before signing. No independent-SELECT fallback.

Explicit parser dispatch version 13 vs version 14; unknown 15+ rejects. V14 pre-sign independently checks new arrays, ownership, hash, native event UID, source metadata, empty links, protected certified/voided/shared/FSTD/GPS/monetary evidence; never produce an apparently signed incomplete backup. Key/version rotation must not silently treat invalid signature as unsigned trusted.

Every download/export, automatic/manual/pre_restore stored backup, stored readback/decompression and restore must preserve **both** ledgers. Complete v14 backup and recovery functionality must precede the first imported event write. Even with imported writes flag OFF, if imported rows already exist, native-only v13 backups are forbidden. Failure to create complete `pre_restore` stops main restore. Do not use old audit MAX/DELETE/ON CONFLICT F9 route as fallback.

## Import, concurrency, recovery and isolation

Authenticated destination owner and source trust; all critical equality/identity checks DB-enforced in ONE atomic main transaction. Signed v13 cross-digest overlap guard must be concurrent-safe and compare exact event contents before accepting same-snapshot replay. All new native trigger rows survive. Independent second writer after preview is never “cleaned up.” Commit reports actual inserts/identical matches, not preview estimates. Neon HTTP fixed-queries transaction must use a proven atomic DB operation for conditional decisions; never assume interactive application-level transactions from `sql.transaction(queries)`.

L1 imported records remain account-scoped unattached. Foreign-user flight IDs, voided/deleted ID reuse and numeric matches never confer a link or certification credit. Native and imported histories remain distinct; account-scoped visibility and append-only DB constraints plus auditable exceptional erase needed before release. v14 native↔imported roundtrip must retain source kind, original v13 digest and proof tier, without duplicates/overwrites.

## Candidate acceptance gates — ALL NOT RUN

| Test | Necessary result |
| --- | --- |
| N2-1 | New native events receive immutable unique UUID; old numeric ID and trigger events unchanged; historical backfill correctly labelled |
| N2-2 | Same ancestor clone UID and distinct independently generated post-clone UIDs; conflicting same UID/owner fails |
| N2-3 | v13 signed original remains valid after added schema; explicit null/default `json_populate_record` cannot break safe restore |
| R1-1 | Same valid signed v13 digest exact replay idempotent; different digests overlapping source ID (equal/different data) abort |
| R1-2 | Canonical event hash vectors survive JSONB/JS number, time, null/missing and key-order changes; invalid cases reject |
| R1-3 | Without retained signed source file, UI/API honestly label per-row inclusion re-verification UNAVAILABLE |
| V14-1 | Complete nonempty native+imported and explicit empty link; single MVCC snapshot exact validated slot manifest |
| V14-2 | Missing/extra/over-limit sections, wrong account/count, wrong signature, unknown v15 or missing lineage fail closed |
| V14-3 | Automatic/manual/pre_restore/download/readback roundtrip recovers both ledgers; failed main restore retains pre_restore |
| V14-4 | Two real isolated PG16 concurrent sessions and verified Neon HTTP behavior preserve every trigger event, full rollback/counts |
| V14-5 | Cross-account leak, unauthorized UPDATE/DELETE, cloned-database divergence, native/imported v14 roundtrip reject/behave safely |
| V14-6 | Schema absent/flag OFF with imported history cannot create incomplete backups or call unsafe legacy F9 |

**All new A2 PG16/Neon/Node/TS/build/Playwright tests NOT RUN. No executable code or migration implemented.** Prior limited A1 PG16 PASS is for a different exact SHA and scope.

## Remaining review questions and release hard stops

Independent reviewer must assess (1) N2 native-column vs sidecar choice and migration effects; (2) historical UID origin honesty and clone counterexample; (3) R1 truthful evidence limits and immutable retention; (4) exact 35-slot v14 snapshot and all backup paths; (5) atomic tenant-bound uniqueness under Neon HTTP, missing-schema/flag OFF and source/target ID separation; (6) smallest versioned additive migration and rollback/legacy path. Reviewer verdict is DESIGN ONLY and does not approve implementation.

**DO NOT:** touch production/remote DB or Training, delete backups, apply v22, modify flags/trigger/runtime, merge, deploy or infer v14 READY.

**ONE NEXT STEP:** submit this exact reviewed design and complete frozen executable source to one independent read-only DeepSeek/Claude reviewer; reconcile findings before a separate request for a small implementation milestone.
