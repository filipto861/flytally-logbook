# M0-B B0 — audit-safe account restoration: contract v1 (DESIGN ONLY)

**Date:** 2026-11-02 UTC. **Repository:** filipto861/flytally-logbook. **Baseline:** main `c9c2f60303236113a223942072311f5e37f876f7`; Draft PR #454, work branch `docs/logbook-m0b-discovery-20261102` (recheck current work SHA). **Runtime:** M0-A Vercel READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, code SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`.

**Authorization boundary:** Owner accepted the D1–D3 **direction and B0 design work** by replying `ok pokracuj` to those recommendations. This approves *design and evidence planning*, not application/SQL/schema implementation, migrations, merge, deploy, production restore or feature flag changes. Detailed issuer/identity and retention choices below remain OPEN. M0-A full restore block must remain active. Previous owner instruction to skip second-AI review for M0-A is respected; no second-AI run here.

## 1. Frozen direction versus open decisions

| ID | B0 direction adopted | Fine-grained blocker, not assumed approved |
| --- | --- | --- |
| **D1 trust** | First writable full-account restore targets same authenticated account with valid, verifiable signed backup, strict version/digest/relationships and exact target-account authority; unsigned older formats remain inspect/preview-only. | An integer `profile.id` and v13 signature do NOT establish source-instance identity; disaster recovery with changed account IDs, key rotation, signing issuer trust, stored backup equivalence and unsigned data policy must be proven/frozen separately. If not proven, `UNAVAILABLE` before any write. |
| **D2 provenance** | Dedicated append-only imported audit ledger is the architectural baseline; retain genuine native `flight_audit_log` trigger rows, introduce distinct versioned signed v14 design with complete history. | Specific schema v22 DDL, provenance namespace, per-event membership attestation, duplicate semantics and v14 wire format are unimplemented and not yet frozen. |
| **D3 activation** | Implement/verify in small batches with M0-A full restore OFF throughout. Require separate owner approvals for migration, deploy and any eventual restore activation; no ON-by-default behavior. | Exact environment / flag strategy / rollback / compatibility must be checked before implementation. A test-only code path must not be a production bypass of M0-A. |

## 2. Current contract and source hazard matrix

- **Entrypoints:** `app/(protected)/export/actions.ts:66-98` rejects restore intents for both upload and stored backups, and preserves preview plus individual-flight Trash. `lib/account-restore-v6.ts:221-223` and legacy action use `blockFullAccountRestore()`. Do not remove or weaken these guards during B1–B3.
- **Identity:** `lib/account-restore-v6.ts:48-86,120-215` computes preview and classifications outside transaction. Same numeric source ID can be interpreted as already existing without validating full identity. The dormant executor inserts flight/FSTD parents with `ON CONFLICT DO NOTHING`, then updates rows by raw ID; this must never run again unchanged.
- **Audit:** `lib/db-optimization.ts:39-80` defines `flight_audit_log.id BIGSERIAL` with trigger generated local events; `lib/account-restore-v6.ts:227,269-270` reads global MAX outside transaction, DELETEs new trigger events by ID floor and inserts archived IDs with `ON CONFLICT DO NOTHING`. Deletion is forbidden; local ID never equals provenance identity.
- **Export:** `lib/account-backup.ts:13-52` assembles signed v13 through independently issued `Promise.all` queries; main has no common explicit consistent repeatable-read snapshot, even though prior unmerged DATA-1 drafts propose one. A cryptographic signature on inconsistent data does not make it a coherent point-in-time backup.
- **Trust:** `lib/backup-authenticity.ts` signs `(version, sourceUserId, payload SHA-256)`; `lib/portable-backup.ts:133-144,248-264` dispatches versions `>=13` to v13 structure and validates some ownership/relations. Neither authenticates a stable source-database instance ID or historical cross-backup event linkage.
- **Sharing:** Account-owned active flights and participant evidence have different owners/meaning. `flight_participations`, `flight_verifications`, `instructor_flight_approvals`, `flight_source_provenance`, connection events and independent participant copies must not become claims approved by a different user.
- **Protected history:** `flight_certified_revisions`, `fstd_certified_revisions`, voided certified tombstones, archived verification/items, GPS/expenses and recency inputs require exact cross-record linking. A tombstone must not be converted to active flight and no signed certification may be fabricated or silently rewritten.
- **Provider:** `lib/db.ts` uses Neon HTTP in production; `lib/local-postgres.ts` is a distinct owned local test adapter. Reuse of a fixed query batch, not interactive JS branching inside a transaction, is the proven starting interface; SQL assertion and concurrency semantics need actual Neon HTTP tests.

## 3. Proposed invariants / API state machine

**Step PREVIEW_READONLY:** Authenticate and authorize target account; bound input bytes before parse/decompression; reject unsupported version / malformed counts / dangling relations / invalid hashes; verify signature with supported trust policy; classify `verified`, `legacy-unverified`, `invalid` and `ambiguous-origin` separately. No preview result authorizes commit. No implicit user mapping. Report `add / existing-identical / blocked-conflict / withheld / needs-configuration` without claiming the eventual inserted count.

**Step ELIGIBILITY:** Writable mode ONLY if D1 evidence binds source and destination to the same authenticated identity by a mechanism stronger than a coincident numerical `user_id`; if an identity claim cannot be cryptographically/authenticated and explicitly linked, return `UNAVAILABLE`. A signed v13 with same numeric ID but different/unknown origin is *not* sufficient. Version-specific parser must reject future v15+ until supported, never interpret them as v13. Historic signatures remain verified only for the exact unchanged payload/recognized key version; key rotation/issuer unknown => fail closed.

**Step SAFETY_SNAPSHOT:** Before any main restore write, require a **complete**, stored and verifiably signed pre-restore snapshot that includes **both** native and imported history. It must be a single consistent account read snapshot; sign only after full structural, relationship and row-count validation. Store it in a separate durable operation. It may remain if main restore rolls back, with truthful status and retention; pruning must not silently eliminate the only recovery copy. Unimplemented snapshot consistency or missing schema => no restore.

**Step ATOMIC_COMMIT:** Transaction revalidates the current target state; unique/foreign/account/void/certification invariants must be checked under atomic DB constraints/SQL or proven locking. Preview-side reads are advisory only. One transaction inserts exact permitted parent/child records and append-only **imported** evidence; never `MAX(id)` cleanup, DELETE native audit or globally import source audit primary IDs. Any mismatch yields single atomic rollback. No wrong-parent `UPDATE`, and no `ON CONFLICT DO NOTHING` for protected or ambiguous identity.

**Step RESULT:** Return status derived from actual transaction effects and commit confirmation, never optimistic preflight numbers. On ambiguous connection/commit result return `NEEDS RECONCILIATION` with an idempotent operation ID rather than claiming success or retrying mutations blindly. Distinguish imported historical evidence from newly triggered local events, verified identical existing data and deliberately withheld cross-account evidence.

**M0-A compatibility:** Existing complete-restore server actions/writers MUST continue rejecting all restore intents throughout B1–B3, regardless of new schema availability, test data or optional flags. No hidden environment override or data-path fallback. Backup create/check/download and single-flight Trash remain supported.

## 4. Proposed provenance and signed backup protocol

**Separate audit model:** Keep `flight_audit_log` untouched as the native, trigger-written ledger. An additive new table (name/DDL NOT frozen, candidate `imported_flight_audit_events`) uses new destination local PK, target user ID, original source account + audit ID, signed backup version/digest, claimed origin namespace / assurance, original full event, canonical fingerprint, restore operation ID and timestamp. Immutable application contract; prevent UPDATE/DELETE for imported records through proven DB permissions/constraints. Cross-tenant authorisation on every read/write.

**v13:** A signed snapshot digest is a whole-payload commitment; it does not prove origin-instance identity across snapshots or, if the signed payload is discarded, independently prove that a later stored row was a member. Design-only prior owner Option A from Draft #451: same signed v13 digest replay may skip an imported event ONLY after complete original-event equality; any different signed-v13 digest claiming same source account + source audit ID => conflict **even when event content is equal**. This does not imply the two backups truly share a source instance. A reliable membership proof requires retained authenticated payload or a newly supported per-event commitment/proof; decide retention, size, privacy and key rotation before B2.

**v14:** Introduce explicit protocol v14 with separate `native_audit` and `imported_audit` sections (field names provisional) and strictly versioned required sections, counts, ownership, hashes/signatures, canonical event encoding, issuer/namespace metadata (when verifiable), origin assurances and complete provenance. Both ledgers must be read in ONE read-only repeatable-read snapshot, shared with every protected relationship and profile row. Current v13 signed payloads are never modified/resigned; stored, downloadable, automatic and `pre_restore` paths must all emit/verify a complete format after imported-history activation. Unknown formats reject; missing v22-like schema rejects rather than silently signing an incomplete v13.

**Truthfulness:** Trigger rows produced by restoration are local DB events; the current trigger attributes `actor_user_id=NEW.user_id`. Do not display this as a pilot's conscious edit. Mixed audit view must distinguish `native event` from `imported historical evidence` with separate authentication assurance. `lib/data/flight-audit.ts` currently limits native-only 100 rows; future dual-source read must account-scope both feeds before pagination and use stable ordering. Regulatory CURRENT/approved status is never inferred from imported audit history alone.

## 5. Concurrency and rollback acceptance sketch (not executable SQL)

**T1 — two independent flight restores:** Session A and B preview same missing flight. A enters atomic commit first. B must revalidate within its transaction and either prove exact already-present identical event/account mapping or reject. It may not silently skip parent insertion then update A's unrelated flight via backup source ID.

**T2 — native event between preview and commit:** A previews, another session modifies a flight, generating a native audit event. A restores independently. Both native events and original archived source event must persist; nothing may be deleted by global sequence range or guessed `xmin`/time boundaries. Same-account conflict on changed certified state must abort.

**T3 — same source audit ID from distinct signed snapshots:** If digest differs (v13 rule), the entire restore fails before any history append, even if the serialized fields look equal. Exact same signed digest replay requires full immutable field equality, authorized source binding and unique/conflict checks inside the transaction.

**T4 — failure during multi-section insert:** Force error after parents and before protected children; all main restore writes and generated native trigger entries from that transaction roll back, while independent existing audit records remain. Previously persisted `pre_restore` backup remains intact, and error message describes main rollback without pretending safety backup rolled back.

**T5 — ambiguous commit result:** If network fails after server commits but before client receives confirmation, read-only operation reconciliation must determine actual effects using durable operation identity. Do not retry an unbounded destructive batch based on optimistic expected row counts.

All transaction plans are conditional on real PostgreSQL16 and Neon HTTP fixed-batch/transaction compatibility evidence; do not infer production parity from a local adapter.

## 6. Implementation slices proposed after this B0 contract

| Slice | Scope | Acceptance | Restriction |
| --- | --- | --- | --- |
| B1a | Source-backed strict parent-ID and natural-key conflict preflight/transaction tests; small corrected domain helper or SQL gate only if separately authorized | Two-session owned-PG16 parent/FSTD collision and whole rollback, unrelated owner and cert hashes preserved | M0-A remains fail closed; no schema or public writer enablement |
| B1b | Protected children, archival void, shared evidence, GPS/expense ownership and actual committed counts | Mixed account/void/certification tests and Neon HTTP parity for each accepted write pattern | No field/ID silent remap |
| B2a | Account-consistent read-only snapshot and pre-sign integrity, version-specific v13 compatibility | Concurrent writer, snapshot coherence, known/unknown/invalid backup negative tests | No imported ledger/restore activation yet |
| B2b | Additive provenance ledger design and v14 protocol/retention approval, then isolated migration and export/read | Real PG16 & Neon HTTP tests, cross-digest, key rotation, v14 roundtrip | Separate schema and deployment approvals |
| B3 | Full atomic orchestrator behind M0-A, honest operation state/counters | End-to-end authenticated synthetic PostgreSQL16 / Neon HTTP risk gates and rollback | No route/flag bypass |
| B4 | Explicit owner release decisions | Exact candidate risk release; stage/prod migration/flag/rollback plan and prod authenticated smoke | No production action from B0 approval |

## 7. Test and decision register

Acceptance cases originate from `2026-11-02-m0b-safe-account-recovery-discovery.md` 17-scenario matrix. For each B1–B3 candidate require both positive and negative cases, two independently verified PG16-owned loopback instances/sessions as appropriate, valid signed/invalid/unknown/legacy version combinations, same/different source digest, exact/changed protected hashes, voided active conflict, native+imported audit/no DELETE, mixed snapshots, foreign account, abort/commit ambiguity, and complete pre_restore backup. Node/TS/PG16/build/browser/Neon HTTP outcomes **NOT RUN** at this B0 design SHA; no synthetic test PASS asserted.

### Deferred owner/engineering blockers (must resolve before executable migrations)

- **X1 issuer identity:** how to authenticate same logical account across databases, signing-key rotation and cloned installations; v13 has no source instance ID. If unknowable, restore must be UNAVAILABLE for those cases.
- **X2 archival proof retention:** retain whole signed v13 envelope versus materialized event-level cryptographic proof for future review; define cost, retention, user deletion/privacy, access control and never overclaim event membership.
- **X3 exact v14 schema/protocol:** column types/indices/immutability constraints, origin key uniqueness, canonical JSON/timestamps/numeric, version dispatch, source-signature verification, dual-ledger serialization.
- **X4 Neon transaction:** which SQL assertion/row lock/unique constraint sequence can be executed atomically in production HTTP fixed-batch. Prove safe under at least two real sessions and at critical snapshot/collision boundaries.
- **X5 activation:** if a schema/flag is absent or malformed, M0-A must continue rejecting full account restore without a legacy fallback. Separate explicit owner permission for any production target/migration/flag change.
- **X6 legacy fidelity:** older unsigned v4–v11/v12, changed account IDs and external participant approvals remain preview-only until independent source-backed eligibility and policy are frozen.

**Files/reviews:** Design draws on current main `lib/account-restore-v6.ts`, `lib/account-backup.ts`, `lib/portable-backup.ts`, `lib/backup-authenticity.ts`, `lib/db-optimization.ts`, `lib/data/flight-audit.ts`, `app/(protected)/export/actions.ts`; unmerged Draft #448 and #451 are historical proposals only. No second-AI review carried out here; owner may separately authorize it but it is not a release gate override.

**TEST / DB / DEPLOY:** No M0-B executable changes and no newly run tests. PostgreSQL/Neon/TypeScript/browser/build NOT RUN. Prod DB/schema/flags UNKNOWN. Main M0-A deployment remains READY; no production migration/restore/delete/flags/Training changes.

**ONE NEXT STEP:** choose the first **B1a strict parent identity and two-session regression** as a scoped implementation proposal from verified main, with M0-A guard unchanged; obtain explicit owner implementation authorization before executable edits, then run only the candidate-selected exact-SHA tests.
