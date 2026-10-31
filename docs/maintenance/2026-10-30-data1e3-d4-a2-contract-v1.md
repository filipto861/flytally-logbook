# DATA-1E3 D4 A2-CONTRACT — safe flight association and full signed-v14 backup (candidate V1)

**STATUS: DESIGN PROPOSAL, NOT OWNER-APPROVED CONTRACT.** Prepared 2026-10-30 after user directed “pokračuj” with the prior A2-CONTRACT design milestone. No migration, executable SQL, runtime feature or release is authorized. This document DOES NOT amend the already owner-approved signed-v13 cross-snapshot Option A policy.

**GitHub provenance:** `filipto861/flytally-logbook`, canonical main `807f281e5870164b794d001480ecc84e0b45aea5`; Draft #451 work branch `docs/logbook-data1e3-d4-a2-provenance-model-20261030` pre-design HEAD `ee2384c4b01c1d27bbea454705a271b6fc3b98a2`, stacked on Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`, frozen executable `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` via Draft #449. Production `fly-tally.com` previous build `55c8076e1eb8104c14392e15b272b33e0eb29607` READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU`; production PostgreSQL schema/flags UNKNOWN. Independent DeepSeek **approved with changes, DESIGN ONLY**, source-reconciled, F-01..F-09; this *new concrete linking/v14 proposal* has **NOT** received a separate external review.

## 1. Reconstructed live code and what it does not provide

| Source @ executable `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` | Source-confirmed behavior | Design consequence |
| --- | --- | --- |
| `lib/db-optimization.ts:39-80` | Native `flight_audit_log.id BIGSERIAL` and AFTER INSERT/UPDATE/DELETE flight triggers; `actor_user_id` is assigned the flight's account user | Native audit remains an independent local trigger record; actor is not proven interactive pilot. Never DELETE/renumber it. |
| `lib/data/flight-audit.ts:8-14` | Native-only account+flight ID query, `LIMIT 100` before projection | Imported source flight ID must never be joined by mere numeric equality. Dual-ledger pagination cannot merge two separately capped lists. |
| `app/(protected)/flights/[id]/audit/page.tsx` | Certified revisions, verifications, approvals and void history have a distinct page/read contract | Material audit provenance is not a replacement for certified history or regulatory evidence. |
| `lib/account-backup.ts:22-66` | Native-only `audit_log`; one read-only `RepeatableRead` snapshot of **32** query results; signed v13 | All future ledger sections must share exactly one consistent point-in-time snapshot. |
| `lib/account-backup-snapshot.ts:44-70` | Expects 32 results (two probes, 30 sections) | New result shape requires explicit versioned validation; missing sections are fatal. |
| `lib/account-backup-presign.ts:32-39` | Requires version **13** | Explicit v14 pre-sign validation and independent v13 compatibility branch required. |
| `lib/portable-backup.ts:124-145,248-263` | `>=13` dispatch currently reuses v13 arrays; verifies SHA-256 digest of serialized payload | Strict dispatch for 13/14; unknown 15+ rejected, no silent missing arrays. Current v13 signature is not source-instance attestation or raw byte-level per-event signature. |
| `lib/backup-authenticity.ts:7-19` | Signs purpose, signature version, backup version, source user and full payload digest | A backup digest proves signed snapshot integrity, not independently verifiable event membership after source deletion. |
| `lib/backup-center.ts:29-53` | `automatic`, `manual`, and `pre_restore` all share backup builder; stored rows compressed and retained by a policy | No imported-ledger writes may be enabled while any automatic/manual/pre_restore backup can successfully sign **incomplete** history. |
| `lib/account-restore-v6.ts:119-155,220-285` | Preview outside authoritative transaction; native MAX-based audit delete at 224/268 and archive insert `ON CONFLICT DO NOTHING` at 269 | Must replace unsafe A2 path; flag OFF/schema missing cannot silently use it. |
| `lib/migration-plan.ts:1-27` | Recorded migration version **21**, not 22 | v22 is a prospective design number only, not an applied/approved migration. |

## 2. Already approved decisions versus pending proposals

**FROZEN / OWNER-APPROVED DESIGN POLICY:**
1. **Signed v13 Option A:** construct snapshot namespace only from validated signed sourceUserId + full snapshot digest; same exact signed snapshot and event may be idempotent only after full equality; two **different** signed-v13 digests asserting the same `source_user_id + source_audit_id` **fail closed even if event bytes match**. No invented source DB identity.
2. Preserve **every genuine independent trigger event and every original archived source event**; no silent merge, broad delete, renumber, overwrite, or source/target account conflation.
3. Option 2 separate immutable imported ledger is an **approved design direction**, not the final approved DDL or runtime behavior.

**PROPOSED — NOT APPROVED HERE:** first-stage unattached historical account view; later optional explicit verified source→destination link; signed v14 with two auditable ledgers and binding section; exact provenance bytes/canonicalization; v14 clone conflict policy; versioned SQL migration v22; rollout gates.

## 3. Minimal first-stage imported ledger / destination association

**Design recommendation F-02:** at first safe release, save imported events as **account-scoped historical evidence, UNATTACHED**. The source `flight_id` is evidence about the original database only. No visible per-flight history association until independently verified. This is the least risky reversible choice; data is not discarded. It is not approval for a UI redesign.

Tentative logical records, **not executable SQL**:

- `imported_flight_audit_events`: generated `local_id` (destination-only); `destination_user_id`; `source_user_id`, `source_flight_id`, `source_audit_id`; `source_format`, `source_backup_digest`, `origin_kind` (v13 snapshot, v14 declared installation lineage, or legacy explicitly unverified); `event_fingerprint`, `canonicalization_version`; `original_event_jsonb`; optional integrity-bound original verified canonical event bytes; `first_import_operation_id`; `imported_at`. All source attributes immutable and separately labelled. Strong bounds, indexes, ownership checks, and DB reject UPDATE/DELETE on immutable rows (except separately authorized audited erasure).
- `imported_event_flight_links` **later, only if approved:** `destination_user_id` and immutable `imported_event_local_id`, `destination_flight_id`, `verification_method`, `source_backup_digest`, `source_flight_fingerprint`, `target_flight_fingerprint`, `verification_operation_id`, `verified_at`, `invalidated_at`/supersession marker. A link is auxiliary and revocable; its invalidation never deletes the original source evidence. No FK from `source_flight_id` to local `flights`; no cascade deletion of historical evidence.
- **Allowed link proof for a later phase (PROPOSAL):** a single authenticated server-side restore transaction that **itself inserted** a target flight from the verified signed source flight record and recorded the exact source→newly inserted target mapping; independently recheck same destination account, source snapshot/flight fingerprint, actual inserted row and certified/void status. A numerical equality on its own, matching route/date/callsign, mere user assertion, or a cloned installation ID do **not** prove association.
- **If target flight already existed, was voided/deleted, or mapping is ambiguous:** leave history unattached, explicitly mark link `UNAVAILABLE/NEEDS VERIFICATION`. Never attach to an unrelated same-number flight. Retention of unattached evidence must be accounted for in every backup.
- A **future** manual link policy is a separate owner product choice: explicit confirmation may express intent but is not independent proof of identity. Do not invent a fallback mapping or auto-create a link.
- Per-account listing should expose truthful category `Imported historical evidence — unattached` and verified-vs-legacy authenticity; do not display source user name as proven actor. `getFlightAudit()` remains native-only until a separate, scoped authenticated query contract is approved; new dual ledger projection must apply account + verified association filters **before** pagination; deterministic cursor uses timestamp + source-kind + stable local key, not bare numeric source id. Protect public/shared routes and avoid N+1 access.

**Owner choice F-02 to obtain:** `L1` stage **unattached-only first (recommended)**, or `L2` include carefully verified atomic-restore-created links in the initial implementation. Neither is yet approved; L2 increases initial migration/export/recovery/query surface.

## 4. Enforce v13 Option A atomically (no silent conflicts)

Potential **logical invariant** for signed v13 in target account: uniqueness over `(destination_user_id, source_user_id, source_audit_id, source_format='signed-v13')` **in addition to** a snapshot-scoped namespace/row uniqueness constraint. In a single server-side transaction, any existing claim with another digest means explicit conflict regardless of matching content. Same-digest match requires exact versioned event comparison, not `ON CONFLICT DO NOTHING`. The unique key must be enforced in PostgreSQL for concurrent independent sessions; do not depend on preflight or a race-prone separate SELECT. Incoming duplicate source IDs within one file must also reject.

The final DDL, exact conflict strategy and cryptographic canonicalization/version remain to be specified and source-tested. A v13 ID cannot be equated with a v14 origin ID or with native destination ID without additional provenance; cross-format equivalence **NOT PROVEN → BLOCK/UNATTACHED**, never silent dedupe. One `SELECT server_import_audit_batch(...)` as a bounded, parameterized, atomic server-side statement/function is a *candidate* for Neon HTTP fixed-batch semantics, not verified implementation.

## 5. v14 backup proposal: exact section semantics and completeness

Version `14` is a **proposed** format; its schema is not frozen and no v14 files currently exist as approved artifacts. Keep signed v13 format, digest, original `audit_log` semantics and existing byte content **unchanged**.

Proposed v14:
- `audit_log`: explicitly still **native `flight_audit_log` records**, unchanged local trigger identity (consistent with v13 semantics).
- `imported_audit_events`: separate complete account-owned archive ledger; original source ID/payload, snapshot/lineage claims, per-event fingerprint, import and truthfulness labels. Re-exporting an imported record must **never** place it in native `audit_log`.
- `imported_event_flight_links`: **required array even if empty** if verified links are supported (if stage L1 disables link feature, define explicit empty section and strict absence-of-links invariant or omit section only under a distinct fixed v14 contract; no implied default). A verified association must survive roundtrip without relying on source/destination numeric IDs; target identity binding validation is an independent gate.
- `origin_lineage` (not attestation): signed source installation/epoch/branch observations and version, clearly distinguisting self-declared source metadata from independently verifiable identity. A copied UUID on a database clone is **not proof of same live installation**. Do not mint a retroactive v13 issuer ID.
- `audit_provenance_version`, `event_hash_algorithm`/`canonicalization_version`, explicit `counts`, bounded arrays and source-import chain binding. Strong per-event fingerprint and inclusion into the *signed v14 top-level payload* are needed; a digest stored alone does not later re-prove that a row was originally in a deleted v13 payload. Retaining whole verified source payload or exact canonical event bytes has privacy/size implications **OPEN** and requires a bounded data-retention choice. No raw keys or private records in logs.
- All normal existing v13 sections remain account-bound and fully validated under their current correct semantics. New metadata/sections are included inside the same signed payload, not left unsigned. `schema_version` and `backup.version` are independent and must never be conflated.

**Snapshot hard gate:** new v14 builder must read both ledgers and any link/lineage rows in **one readonly RepeatableRead MVCC transaction** with matching before+after snapshot probes. The current 32-result validator must be replaced/extended with an **explicit version-specific exact section count/order** (not a permissive `>=13` assumption), with declared count equality and every tenant-scoped row present. If snapshot validation or version-specific pre-sign validation fails, **do not create a signed file**. Never fall back to separate SELECTs.

**Required production pathways:** user download/export; stored `automatic`, `manual`, `pre_restore`; decompression/readback/verification and restore; any data-admin or retention action touching backup contents. **Safety dependency:** even if ledger importer is OFF, a successful backup must not silently omit existing imported rows. New imported-ledger **writes MUST remain OFF** until all backup paths can create, verify and restore full v14; an incomplete `pre_restore` backup is a fatal stop **before any main restore mutation**.

**Dispatch rules:** explicit v5–v11 legacy handling (version-specific evidence); v12 trust behavior source-backed, not universally “unsigned”; signed v13 remains valid under its real signature rule and approved policy A; signed v14 gets its own complete parser, counts, sections and crypto; unknown v15+ **fail closed** (no v13 fallback). Missing schema/flags or unsupported format cannot silently reach old F9 destructive path.

## 6. v14 native same-origin / clone roundtrip

A signed `source_instance_id` may identify a **claimed** installation namespace but cannot alone prove uniqueness when databases are cloned. An origin lineage must be treated as *proven only to its supported level*; never call it independent physical database attestation.

- **Same local destination with exact verified native row:** do not manufacture another native entry; compare immutable event identity, fingerprint, account ownership and relevant source lineage before classifying identical. No `ON CONFLICT DO NOTHING` without equality.
- **Destination with no matching local native record:** importing source-native v14 evidence must preserve it as **imported historical evidence**, not overwrite local native IDs; do not treat missing as zero. If origin/clone equivalence is ambiguous, fail closed or retain as explicitly distinct unattached source claim under an owner-approved scheme. No silent relabeling.
- **Same claimed installation ID, same original ID, different bytes:** clone/divergent history **CONFLICT → abort**. A copied installation UUID with distinct local IDs can still be ambiguous; mark origin equivalence unverified, never infer same event merely from timestamp/content.
- **Imported→v14→imported:** preserve exact immutable source identity, backup chain/evidence and source kind, not “native from the destination”; if original source membership proof is not retained, represent it as `snapshot-verified at import`, not later independently verified against a deleted original.
- v14 installation ID generation/rotation, key retention, clone/restore fork detection and no-privileged writes need independent schema/security review. No claim that current code implements any v14 provenance.

## 7. Acceptance matrix (proposed tests, ALL NOT RUN)

| ID | Mandatory failure/success scenario | Must prove |
| --- | --- | --- |
| **A2-C01** | Genuine signed-v13 original with source audit ID equal to a local native audit ID | Both original and genuine destination trigger event survive in separate ledgers, no deletion, no invented same-flight link |
| **A2-C02** | Two different signed v13 digests overlapping same source account + audit ID, identical AND mismatched event payload | Whole main restore **fails** for both, including identical; no suppressed event; no partial transaction |
| **A2-C03** | Exact same signed snapshot imported twice + one event differing under same digest | Exact same → truthful no-op; mismatch → all rollback |
| **A2-C04** | Native flight append after preview and during another session's restore; two concurrent identical/mismatched archive imports | Trigger survives; uniqueness + full event compare inside one transaction; clean count/rollback without `MAX auditFloor` or broad DELETE |
| **A2-C05** | Original source `flight_id` equals existing unrelated, voided, deleted and other-user destination ID | All remain account-unattached; never cross-owner or automatically link |
| **A2-C06** | Optional later verified mapping from exact same atomic source flight insert, plus user-suggested/route-equal but unverified target | Only strong validated mapping may link if L2 separately approved; no cascade; invalidation preserves event |
| **A2-C07** | v14 nonempty native+imported+links one-snapshot backup, signed and loaded through downloaded/automatic/manual/pre_restore routes | Same account, consistent snapshot, complete section counts, strict parser/presign, correct readback and reconstructable evidence |
| **A2-C08** | One missing v14 section, malformed row, wrong count, bad signature, altered event hash, unknown v15, schema unavailable or flag OFF | Fail closed without any signed incomplete backup or unsafe restore fallback |
| **A2-C09** | Same-database v14 roundtrip; cloned ID diverges; imported ledger is re-exported | No double native events; clone conflict abort; imported always remains imported |
| **A2-C10** | Cross-tenant account/actor/state and paginated native+imported >100; database-level direct UPDATE/DELETE against imported ledger | No leaks, no misleading pilot actor, stable cursor, immutable event rejects updates/deletes (authorized privacy erase separated) |
| **A2-C11** | Existing v5–v13 fixtures, certified/voided/shared history, FSTD, GPS, currency, A1 races | No weaker legacy/security contracts, no missing evidence, no altered certification |
| **A2-C12** | Large synthetic audit counts, Neon HTTP bounded read and fixed write transaction, raw-byte fidelity, key rotation | PASS on explicitly identified isolated PG16 first; actual provider HTTP separately evidenced, unsupported size/version rejects |

Do **not** treat the matrix as executed tests. Candidate-bound risk planner must select corresponding targeted test files and controlled isolated PG16 cluster under `DEVELOPMENT.md`; source/Node/TypeScript/build/browser/Neon follow changed-surface risk evidence. No destructive remote SQL.

## 8. Sequence, acceptance and explicit DO NOT

1. **This A2-CONTRACT draft (NOW):** source-grounded candidate and open owner decision L1/L2, v14 integrity/lineage contract, remaining P1 privacy/evidence questions. Docs only. **NOT DONE / not frozen**.
2. **Owner review:** decide L1 unattached first (recommended) versus L2 verified atomic-create linking in initial release; separately decide whether to retain exact source event canonical bytes with bounded privacy/retention. v14 clone semantics may require another independent read-only reviewer because this design adds materially new details after DeepSeek's earlier report.
3. **Future implementation design (separate explicit authorization):** additive migration v22 proposal with privileges/indexes/constraints and backout gates, strict dual-ledger backup format completed first, no unsafe flag-OFF F9 fallback, atomic import transaction and test plan. Do not alter native trigger, certification or user flights outside scoped minimal patch.
4. **Future isolated tests:** materialize immutable candidate source; targeted Node and local PG16 real two-session races; repeatable-read snapshots; Neon HTTP parity; TypeScript/build; selected authenticated recovery and responsive UX only if UI changed. Actual counts/results are **NOT RUN** now.
5. **Future merge / DB migration / flags / deploy:** four separately authorized operations, never inferred from design, test success or user saying “pokračuj”. Production schema/flags UNKNOWN, production prior READY not proof of draft runtime.

**DO NOT:** access or mutate production/Shadow Neon's DB; delete stored backups; mix Training; invent signed-v13 source installation IDs; create automatic mappings from numeric flight IDs; reassign archived actions to destination pilot; ship signed incomplete safety backups; infer v14 cryptographic membership from a standalone stored source digest.

**ONE NEXT STEP:** owner decides **L1 vs L2** for the first A2 implementation scope (recommend **L1: unattached-only**). That authorizes a product-policy direction only; then finalize the frozen v14 and provenance/retention contract and schedule targeted implementation approval separately.
