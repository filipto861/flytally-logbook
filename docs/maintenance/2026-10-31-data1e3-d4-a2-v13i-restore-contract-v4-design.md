# FlyTally DATA-1E3 D4 A2 — V13-I owner-approved restore semantics / V4 design addendum

**31 October 2026. Owner approved V13-I as DESIGN POLICY ONLY** by answering `souhlasím` to the explicit question whether signed-v13 historical audit rows should be preserved in a separate imported account-level ledger rather than inserted into native `flight_audit_log`. This decision is **not** approval of implementation, SQL, schema v22, migration, data restore, flags, merge, or deployment. Prior independent V3 reviewer verdict **BLOCK — DESIGN ONLY** remains in force; F01–F12 are not magically resolved by a written decision.

## Exact verification and source boundary

- Repo `filipto861/flytally-logbook`; verified `main@807f281e5870164b794d001480ecc84e0b45aea5`; executable source `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` (Draft #449).
- Work [Draft PR #451](https://github.com/filipto861/flytally-logbook/pull/451), branch `docs/logbook-data1e3-d4-a2-provenance-model-20261030` pre-V13-I HEAD `77cbb36bf6869a27a94fe56257db40c90c1ac8c0`, base Draft #450 `b8ccc583c033f7d9b70f2e3b84000320d066b01a`. After this document is committed, independently verify the new work HEAD.
- Production `fly-tally.com` Vercel READY deployment `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` from earlier code `55c8076e1eb8104c14392e15b272b33e0eb29607`; production DB/schema/flags UNKNOWN. No remote DB inventory or tests.
- Source facts at frozen executable: `lib/account-restore-v6.ts:224,268-269` uses a global native audit MAX floor, DELETE of recent native trigger rows and archived audit INSERT with unchecked `ON CONFLICT DO NOTHING`. `lib/account-backup.ts:31,64-66` exports native audit into signed v13; `lib/account-backup-presign.ts:36` permits only version 13; `lib/portable-backup.ts:133-135` accepts `>=13` as v13 section model; `app/(protected)/export/actions.ts:68,80` already stops restore when pre_restore safety-backup creation fails; current backup is not v14-complete.

## Frozen product/design decisions, additive

1. **Option 2:** separate imported historical audit ledger from native `flight_audit_log`.
2. **Signed-v13 A:** any two different positively authenticated signed-v13 whole-file digests claiming the same original `source_user_id + source_audit_id` cause **whole main-restore conflict**, even when purported event contents are identical. The same signed digest+same source audit ID is idempotent only after **complete original semantic event equality**, not blind ON CONFLICT. Different source user claims are never silently joined by matching numbers.
3. **L1:** all imported history is scoped to the destination account and explicitly **UNATTACHED** to its flights. `source_flight_id` is evidence preserved as original source metadata, never automatically equal to a destination `flight_id`. No L2 verified link or new certified/recency credit.
4. **N2-S:** natively generated local audit rows retain their existing schema and numeric BIGSERIAL; their eventual stable UUID is a one-to-one sidecar DB-atomic assignment, historical backfill is sidecar insert-only with `migration_backfill` label. It is **not** used to manufacture an ID for an imported v13 source event.
5. **R1:** original semantic audit event JSONB, versioned canonical event hash, signed source snapshot digest, verified-at-import evidence retained with scope. This does **not** independently prove source-row membership after original signed file is discarded.
6. **NEW V13-I:** when restoring a positively verified **signed v13** backup, historical `audit_log` rows enter **only** the separate append-only imported ledger labelled `legacy_v13_imported`. **Never** insert them into or replace/delete native `flight_audit_log` rows, even when the target account's native history is empty. Preserve provenance and fail closed if complete safe import is unavailable.

V13-I is a restore semantic choice, **not** a new exception to source-signed v13 policy A or permission to change historical original signatures.

## Proposed v13 restore transaction contract — candidate, no SQL

**Before any main data mutation:**
- Verify server signature positively against the **original immutable v13 payload** and actual signed source user/digest/format; unchanged signed source bytes should not be re-signed or adjusted for a new schema. Reject invalid/unsupported signatures, corrupt count/relationships, ambiguous account authorization and unsupported versions.
- Authenticated destination owner is distinct from signed source user. Validate ownership and all actor/flight/certified/void/shared/track evidence constraints; preserve exact source identity and actual import operation identity. Treat other participant claims separately; no cross-tenant numeric joins.
- Require a **complete signed safety backup** including every native audit + native sidecar identity + any existing imported ledger + necessary account history. Under future v14, missing schema or unsupported flag means **UNAVAILABLE/BLOCK**. Existing v13-only pre_restore is NOT sufficient once sidecar/imported evidence exists. The safety backup must be committed durably before attempting the separate main restore transaction.
- Validate archive size, source event content/canonicalization version, direct immutable source user/audit ID, event fields `action/actor/old_data/new_data/changed_at/source_flight_id` and signed digest. Missing metadata is **UNAVAILABLE**, never defaulted to zero/empty fabricated identity.

**Single authoritative main restore transaction, no application-preview authority:**
- Preserve original signed audit records **as imported historical account-scoped events**; destination `local_id` is only storage identity. Proposed storage type/label `legacy_v13_imported` is metadata, not a new aviation authorization.
- Protect each `(destination_account, signed_source_user_id, signed_source_audit_id)` under database-enforced concurrency-safe unique/equality arbitration spanning all previously imported *signed v13* snapshot claims. This is broader than unique `(destination_account,digest,source_audit_id)` alone.
- **Same exact signed digest + same source identity + fully identical event:** allow a counted `IDENTICAL` replay (no invented new audit row). Same digest but different claimed event bytes/semantic data => corruption/conflict; abort the entire main transaction.
- **Different valid signed v13 digests + overlapping source-user/audit identity**, equal OR different contents => **CONFLICT; abort whole restore** under A. No silent duplicate/skip, no assumed clone/database-instance equivalence. Distinct non-overlapping IDs may append if all other guards pass.
- No import row may mutate native audit; no global `MAX(id)`, broad `DELETE FROM flight_audit_log`, historic native `json_populate_record` insert or unchecked `ON CONFLICT DO NOTHING`. An attempted unsafe F9 fallback must be blocked, including when import ledger feature flag is OFF or database schema is absent.
- Restoring eligible account/flight records (subject to separate existing certification and ownership rules) may produce **new genuine target native trigger events**. Keep these native events and their DB-generated N2-S IDs distinct from historical imported rows. Such triggers are evidence of a *restore-generated write*, not a re-enactment of the original flight event. No false actor/editor or regulatory claim.
- Partial restore failure or race => rollback all main restore mutations, keep committed pre_restore intact, return bounded user-safe error. Actual counts reflect committed inserts/identical records, never preview estimates. Neon HTTP fixed-query behavior, locking and SQL conflict assertion are still **unproven**.

**After import:** v14 export, automatic/manual/download/pre_restore, stored readback and restore must retain imported `legacy_v13_imported` with original source v13 digest/proof label, plus native and sidecar identity, in one versioned signed MVCC snapshot. Rewrapping in signed v14 is NOT equivalent to proving original source event membership independently. Import history remains L1 unattached regardless of whether the restored flight has matching numeric ID.

## Deterministic acceptance matrix — all NOT RUN

| Case | Design outcome |
| --- | --- |
| Positively signed first v13 restore with non-overlapping source audit identities | Imported history appended, local native history untouched, other authorized entities handled under separate existing invariants |
| Same signed v13 archive repeated, identical event | Idempotent counted `IDENTICAL`; no duplicate |
| Same signed digest but changed original event | `CONFLICT`, full main rollback |
| Different positively signed v13 digests with same signed source-user/source-audit ID, identical content | `CONFLICT` under A, full main rollback |
| Different positively signed v13 digests with same ID, different content | `CONFLICT` under A, full main rollback |
| Source flight number equals an unrelated local flight | Preserved source metadata, **UNATTACHED** |
| Signed v13 archive restores a new destination flight | New local native trigger event preserved and sidecar-mapped atomically; old source audit remains imported |
| Concurrent second writer or cloned numeric sequence collision | No native audit DELETE/overwrite or unchecked skip; DB-authoritative atomic abort or exact identical outcome |
| Invalid signature, missing importer schema, incomplete pre_restore, oversized event, unknown v15+, flag OFF with historic rows | `UNAVAILABLE/BLOCK`, no main data mutation |
| v13 -> v14 -> signed backup -> restore including nonempty imported ledger | Source digest+semantic content+original actor/source IDs+UNATTACHED kind roundtrip; no invented native audit history |
| Source archive removed after verified import | `verified_at_import_only`; standalone original source event inclusion `UNAVAILABLE` |

## Still-open product decisions and engineering blockers

**NOT decided by owner approval of V13-I:**
- **V14-C:** namespace and equality/conflict policy for *v14* native sidecar UID across cloned/backfilled databases. Do NOT automatically extend A from signed-v13 to v14.
- **R1 privacy/key:** canonicalization version details, key rotation/revocation historical verification, bounded event retention and extraordinary legal erasure policy. No silent extra original archive retention or proof-strength escalation.
- **UI:** later provenance labels, restore-generated event display, pagination; requires separate UI/Apple Design task if pursued.
- Exact N2-S DB owner constraints, one-to-one FK `RESTRICT/NO ACTION`, immutable roles/trigger, insert-only concurrent backfill; strict v13/v14 parser, proposed 36-slot v14 backup query manifest, all-path signature/readback, deterministic two-session PG16 and Neon HTTP atomicity. No DDL/implementation authorized. Previous DeepSeek verdict **BLOCK — DESIGN ONLY** remains.

**Verification evidence:** V13-I design documentation reviewed against frozen source paths; no executable new tests (PG16/Neon/Node/TS/build/Playwright) **NOT RUN**; docs runtime N/A; production DB/schema/flags UNKNOWN. This document must not be construed as implemented or approved EFB/regulatory evidence.

**ONE NEXT STEP:** prepare a bounded **V14-C clone/namespace policy choice** with evidence and trade-offs for the owner before freezing any implementation contract. No additional independent reviewer loop merely for writing down an approved product decision; another review requires materially new frozen design or new evidence.
