# FlyTally DATA-1E3 D4 A2 — V14-C clone, namespace and observation policy

**31 October 2026 — OWNER DECISION REQUEST / PROPOSAL ONLY.** V14-C has **NOT** been selected or approved. This document is a bounded decision record, not SQL/schema/code, and does not lift the independent security verdict **BLOCK — DESIGN ONLY**. It must not be interpreted as implementation, migration, flags, production operations, merge or deployment authorization.

## Verified authority and technical anchors

- Repo: `filipto861/flytally-logbook`; canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`; frozen executable candidate `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1`, Draft PR #449. Design Draft PR #451 pre-V14-C `83b2c4894edb20c54d049505791fe9fe82c8f6e4` based on Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`.
- Vercel `fly-tally.com` READY `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` at older production app SHA `55c8076e1eb8104c14392e15b272b33e0eb29607`; production DB/schema/flags UNKNOWN. Not tested or modified.
- `lib/db-optimization.ts:39-80`: current native audit uses `BIGSERIAL` and flight trigger; no N2-S UUID identity table currently exists. `lib/backup-authenticity.ts:7-19` authenticates purpose, signature version, backup version, **sourceUserId and a whole-payload digest**, not an independent database-instance identity. `lib/portable-backup.ts:133-135` still dispatches `version>=13` into v13 arrays; `lib/account-backup.ts:64-66` signs version 13 only. `lib/account-restore-v6.ts:224,268-269` remains unsafe legacy MAX/native audit DELETE/unchecked audit ON CONFLICT; this is an independent hard stop regardless of selected V14-C policy.
- Frozen OWNER DESIGN ONLY: Option2 separate immutable imported ledger; signed-v13 **A** distinct valid whole-file digests overlapping the same source user/audit numeric ID => atomic reject even if content equal; **L1** destination-account imported history UNATTACHED to flights; **N2-S** stable random native event UID in one-to-one sidecar, assignment kind `at_event_insert` or `migration_backfill`; **R1** original semantic JSONB, versioned canonical hash, signer/snapshot import-verification claim only; **V13-I** valid signed-v13 historical audit goes into separate imported ledger as `legacy_v13_imported`, never into native audit.
- Second independent V3 review: **BLOCK** F01..F12, 4 P0, 5 P1, 3 P2, reconciled in `2026-10-30-data1e3-d4-a2-v14-n2s-independent-v3-block-review-reconciliation.md`. V14-C was specifically marked an **OPEN owner decision**. This is a new targeted option analysis, not a completed independent security review.

## Problem and proof boundary

A database clone copies existing native audit rows, their sidecar UUIDs and any declared installation identifier; they are shared **claims** inherited from the same physical snapshot, not independently proven ongoing operation. Native events added after cloning should receive independent random UIDs even if local `BIGSERIAL` IDs collide. Backfilled UIDs assigned after separate clone forks generally differ despite equal historical events and thus cannot establish equivalence. A copied signing secret also does NOT prove database identity.

A signed v14 whole-file digest authenticates one **snapshot observation**, not a physical machine/DB or unique row inclusion proof available indefinitely once the original signed file is discarded. R1 never upgrades `verified_at_import_only` into later standalone source-row membership. No numeric source user/flight/audit PK, timestamps, equal content, installation tag or matching airframe/flight values are sufficient to silently join distinct events.

## Three mutually exclusive v14 design choices (none selected)

### C1 — Strict cross-snapshot UID conflict (safest default, poor recoverability)

If two different valid signed-v14 payload digests make overlapping claims about `(authenticated_source_user_id,event_uid)`, abort the entire restore even if the canonical event contents match. Exact **same signed digest** replay idempotent only after full equality. Different UUIDs can append independently, subject to ownership and provenance checks. Unambiguous and avoids false identity merge, but routine successive v14 backups necessarily overlap and frequently **cannot restore incrementally**. Mirrors v13 A, **but does not change v13 A**.

### C2 — Multiple authenticated observations, one provisional logical UID (RECOMMENDED CONDITIONALLY)

Store each cryptographically verified v14 **snapshot observation** append-only with source user, full original digest, signature/key-version claim, event UID, immutable exact semantic event and versioned hash, assignment kind and provenance tier; keep every distinct observation even if a logical event projection shows a single row. No source archive membership proof after archive deletion. Do not rewrite an existing stored observation.

- **Same complete signed file digest + same source owner/UID/full canonical event**: `IDENTICAL`, no duplicate observation/event; digest equal with differing content/metadata => whole transaction `CONFLICT`.
- **Different valid signed v14 digests, same authenticated source user + `at_event_insert` UID + fully equal canonical event and all identity-critical fields**: append a distinct snapshot observation and permit one **provisional logical UID projection** for display/backup. Evidence says `observed_again`, **not** `physically_independent_origin_verified`. No new compliance/certification credit. The original immutable observations remain independently accessible and countable. Equality is strict including semantic action, actor/source-user, source-flight ID, old/new payload, change time, generation scheme/canonical version and source kind. Ambiguous/missing/unsupported critical field => reject.
- **Same authenticated source user/UID, different content, actor, source flight, assignment type, or unsupported hash**: **CONFLICT, full atomic rollback**, even if each file is validly signed. Never take latest/first/last, never perform ON CONFLICT DO NOTHING. Same UID under incompatible source users is **not identity proof**; cross-account normalization or merge forbidden; if mapping to same destination namespace is ambiguous, block.
- **Different valid v14 digests, `migration_backfill` UID claim overlap**: **STRICT CONFLICT / NEEDS REVIEW**, even when contents equal, unless a separately reviewed strong lineage proof is available (not present in frozen code/design). No silent equal-content dedupe for backfilled events. Distinct backfilled UIDs with identical old event content are NOT auto-linked.
- **Identical `at_event_insert` UID inherited from a DB clone**: can represent one common ancestor event, but matching UID does not authenticate whether the two signed archives came from an independent clone or one continuous DB. Preserve distinct snapshot observations and label origin/lineage `DECLARED / UNVERIFIED`. A malicious/compromised signer or cloned signing key lies outside physical independence proof. If product requires physical origin attestation, this option must stop until stronger verifiable provenance exists.
- Scope all checks to an authenticated destination account and signed source user, with explicit event UID scheme + source lineage claim. Never join a source numeric flight ID to a destination flight; imported history stays **L1 UNATTACHED**. If v14 carries already-imported v13 records, preserve their **v13-A** source claims and R1 verification tier; do not reclassify them as v14-native UID events.
- Implementer must prove concurrency-safe DB identity arbitration and observation uniqueness in one atomic transaction for two real sessions and Neon HTTP fixed-query behavior; append-only permissions/grants, original source files/signatures, privacy and erasure require separate gates.

C2 supports normal repeated backups without discarding the evidence that there were multiple signed observations. It grants no independent attestation of a physical database. A projection may use a shared UID **only as a bounded logical equality claim**, never as an aviation certification or source-instance fact. This is why C2 is **conditional** rather than blanket deduplication.

### C3 — Snapshot-separated independent event records (maximum observation separation, noisy)

Every distinct signed v14 backup namespace `(signed_source_user,digest)` records its own event observation and displays it separately even if UID/content match; no logical collapse. Same UID with divergent content still causes an explicit cross-claim conflict rather than treating both as trustworthy event histories. This avoids silent equivalence but can create multiple indistinguishable apparent events, duplicate UI history and misleading counts; would require separate owner UX/evidence status approval before release.

## Outcome table (target design; all NOT RUN)

| Input scenario | C1 | C2 conditional | C3 |
| --- | --- | --- | --- |
| Exact same signed v14 digest replay, full row equality | IDENTICAL | IDENTICAL | IDENTICAL |
| Different signed digests, same source user+**at_insert** UID, equal canonical event | BLOCK | Append observation; one provisional logical event | Preserve separate observations/events |
| Different signed digests, same UID, **different canonical event or owner** | BLOCK | BLOCK | BLOCK |
| Different signed digests, same source user+**migration_backfill** UID, equal event | BLOCK | BLOCK absent strong lineage proof | Separate observations (no identity merge) |
| Different UIDs, equivalent timestamp/flight/numeric ID | Separate | Separate | Separate |
| Clone inherited ancestor `at_insert` UID, equal event | BLOCK across digests | Observation aggregation, identity physical origin UNVERIFIED | Separate |
| Two independently created post-clone events, different UIDs | Separate | Separate | Separate |
| Signed v14 rewrap contains v13 imported evidence | Enforce original signed-v13 A | Enforce original signed-v13 A | Enforce original signed-v13 A |
| R1 source archive unavailable | original-row membership UNAVAILABLE | original-row membership UNAVAILABLE | original-row membership UNAVAILABLE |
| Missing signature/UID/unsupported version/ambiguous source account | BLOCK | BLOCK | BLOCK |

**Hard security invariant for all choices:** conflict at the database-authoritative main transaction, full rollback; safety backup committed before main restore; no destructive native audit fallback, account cross-joins, weak UUID default, projected certification/recency, guessed lineage, raw original archive retention by implication, or false `verified` claim.

## Trade-off and recommendation

Recommend **C2 conditional** because a stable at-insert N2-S UUID can support repeated snapshots without v13-like overlapping-digest lockout, while **every signed observation is retained separately**, equality is full and conflicting/weakly-proven identities stop the restore. C1 is the most conservative and is reasonable if inability to incrementally restore repeated v14 backups is acceptable. C3 preserves provenance but imposes duplicate event projections and likely usability/credit ambiguity. C2 MUST remain **NOT APPROVED** until owner explicitly selects it and reviewer confirms atomic tenant-scoped persistence and trustworthy equality/canonicalization; if that cannot be demonstrated, **fall back to BLOCK**, never degrade silently.

## Acceptance gates before any runtime milestone — NOT RUN

1. v14 strict source authenticity/owner + exact original digest, scheme, canonical version, assignment kind and event content; v15+ and inconsistent sections reject; old signed v13 A unaffected.
2. New native sidecar assignment includes owner PK/FK with no CASCADE, one atomic event UID at INSERT and `migration_backfill` known assignment; immutable grants and full native mapping coverage.
3. Clone fixture (same ancestor at_insert event, fork with new independent UIDs, divergent same UID content, separately backfilled old events); two actual PG16 concurrent imports into one destination assert every observation count and rollback result.
4. Signed v14 distinct digests with equal at_insert UID/event create exactly one provisional projection and **two** immutable observations (if C2 selected), exact digest replay no extra observation, conflicting content abort; cross-account attempts reject.
5. Read-only single MVCC snapshot v14 query-ID manifest and all stored backups incl imported observations, including a candidate count (previous 36-slot assumption may need **additional result slot(s)** if evidence-observation rows are separate from imported events). **Do not freeze 36** without an explicit slot-by-slot final schema; entire archive includes original signed-v13 claims on re-export.
6. Post-import source signed file removed => R1 original-row membership UNAVAILABLE; source lineage DECLARED/UNVERIFIED; key rotation/erasure policy and UI history grouping remain separate.
7. All download/automatic/manual/pre_restore/readback and flag OFF with populated imported ledger must not downgrade to native-only backup; negative tests must fail closed; Neon HTTP atomicity verified against provider behavior.

**Status:** Design options only, not an authorized V14-C choice. Previous independent reviewer result BLOCK remains. A2 tests PG16/Neon HTTP/Node/TS/build/Playwright NOT RUN, production DB/flags/schema UNKNOWN.

**ONE NEXT STEP:** the owner explicitly chooses **C1, C2 conditional, or C3** as V14-C DESIGN policy; then update frozen V4/V5 design and risk-scope only the newly changed design for independent review before an authorized implementation milestone.
