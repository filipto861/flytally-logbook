# DATA-1E3 D4 A2 — v13 cross-snapshot identity and deduplication policy

**Status: DRAFT / OWNER DECISION REQUIRED — DESIGN ONLY.** Proposed following independent DeepSeek review `APPROVE WITH CHANGES` on 2026-10-30. This is not an approved schema, deployed behavior, migration, release, or verification result. Existing signed v13 files remain immutable and must not be re-signed.

## Problem / proof limit

v13 signed backup authenticator binds `purpose + signatureVersion + backupVersion + sourceUserId + SHA256(JSON.stringify(payload))` (`lib/backup-authenticity.ts:7-19` and `lib/portable-backup.ts:248-254`). It **does not sign a source database instance identity**. Therefore `source_user_id + source_audit_id`, even with matching `event_fingerprint`, cannot establish that records from two **different** backup digests represent one genuine event. Clones, sequence resets and distinct database identities remain indistinguishable. Equivalence cannot be inferred from identical content.

### Recommended safety-first rule

- **Origin namespace for v13** = `signed-v13:<sourceUserId>:<fullVerifiedPayloadDigest>` as an *observation/snapshot namespace*, not an issuer or database-instance proof. Namespace generated on server after positive signature validation and account authorization; never client-assigned.
- **Original source data immutable:** preserve full original `source_audit_id`, `source_flight_id`, actor/action/timestamps/old/new JSON and source user evidence, without rewriting native audit IDs. `local_id` is only destination storage identity.
- **Exact signed file replay** (same authenticated digest, same source ID and identical versioned event representation): **IDEMPOTENT NO-OP** for that event; differing content under the same digest is corruption/conflict → **atomic reject**. Backups must be completely validated; no silent skip.
- **Different authenticated v13 digests, overlapping `source_user_id + source_audit_id`, equal event content:** **NEEDS REVIEW / REJECT the entire main restore** under recommended first implementation. Do not conflate two potentially independent real events, do not insert duplicates, and do not silently count a skip. A separately auditable snapshot-observation record may be considered later, but **it must not assert equivalence**.
- **Different digests, overlapping source ID, differing content:** **CONFLICT / REJECT the entire main restore**. Never rewrite old evidence or keep whichever happened to insert first.
- **Different digests with no overlapping original audit identity:** may insert newly evidenced events under distinct snapshot namespaces after signature, ownership, source-event validation, native/flight identity checks and one atomic commit. This does not authenticate a source database instance.
- **Different source users:** treat source account identity and target-account authorization as distinct checks. Never join/import data across tenant boundaries because numeric IDs happen to match.
- **No automatic destination flight link:** source `flight_id` is archival evidence only; if a safe account-scoped verified link is unavailable, store/display imported history as **unattached/orphan** rather than under a numeric-matching local flight.
- **No blind uniqueness merge:** `UNIQUE(destination_user_id,origin_namespace,source_audit_id)` is necessary for exact snapshot replay, but not sufficient for the cross-digest overlap rule. A separate transaction-enforced cross-snapshot collision guard/index/policy must cover all existing source claims for the authorized destination and sourceUser+sourceAuditId (and avoid all concurrency gaps). Exact SQL function and indexing remain unimplemented.
- **Safety:** never DELETE, disable or renumber native trigger history; `pre_restore` must be a complete signed backup containing both ledgers before any ledger import is enabled; missing schema/flag or unsupported version → BLOCK rather than the current unsafe F9 fallback. Positive v13 verification/immutable backup bytes only, no invented historical instance IDs.

## Expected outcome matrix (proposed, NOT RUN)

| Condition | Decision | Consequence |
| --- | --- | --- |
| First complete valid signed-v13 restore with no overlap | ALLOW if all other guards pass | New imported records, native untouched |
| Same full verified digest and original event | IDENTICAL only after exact event comparison | Idempotent no-op, truthful counts |
| Same digest but altered event bytes/meaning | BLOCK | Full main transaction rollback |
| Different digest, disjoint source audit IDs | ALLOW subject to all other guards | Distinct snapshot observations |
| Different digest, same sourceUser+sourceAuditId, same canonical content | **BLOCK / NEEDS REVIEW** | No false equivalence or duplicate |
| Different digest, same sourceUser+sourceAuditId, different content | **BLOCK / CONFLICT** | No overwritten source record |
| Missing/invalid signature, unknown v15+, ambiguous source identity | BLOCK | No trusted archival import or unsafe fallback |
| Source `flight_id` equals unrelated target flight | NO LINK | Archive preserved as unattached history |
| Two concurrent sessions: same/different event | Single atomic DB reconciliation | Insert/identical/rollback counts only after commit |

## Product choice and trade-off (NOT DECIDED)

**A — Recommended strict:** block **all** overlapping claims across different signed-v13 digests, even identical event payloads. **Protects genuine independent events and provenance**, but may block routine incremental restore of a later snapshot of the same account because most snapshots overlap. Safe as an initial constrained migration/recovery contract, not necessarily sufficient user experience long term.

**B — Equal-content evidence-only dedup:** if cross-snapshot content matches, append another signed snapshot observation while showing one canonical event. More usable, but implicitly treats matching events as one display event **without authenticated source-instance identity**; requires explicitly weaker claim and proof of how independent cloned events remain visible. **Not recommended without a stronger identity mechanism and owner acceptance of this trade-off.**

**C — Snapshot-scoped rows, duplicate claims shown separately:** preserves every observation and minimizes conflation but may display apparent duplicates and violates an ordinary expectation of one historical event. Needs explicit presentation and regulatory-evidence policy, not recommended as silent default.

**Owner approval needed for first decision:** choose **A / B / C** for v13 cross-snapshot overlaps. Approval of a policy is **only a DESIGN decision**, not permission to implement/release. Other open owner decisions: destination-flight link strategy; exact event-byte retention and privacy; v14 installation/clone lineage; audited erasure. These are deferred, not automatically approved by choosing A.

**Acceptance gates to add:** DeepSeek A2-P21 two distinct signed snapshots with identical/different overlapping IDs; A2-P22 DB-level append-only/tenant authorization/cursor merging and unrelated destination-flight ID. All new A2 tests **NOT RUN**.

**DO NOT:** treat backup digest as issuer identity; merge equal source IDs silently; ignore genuine independent native events; mutate prod database; claim A2 DONE before source-backed PG16/Neon test and separate owner approval.

**ONE NEXT STEP:** owner selects v13 cross-snapshot policy option A/B/C; freeze exact contract and smallest acceptance milestone before any DDL/application changes.
