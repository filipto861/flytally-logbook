# FlyTally Logbook 3.8.0 — D3b-1 A+ approved lifecycle contract

**Decision:** OWNER APPROVED 13 October 2026.  
**Scope:** `flytally-logbook` ordinary Move to Trash, not certified Void or `flytally-training`.  
**Branch:** `fix/3.8.0-d3b1-atomic-fail-closed-trash`, based on D3b-0 Draft PR #332 at `38a8df4c9556638887d6ff2cc4fed35e9c787a1d`.  
**Current status (13 October 2026):** OWNER APPROVED / Draft PR #333 / owner-local TypeScript and full source/unit tests **1,480/1,480 PASS** at exact SHA `ca59d29b`; prior native PG16 **21/21 PASS** at older SHA `83c7aa61`; **fresh PG16, build, authenticated app/SDK, browser and writer-race gates OPEN** / NOT SHIPPED. Earlier sections preserve their historical checkpoints. The earlier sections preserve the design freeze, while section 7 records the authored candidate.

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
2. Begin one `sql.transaction`, acquire **unconditional `SELECT ... FOR UPDATE` on any existing owned parent row** before evaluating eligibility or snapshot. Only after the lock is held reject non-draft, certified, locked or revised rows without clearing lock fields. This prevents a concurrent unlock turning a missed conditional lock into an unprotected archive.
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
**Still subject to verification/review:** the particular SQL implementation and UI/error behavior. **Not approved:** merge, production migration or deployment.

## 7. Initial D3b-1a/1b implementation candidate (13 Oct 2026 — NOT TESTED)

On this nested implementation branch the following files have been staged as candidate code (not acceptance evidence): `lib/flight-trash.ts`, `lib/flight-sharing.ts`, `app/(protected)/flights/actions.ts`, `app/(protected)/flights/[id]/page.tsx`, existing D3b source/native PostgreSQL test suites updated for new A+ expected behavior, and `tooling/run-v380-d3b1-atomic-trash-local.ps1`.

Implementation uses an early **unconditional owned-row `SELECT ... FOR UPDATE`**, including initially locked/certified rows, then applies uncertified/unlocked/revision-1 eligibility strictly in the archive and final DELETE statements. The archive and final DELETE each evaluate the eight protected child domains above. The last statement is a data-modifying `WITH deleted AS(DELETE ... RETURNING f.id)` with a *dynamic* SQL division-by-zero assertion only if the archive exists but `COUNT(deleted)=0`. A thrown SQL error makes the whole `sql.transaction` roll back. This replaces the previous incorrect success result from `results[1]` (archive-only) with `deleted_count===1` plus archive marker.

**Review items before acceptance:**
- Confirm native PostgreSQL's data-modifying CTE and dynamic assertion are executed and reliably abort the complete transaction when deliberately forcing a zero-row DELETE.
- Confirm current `@neondatabase/serverless` transaction behavior and error propagation against an approved disposable target; local `psql` behavior is not SDK proof.
- Validate parent lock and child writers, especially source provenance without FK. The new two-session PG16 test proves competing certification waits for the parent lock; it cannot prove every writer cooperates.
- Verify lazy canonical share schema initialization doesn't alter unrelated share workflows and all historical share/provenance statuses remain blocked.
- Validate page/action redirect message and disabled/deleting state on desktop/iPad/mobile and night mode.
- Preserve protected certified Void, Restore D2/D3a, legacy feature flag OFF behavior and every unrelated flight ownership rule.

**Tests:** New D3b-1 runtime code **NOT RUN** (typecheck, source, PG16, full test suite, build, browser, app SDK), despite historical D3b-0 15/15 PASS on a different SHA. No schema/production migration, remote DB, merge or deploy. Do not label milestone DONE until verified and reviewed.

## 8. Owner-local A+ scoped PostgreSQL acceptance (13 Oct 2026 — PASS, broader gates OPEN)

Exact **tested source SHA `83c7aa61bcba1d92c5e2df9b86c790cab4c867e0`**, Windows/Node24, `tooling/run-v380-d3b1-atomic-trash-local.ps1`: `npm run typecheck` **PASS**, source characterization **4/4 PASS**, native PostgreSQL targeted cases **6/6 PASS**, native PostgreSQL with actual sequential optimizer migration SQL v1→v20 **11/11 PASS**; **21/21 PASS, zero fail/skip**. New disposable PG16 host `127.0.0.1:65028`; identity expected and observed `flytally_currency_test|flytally|127.0.0.1|65028` MATCH, server cleanly stopped.

New acceptance covers clean draft, linked crew and verification, pending participation, locked/certified state guards, legacy instructor approval and revoked public shares, source provenance with no FK, provenance recipient, zero-row DELETE forced full rollback and real two-session parent row locking against competing certification. These are **scoped tests against minimal foundational schema + actual optimizer migrations**, not all independent historical feature migrations, authenticated Next.js server actions, Neon SDK semantics, arbitrary child writers, full tests/build/browser or production data. Do not infer comprehensive integrity solely from 21/21. **D3b-1 not released/merged.** Earlier `NOT RUN` notes apply to older candidate commits and remain historical.

## 9. Writer-path audit after targeted PG16 PASS (13 Oct 2026 — additional acceptance work OPEN)

Read-only inspection on D3b-1 branch (not a proof of a production incident):
- `app/(protected)/flights/actions.ts` `attachKmlTrack()` performs an initial unlocked `SELECT id,locked_at FROM flights`, then file parsing/airport calculations, and later executes a transaction including `INSERT flight_tracks` and `UPDATE flights`. The test/schema contract's `flight_tracks.flight_id` has **no actual FK-to-flights guarantee in the inspected migration/fixture**. A concurrent ordinary Trash could delete a parent between that initial check and subsequent track insert; its early parent lock does not by itself prevent a later insert into a table without a parent FK. **Candidate orphan track / archive-snapshot race, NOT RUN / NOT reproduced.** Check actual deployed schema parity and test two transactions before making a definitive claim.
- `deleteTrack()` reads flight and track without a common parent row lock, performs pre-operation backup, then deletes track points and selected track. `saveFlightExpenses()` separately reads owned flight and writes DELETE/INSERT of expenses in its own transaction. They need targeted concurrency/fidelity tests against Trash; a parent row lock alone does not serialize all child mutations. Original expense schema does have a flight FK, but that does not establish an atomic pre-archive expense snapshot.
- `applyGpsTimes()` is a parent UPDATE after a preliminary track read; it needs a post-wait stale/no-row check and cannot be treated as acceptance solely because competing certification locked correctly.
- `app/(protected)/flights/shared-actions.ts` creates participation/provenance references through their own source-certification gates. `flight_source_provenance.source_flight_id` has no source FK; a global source-writer safety assertion therefore requires a dedicated two-session test, not simply the parent-lock test for certification.

**Consequence:** retain **D3b-1 scoped A+ 21/21 PASS** at exact source SHA `83c7aa61bcba1d92c5e2df9b86c790cab4c867e0`, but **do not close production integrity** until track/expense/Edit/GPS and sharing writer races are characterized, app/SDK transactions tested, full test/build and desktop/iPad/mobile/night feedback verified. Unrelated changes should be separated into D3c if they exceed approved D3b-1 scope, with ROADMAP updated first.

## 10. Legacy participant-owned remove action and aggregate regressions (13 Oct 2026 — NOT RETESTED)

The owner ran `npm test` on source SHA `707e1a5f66f27f9a5eb9484bda151649ff061eef`: **1,480 tests total; 1,476 PASS, 4 FAIL, 0 skipped**. Two failing historical assertions expected the old owner-only participant draft removal code in `lib/flight-trash.ts`; another expected the retired pre-10-Oct roadmap table; another counted PostgreSQL subprocess invocations only if `-d` was their first argument. All four have been reconciled on this draft branch, **new tests NOT RUN**.

**Important additional source discovery:** the flight detail page had an inline, *distinct* `removeParticipant()` server action used for `participantOwned` drafts. It independently cleared `locked_at`, unlinked participant rows, deleted track points/tracks, `flight_verifications`, `flight_certified_revisions` and finally deleted `flights` without entering approved A+ ordinary Trash. Its source identity check also included a historical approximate match when the participation pointer was NULL. It was not covered by the original D3b-1 21/21 target suites. A+ explicitly forbids silent deletion of independent evidence and automatic unlinking; this alternate deletion route was **not allowed to remain active simply to satisfy legacy tests**.

The unreviewed destructive action and UI confirmation were removed on Draft PR #333. For a non-certified `participantOwned` draft, the detail page now discloses that sharing/provenance evidence prevents ordinary Trash. Direct ordinary-delete requests continue to encounter A+ evidence guards. This is a **safety-first change in old participant-removal UX**, not implementation of a separate audited record-withdrawal process. If owner needs such removal later, freeze that product policy, evidence-retention semantics, authorization and audit/backup behaviour as a new separate milestone before implementing it.

**Still OPEN:** auth-action/real SDK writer race, historical schema/data fixture parity, no-FK source provenance, track/expense/Edit races, detailed UI light/dark/responsive acceptance, and regression typecheck/full test/build. **Do not mark D3b-1 DONE or PR ready.** New changes beyond tested SHA `83c7aa61` require fresh owner-local test evidence.

## 11. Owner-local complete source/unit regression gate (13 October 2026 — PASS / NOT RELEASED)

On exact code SHA `ca59d29b54555df9bf545be17ccd71f5998c6a33`, owner Windows/Node24 executed: `npm run typecheck` **PASS**, targeted legacy participant-owned/canonical roadmap/Windows portability test files **13/13 PASS, no failure/skip**, and full `npm test` **1,480/1,480 PASS, no failure/skip** (`tests/*.test.ts` only; 28,252.4964 ms). This verifies the revised static expectations including absence of the previous unaudited `removeParticipant()` deletion endpoint, but does not exercise its former runtime path against PostgreSQL or verify a new cross-user flow.

**Remaining strict acceptance on the changed runtime:** fresh isolated native PG16 A+ runner for this or later candidate, `npm run build`, authenticated application/Neon SDK transaction behavior and source/provenance/track/expense/Edit writer races, responsive/mobile/iPad/light/night UI checks and independent reviewer reconciliation. Earlier native PostgreSQL 21/21 PASS belongs to tested `83c7aa61` and does not transfer to the current SHA. **Do not merge/release PR #333; no migrations/deploy have been performed.**
