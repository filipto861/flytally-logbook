# FlyTally 3.8.0 — D3b: protected, voided and shared flight data integrity

**13 October 2026 · READ-ONLY ANALYSIS MILESTONE / NO RUNTIME CHANGE / NOT SHIPPED**

## Parent and evidence scope

Canonical `filipto861/flytally-logbook` `main` ships 3.7.0; all v3.8.0 restoration work remains unmerged Draft. Parent PR #331 D3a `59a9801816f57375b6468c74274eb0ee1baf6f81`: owner Windows/Node24 typecheck and source 7/7, contract 6/6, native PG16 8/8 = **21/21 local PASS**. That evidence supports a Create-like canonical fingerprint lock vs real Restore SQL, not source provenance, Edit or full application paths. Separate PR #330 actual Neon JS HTTP SDK synthetic transaction tests **PASS**; ephemeral branches removed and their absence verified. No production database read or write performed in this D3b analysis.

## Actual source-backed ownership / lifecycle

| Source | Authority/source evidence | Current deletion/reconstruction consequence | Risk classification |
| --- | --- | --- | --- |
| `lib/flight-trash.ts`: `moveFlightToTrash` | `deleted_flights.flight_data`, `tracks_data`, `expenses_data` only; guards draft `certified_at IS NULL`, `record_revision=1`, absence of `flight_certified_revisions`. One conditional statement clears `locked_at` for unc ertified participant-owned flight inside same SQL transaction. | Normal trash archive has NO payload for participation, connected-crew, approvals, verifications, public shares or independent provenance. SQL success boolean checks inserted trash ID; investigate whether child evidence is removed or left dangling. | **BLOCK** unrestricted deletion of any affected linked draft before full relational test |
| `lib/db-optimization.ts` v12 and v13 `flight_participations` | `source_flight_id REFERENCES flights(id) ON DELETE CASCADE`; `participant_flight_id REFERENCES flights(id) ON DELETE SET NULL`; v13 adds broader role/status states. | Deleting source flight can cascade participation invitations/history. Deleting recipient flight can erase the back-reference while keeping participation, depending on other constraints. | **HIGH** missing independent participant evidence |
| `lib/db-optimization.ts` v15 `flight_connected_crew` | Composite FK `(source_flight_id,source_user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE`. | Deleting linked source flight cascades account-connected PIC association, not archived by Trash. | **HIGH** dangling or irrecoverable crew linkage |
| `lib/db-optimization.ts` v13 `flight_verifications` | `flight_id REFERENCES flights(id) ON DELETE CASCADE`; holds signer/status/hash/signature evidence. | Any remaining verification record could be cascaded by ordinary Trash unless protected by upstream checks, constraints or triggers. Inspect actual applicability; **do not assume all such rows require certification**. | **HIGH** independent signed evidence |
| `lib/flight-sharing.ts` `flight_public_shares` | Composite FK to `flights(id,user_id) ON DELETE CASCADE`; public share creation explicitly requires `certified_at IS NOT NULL`. | Ordinary draft trash generally should not have a public share created via canonical path; malformed/legacy rows must still be fail-closed. Published share revocation is not equivalent to Trash restoration. | **CONDITIONAL** |
| `lib/db-optimization.ts` v20 `flight_source_provenance` | Immutable trigger rejects DELETE and most UPDATE; participant account FK `(participant_flight_id,participant_user_id) ON DELETE CASCADE`; source tombstone pointer can transition only under strict same-transaction conditions. | A participant's own flight cannot safely be removed while durable provenance must remain; trigger may reject cascade or database may behave differently depending on FK/trigger ordering. Requires **actual PostgreSQL** verification, not assumed from prose. | **HIGH** cross-account provenance |
| `lib/db-optimization.ts` v20 void archives | `voided_certified_flights`, `voided_flight_certified_revisions`, `voided_flight_verifications`, `voided_flight_archive_items` protected with immutable triggers; `logbook_prevent_voided_flight_id_reuse` BEFORE INSERT on `flights`, separate deferred tombstone/active identity exclusion. | Certified void is an auditable archive with detailed child snapshots; ordinary draft Trash is **not** the restoration path for it. New restored flight ID is not the old one, so DO NOT infer historical tombstone semantics from ID-only trigger. | **HARD SEPARATION** |
| `app/(protected)/flights/actions.ts` `updateFlight` | Changes date/reg/offblock/dep/arr using a single UPDATE CTE, not a two-statement canonical advisory lock+destination duplicate check. | Restore vs Edit/changed destination key and Edit vs Create can still race or create duplicates. | **P0 open**, separate D3c writer consistency |

### Supported and unsupported claims

**Supported directly by source:** explicit tables/foreign key actions, v20 immutable triggers, which archive JSON payloads are constructed, base trash guards, presence of only Create-like/Restore cooperating advisory keys.

**Not yet proven:** whether all linked draft states are reachable from current UI; exact cascade/trigger outcome in deployed full-v20; whether an existing protected row can be incidentally mutated by another business operation; correctness of historic pre-v17 trash records; whether production catalog matches the repo's expected applied migrations; legal/permitted retirement semantics for independent participants.

## Test matrix: disposable full-v20 PostgreSQL, no prod writes

Run under a **new isolated PostgreSQL16 fixture that includes actual v12, v13, v15, v20 foreign keys and triggers**, not browser fixture shortcuts. Required cases:

1. **Ordinary draft without independent child evidence**: archive + restore retains full safe 52-column snapshot, tracks, expenses, owner and audit; double-restore prohibited. Existing D2/D3a tests support only their source-backed scope.
2. **Pending invitation/source participation**: attempt trash; prove whether SQL forbids mutation **and** records/links remain byte-for-byte unchanged. Never accept a test that silently cascades participation row.
3. **Accepted participant/source link**: preserve independent participant's own flight and source hash/revision; no silent cancellation/detach; prove the effect of source delete cascade.
4. **Recipient participant flight with `flight_source_provenance`**: deletion must preserve immutable provenance or fail closed; verify cascade, FK/trigger interactions and zero partial trash entries.
5. **Connected PIC**: source deletion must not silently destroy independent `flight_connected_crew` evidence; preserve or explicitly refuse.
6. **Instructor approval, verification pending/signed**: check both certification-protected and stale/imported legacy rows; no silent deletion of evidence.
7. **Certified/locked/revised source**: trash and restore attempts must fail closed; no re-certification, unlock, snapshot rewriting, revision deletion, child evidence loss or restore marker.
8. **Voided archive/tombstone**: do not restore voided certified source as generic draft; v20 anti-reuse trigger and immutable tombstone untouched; explicitly test same natural identity vs original ID (different phenomena).
9. **Malformed legacy Trash snapshot**: invalid missing config/currency/child fields must return Unavailable/Needs review, never infer CZK or rehydrate partial protected history.
10. **Concurrency**: Move-to-Trash vs Create/Edit/certify/void/participant acceptance; source row and dependent evidence must have atomic serializable lifecycle or fail closed. Test independent sessions and verify idempotence.

At every failure assert **no** `deleted_flights` insert, **no** new flights, **no** changed/deleted child evidence, unchanged certification hashes, `flight_source_provenance` and voided tombstone rows, and clean transaction rollback.

## Design alternatives requiring owner decision

**Option A — conservative fail-closed gate (recommended pending independent review):** if any independently meaningful evidence link exists, prevent ordinary Trash and require a separate lifecycle action (e.g. Withdraw invitation, Cancel pending share, Void certified record). Pros: minimal blast radius, audit trail protected, no guessing. Cons: some users may be unable to delete previously deletable linked drafts; UI must explain reason and path; must not silently clear links to allow delete.

**Option B — dedicated transactional snapshot and restore of each child domain:** capture and later restore full linked histories with owner/revision/source applicability rules, with conflict/purge policy. Pros: richer recovery. Cons: major schema/backup/security redesign, cross-user consent/ownership issues, migration and large validation burden; NOT appropriate as a quick 3.8.0 patch without roadmap approval.

**Option C — DB-only unique/constraint or cascade changes:** not sufficient for full lifecycle, high migration risk and may break legitimate historical duplicates. Not recommended without inventory and explicit owner approval.

**Proposed acceptance gate for A:** include evidence-presence guards on the source `moveFlightToTrash` transaction **in the same atomic guarded writer**, not solely a preliminary SELECT (TOCTOU race). Preserve user-facing actionable error without leaking DB exception details. Ensure migrations/older config apply. Author separate regression tests for malformed/archive/participant + true PG16 checks. Avoid legacy unexpected behavior changes without owner reviewing impacted use cases.

## Independent DeepSeek/Claude review handoff (read-only)

**Task:** independently assess D3b integrity design; do NOT implement or deploy.

**Context:** v3.8.0 currently unmerged; D3a Create-like/Restore PG16 21/21 PASS, exact `59a98018`; Neon JS SDK scratch HTTP PASS in other Draft. D3b actual source above, repo `filipto861/flytally-logbook`, `lib/flight-trash.ts`, `lib/db-optimization.ts` v12/13/15/20, `lib/flight-voiding.ts`, `app/(protected)/flights/actions.ts`.

**Frozen constraints:** exact historical provenance, independent participant evidence, protected certification history, fail closed, no silent CZK/defaults, no v21-on-v20 writes, no global uniqueness unless owner accepts migration, no production/Neon write, backwards compatibility > quick UX shortcut.

**Review questions:** (1) Are identified cascade/provenance/void risks real per effective schema and triggers? (2) What minimal atomic guard or DB mechanism protects ordinary Trash from races with source/participant mutations? (3) What legacy linked draft semantics must we preserve? (4) How to distinguish safe draft deletion, participant own-flight deletion and immutable tombstone void? (5) Does same-natural-key/advisory lock parity stay consistent across Edit/GPS/Quick Add? (6) What is minimal full-v20 PG16 fixture and evidence to claim D3b PASS? (7) Any hidden cross-account auth or backup regression?

**Expected deliverable:** source-referenced findings grouped P0/P1, precise recommended option and tradeoffs, minimal acceptance and regression matrix, explicit unknowns. **DO NOT** alter repo or claim approval; owner makes final lifecycle product decision.
