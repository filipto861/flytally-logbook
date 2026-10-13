# FlyTally Logbook 3.8.0 — D3b-1 A+ approved lifecycle contract

**Decision:** OWNER APPROVED 13 October 2026.  
**Scope:** `flytally-logbook` ordinary Move to Trash, not certified Void or `flytally-training`.  
**Branch:** `fix/3.8.0-d3b1-atomic-fail-closed-trash`, based on D3b-0 Draft PR #332 at `38a8df4c9556638887d6ff2cc4fed35e9c787a1d`.  
**Status:** DESIGN/FREEZE — IMPLEMENTATION AND NEW TESTS NOT RUN, NOT SHIPPED.

## 1. Owner-frozen A+ decision

Ordinary Trash is permitted **only for an owned, uncertified, unlocked, revision-1 draft** without evidence that belongs to another person or a distinct protected lifecycle. No silent unlinking, no automatic cancellation/revocation, no cascading deletion of independent evidence to make a flight eligible. Previously archived track points, tracks and flight expenses remain in the existing Trash/Restore contract. Certified records use the separate audited Void process; locked/correction/finalized history must not enter ordinary Trash.

A successful result requires both (1) an archive snapshot and (2) **exactly one corresponding flight row actually deleted** as a single atomic database transaction. A conditional zero-row final DELETE after an inserted archive is not successful; the entire transaction must roll back. Concurrent certification or Edit must not produce archived-plus-active flight state.

Ineligible requests must remain unchanged and return an explicit, non-sensitive failure state to the user. No raw PG exception text. Existing Delete action and confirmation UI must communicate blocked eligibility rather than silently appear to have done nothing.

## 2. Dependent-data evidence matrix

Apply presence checks **for all historical statuses**, including inactive/declined/superseded rows; they still provide evidence. Use direct relations AND source references without FKs:

| Relation | Blocks ordinary Trash when | Why |
|---|---|---|
| `flight_participations` | `source_flight_id` OR `participant_flight_id` = target | invitations, accepted participants and references |
| `flight_connected_crew` | `source_flight_id` + `source_user_id` = target | independent connected PIC evidence |
| `flight_verifications` | `flight_id` = target | verification/signature history |
| `instructor_flight_approvals` | `flight_id` = target | separate approval evidence |
| `flight_source_provenance` | `source_flight_id` + `source_user_id` OR `participant_flight_id` + `participant_user_id` = target | immutable recipient history; source has **no FK** |
| `flight_public_shares` | `flight_id` + `user_id` = target, including revoked rows | old/legacy shares must not vanish through CASCADE |
| `flight_certified_revisions` | `flight_id` + `user_id` = target | traceable corrections |
| `voided_certified_flights` | `original_flight_id` + `user_id` = target | prevent identity/history collision |

Other tables must be reviewed before a complete closure claim. `flight_audit_log` is audit context rather than a blocking child (created even for ordinary standalone drafts); it must not be silently deleted. `flight_tracks`, `track_points` and `flight_expenses` are ordinary Trash payload only when snapshot fidelity and transactional rollback are verified.

**Lazy schema boundary:** `flight_public_shares` is created through `lib/flight-sharing.ts` on demand, not via optimizer v20. Trash must safely establish this table's known schema before querying it; do not fail all standalone deletions because an optional table was never initialized, and do not invent a parallel table definition.

## 3. Transaction invariants (design, not executed SQL)

1. Validate integer user/flight IDs. Ensure the exact existing optimizer + expense/track + share schemas (no v21 migration).
2. Begin one `sql.transaction`, acquire `SELECT ... FOR UPDATE` on the owned parent row **before snapshot**. Reject non-draft, certified, locked or revised rows without clearing lock fields.
3. Re-evaluate all dependent evidence in-transaction and archive only eligible rows. No automatic mutation of the evidence tables.
4. Delete track points and tracks **only if this transaction created an archive marker**. Preserve expense behavior as established by existing normal Trash/Restore.
5. Final conditional `DELETE flights ... RETURNING id` must re-evaluate protected state and dependent evidence. One or zero rows is unambiguous, never heuristically coerced.
6. The transaction must assert that **archive-count = deleted-count** and each count is 0 or 1; archive=1/delete=0 must raise a SQL exception and roll back *all* prior changes, rather than return success. Read the actual final delete result, not the prior archive INSERT result.
7. On successful deletion, return success; on eligible block, return safe blocked result; on database failure, do not claim success. UI should display a distinct neutral explanation.

The parent `FOR UPDATE` lock serializes canonical flight-row UPDATE/certify and FK-reference INSERTs using `KEY SHARE`, but it **does not by itself serialize writer updates on unrelated child rows or references lacking a source FK**. Specific collaboration/provenance writers must be audited; add cooperating parent lock requirements only where needed and test them. Do not claim a global concurrency guarantee from the parent lock alone.

## 4. Small-batch roadmap

- **D3b-1a (this decision milestone):** freeze A+ scope and evidence matrix; source inventory and independent review. No runtime behavior change.
- **D3b-1b:** implement minimal atomic Trash transaction and fail-closed check. Preserve unrelated sharing/void/edit logic; avoid DB migration if possible. Introduce safe, user-visible blocked feedback as a separate bounded UI sub-batch if required.
- **D3b-1c:** targeted source contracts, full native sequential v1–v20 PG16 matrix, true two-session Trash/certification/Edit/participant acceptance races, source-reference/no-FK tests, failed transaction rollback assertions; app action and dark/mobile/iPad UX acceptance.
- **D3b-1d:** reconcile ROADMAP/FEATURES/CHANGELOG, review actual test logs and branch diff, owner merge decision. No remote Neon or production deploy without separate target confirmation.

## 5. Required verification and release gates

- Positive: clean draft with tracks/track_points/expenses archives/deletes/restores with full payload.
- Negative: each listed evidence relationship and combinations, including historical/malformed/inactive rows; no snapshot/child changes.
- State: certified, locked, revision>1, existing certified revision; preserve Void history.
- Concurrency: true two-session archive-versus-certify, archive-versus-Edit, child evidence inserts/acceptance, source no-FK provenance, duplicate Trash requests; no orphan archive+active, no silent cascade.
- Contract: RESTORE D2/D3a source-tested parity, existing feature-flag OFF behavior, rollback on constrained DELETE, proper end-user feedback.
- Evidence: owner-local Node24 typecheck, targeted tests, full test group/build as applicable, isolated PG16 actual optimizer v1→v20, optional real Neon SDK on explicitly approved disposable DB; **none executed for D3b-1 yet**.
- Do not conflate the previous D3b-0 **15/15 PASS at `7f87eb76caa2b90b2a2fdb64ed97a29a8e2b2ac1`** with verification of this new runtime design.

## 6. Independent review request

DeepSeek already independently reviewed A+ concept without repo access. Before implementing an irreversible lifecycle change, send a read-only reviewer the actual query design, matrix above, no-source-FK/optional-shares assumptions, and ask to identify missing writers, lock-order deadlocks, transaction invariant pitfalls and backward-compatibility regressions. Reviewer advice is not authority; reconcile with live source and actual PG16 tests.

**Frozen by owner:** A+ not B/C; no cascading independent evidence and no automatic prefill/cleanup; no certified Void routed through normal Trash; no broad migration or data overwrite.  
**Not yet approved:** a particular SQL implementation, breaking API/UI behavior, merge, production migration or deployment.
