# FlyTally 3.8.0 — D3b independent DeepSeek review reconciliation

**2026-10-13 — READ-ONLY DESIGN / SOURCE RECONCILIATION. No runtime or schema edits.**

## Reviewer evidence and limitations

DeepSeek's owner-forwarded read-only review (278 lines, delivered 13 October 2026) explicitly states **it did not access the repository** and therefore rates its findings as conditional on the D3b audit. The review recommends **Option A+ (fail closed + parent row lock + atomic child evidence check)**, separately addresses Edit/Restore and full-v20 regression, and opposes hasty child-domain restoration.

This document is a **ChatGPT follow-up against real GitHub repository contents**, not a claim that DeepSeek independently reproduced anything. Sources at current D3b Draft #332 (source SHA for each file recorded in GitHub):
- \`lib/flight-trash.ts\` — \`moveFlightToTrash\`, \`restoreDeletedFlightRecord\`
- \`lib/db-optimization.ts\` — v11/12/13/15/20 schema, triggers, FK actions
- \`lib/flight-sharing.ts\` — certified-only share creation, owner-flight \`ON DELETE CASCADE\`
- \`app/(protected)/flights/actions.ts\` — Create, Update, Delete, GPS-import
- \`app/(protected)/flights/shared-actions.ts\` — accepted participation / invitation / own-flight creation
- \`lib/flight-voiding.ts\` — signed/certified void transactional archive
- \`tooling/v350-v20-migrate.sql\` — separate published v20 migration SQL

**Already verified, separate evidence:** owner-local D3a exact source \`59a9801816f57375b6468c74274eb0ee1baf6f81\` Node24 typecheck + 7+6+8 = **21/21 PG16 targeted PASS**; separate synthetic Neon JS HTTP SDK transaction/rollback/concurrency PASS on disposable child (both relevant temporary branches deleted and verified absent). Neither proves D3b, v21 or release.

## Reconciled findings

| Claim / issue | Grounded source evidence | Verdict / severity | Required proof |
|---|---|---|---|
| Ordinary Trash lacks independent child history | \`moveFlightToTrash\` snapshots \`to_jsonb(f)\`, aggregated \`flight_tracks\`, \`flight_expenses\` only. | **CONFIRMED source gap / P0 candidate** for reachable linked draft; not every child link is reachable on uncertified flight | Reproduce permitted draft+connected PIC, stale/legacy participation, and participant self-flight cases on full-v20 FK/triggers |
| FK cascade destroys all linked data | v12/13 participation source \`ON DELETE CASCADE\`, participant \`ON DELETE SET NULL\`; v15 connected PIC cascade; v13 approvals/verifications cascade; public shares cascade; v20 participant provenance FK cascade but BEFORE DELETE immutable provenance trigger raises. | **PARTIALLY CONFIRMED risk, actual outcome UNKNOWN**. With effective immutable trigger, a provenance cascade should raise an error and roll back the **whole transaction**, not commit partial SQL changes. Need actual applied schema and tests; do not claim data loss without reproduction. | Verify runtime pg_catalog and PG16 independent-source, participant-own-flight and stale legacy cases |
| Generic Delete path for certified history | \`moveFlightToTrash\` guards \`certified_at IS NULL\`, \`record_revision=1\`, absent revisions. Effective v20 \`logbook_protect_locked_flight\` requires same-transaction certified void tombstone for DELETE; protected archive/history has separate immutability triggers. | **SOURCE GUARD CONFIRMED**; deep review's claim that certified void and Trash might be conflated is too strong for canonical path. Applicability on legacy/corrected/invalid snapshots remains open. | Test actual parent/void/restore with checksums and no marker; do not invent recertification |
| Invitations on ordinary draft | \`shared-actions.ts\` canonical invitation query requires \`f.certified_at IS NOT NULL\` and nonempty certification hash. \`flight-sharing.ts\` canonical public share also requires certified flight. | **Reachability narrowing**: ordinary draft with canonical invitation/share is not expected; protect stale/imported/legacy abnormalities but don't represent as ubiquitous normal-case P0. | Test safe draft, certified source, crafted stale row only within disposable fixture |
| \`flight_source_provenance\` FK lock coverage | v20 \`flight_source_provenance\` has FK **(participant_flight_id,participant_user_id) → flights(id,user_id) ON DELETE CASCADE**; its \`source_flight_id/source_user_id\` fields are **not** declared FK to source flights. | **CONFIRMED limitation**: \`FOR UPDATE\` on source flight does NOT universally block concurrent writes of new provenance by source ID alone; DB/application writers need protocol review. Provenance normally created in accepted-certified participant path. | Reproduce source/participant acceptance race, inspect acceptable guard or supplementary lock on those writers |
| \`moveFlightToTrash\` return value | \`sql.transaction([conditional UPDATE to unlock, INSERT INTO deleted_flights ... RETURNING id, DELETE track_points, DELETE tracks, DELETE FROM flights ...])\` returns \`Boolean(results[1][0])\`, **not** the final DELETE result. | **CONFIRMED code-level correctness gap / P0 race candidate**: if guarded INSERT succeeds and later conditional DELETE affects 0 rows, transaction may commit an archive while original flight persists (unless another constraint aborts it). Pure SQL transaction atomicity alone does not require an equal row count across separate successful conditional statements. Must test, do not assert this happens in production without reproduction. | Run two-session certification/edit/acceptance competition and assert archive and deletion match; design transaction to fail closed when final delete fails |
| Row-lock + read-check TOCTOU | Initial \`UPDATE flights\` acquires row lock only for **participant-owned uncertified** condition, not general draft; archive step is nonlocking read; final DELETE acquires target lock late. | **CONFIRMED insufficient general parent protection**. A first \`SELECT FOR UPDATE\` can serialize parent changes and FK KEY SHARE child inserts, provided child checks occur in a **subsequent READ COMMITTED statement** after lock acquisition. It **cannot protect non-FK source references** without other coordination. | Two-session insert/DELETE race: both prior committed FK and concurrent FK insert; no partial trash after failure |
| Edit/GPS/Quick Add natural identity | \`updateFlight\` single CTE UPDATE, no canonical destination-lock/check. Create + D3a Restore match canonical fingerprint for tested paths; GPS/split and shared copy are independent writers. | **SOURCE-CONFIRMED P0 release gate**: cannot assert global flight uniqueness/absence of duplicates. | Inventory all write paths, normalize keys, lock destination and affected old identity where relevant, precise tests against ordinary and sharing writers |
| Legacy Trash and deleted metadata | Historic \`deleted_flights\` payloads may predate child domains; old archive missing currency/config must not be silently "repaired". | **P1 confirmed policy, actual incidence UNKNOWN**. Missing child entries do not prove lost evidence by themselves; distinguish genuinely empty child history from archive incapable of proving completeness. | Version/effectivity read-only inventory + negative tests; manual review where completeness unknowable |

## PostgreSQL-specific corrections to independent review

1. **Transaction atomicity:** A raised trigger/constraint exception within \`sql.transaction([...])\` normally aborts the entire DB transaction. PostgreSQL does not commit a "partial state" of that failed transaction; separate **successful conditional statements with 0 rows affected**, however, can still commit a logically incomplete operation unless code asserts row counts or uses stronger SQL coupling.
2. **FOR UPDATE:** A row lock conflicts with parent \`FOR KEY SHARE\` needed for immediate FK validation, hence can synchronize inserts that **truly reference that parent through FK**. It does not automatically serialize references lacking a source-FK or any unrelated writer that does not acquire corresponding locks.
3. **Single delete entry point:** desired **for ordinary Trash**. It must not silently replace the existing, separately audited \`voidCertifiedFlightRecord\` Delete workflow, account restoration or cross-account lifecycle operations. Audit each deletion path and its authority.
4. **Guard must be in server-side database write path:** read-only preflight / UI disables insufficient. The final row count and archive marker should be tightly coupled so no "archived but still active" success response.
5. **Applicability matters:** don't assume draft can have certified-only invitation/public share in the normal UI; legacy and deliberately inconsistent relational state still require deterministic fail-closed handling.

## Provisional design: A+ with stricter acceptance (owner sign-off required)

**Recommended for 3.8.0:** retain ordinary draft Trash only where evidence graph is provably safely deletable; **refuse ordinary Trash for any independent linked evidence that would be destroyed/detached or where the relationship's provenance cannot be proven complete**. Certified void remains via dedicated immutable tombstone path. Do not auto-unassign, auto-revoke, delete cross-account proof or infer missing metadata.

**Required atomic contract, not yet frozen:** lock parent row in same DB transaction; reevaluate eligibility and child evidence after lock under READ COMMITTED; ensure final DELETE and archived payload/marker are **both performed exactly once together or transaction fails**, with no persisted intermediate "trash succeeded" state. For link writers not protected by FK parent locks (e.g. \`flight_source_provenance.source_flight_id\`), either enforce explicit common writer serialization, source trigger/constraint contract, or prove lifecycle invariants that exclude the race. No reliance solely on ad-hoc \`NOT EXISTS\`, client preflight or non-cooperating advisory lock.

**Do not implement immediately:** a blanket \`ON DELETE RESTRICT\` migration, new global uniqueness, full child-domain rehydration, normal Trash for voided history, automatic link removal or silent FX/defaults. Confirm user-facing semantics before changing deletion of connected PIC drafts or legacy shared copies.

## Execution roadmap with acceptance and decision gates

**D3b-0 — actual-state characterization (next; safe, no product behavior change):**
- Build a disposable local native PG16 **full-v20 actual migration/trigger/FK** catalog fixture (different from simplified browser shortcuts), verify pg_catalog table/trigger/constraint identity before claiming tests.
- Prove effective behavior for: ordinary draft; connected PIC draft; source participation pending/accepted; signed or pending verification; participant own-flight plus immutable provenance; certified and corrected; void tombstone; forged stale link; historical Trash.
- Add adversarial two-session tests: child insert/acceptance versus trash, certification/void versus trash, and "snapshot inserted but final DELETE 0" race. Capture no partial archive, untouched child history or explicit proof of current gap.
- **Deliverable:** confirmed PASS/FAIL/UNAVAILABLE matrix, source and native PG evidence. No remote DB write, product patch, schema migration or deploy.

**Owner decision after D3b-0:** approve conservative A+ restrictions including behavior for linked draft and participant own-flight, or explicitly authorize a more extensive archive/provenance lifecycle. Owner is final authority; no guessing UX policy.

**D3b-1 — minimal atomic fix after decision:** implement server-guarded archive/delete with row-count coupling, child evidence eligibility and correct error feedback. Reuse existing server auth; document old/legacy behavior; add true PG16 rollback/concurrency + UI handling, regression at exact source SHA.

**D3c — independent writer coherence:** update/edit destination identity + split/GPS/Quick Add and sharing copy writers, normalized key locks and duplicate checks, without unapproved global DB uniqueness.

**Release gates still independent:** real v21 migration/ISO 4217 source, certified/void/shared + legacy/backup/signed v13, complete feature chain integration, typecheck/full suite/build/browser responsiveness/production smoke; no merge/deploy until evidence and owner approval.

## Reviewer response disposition

**Accepted:** A+ over B, atomic parent locking and server-side evidence guard, need for actual v20 PG16, independent participant ownership, Edit-writer consistency, conservative historical rehydration.

**Partially accepted / corrected:** universal P0 from each declared cascade (actual trigger outcome untested); universal \`FOR UPDATE\` solution (source provenance lacks source FK); partial commits after trigger failure (SQL transaction aborts); blanket "all DELETE from flights via Trash" (certified void is separate lawful domain action).

**Newly elevated:** authoritative success condition must depend on **final deletion**, not only archive insert. Audit \`moveFlightToTrash\` transaction's conditional statements and row-count coupling for race/rollback.

**Status:** independent reviewer has NOT inspected repo; follow-up source check complete. Proposed architecture **NOT approved**, no D3b full-v20 runtime reproduction, coding, CI, migration, production changes or DeepSeek direct invocation.

## D3b-0 continuation (13 Oct 2026)

- Added `tests/integration/v380-d3b-trash-source-characterization.test.ts` on Draft PR #332 as a **current-behavior characterization**, not a protection acceptance test. It checks three source-backed facts: archive coverage, success selection from INSERT result, and absence of universal row lock before snapshot.
- Reviewed `tooling/run-v380-d3a-create-restore-local.ps1` and `tests/integration/postgres-v380-full-v20-restore.test.ts` as the available disposable PG16 infrastructure. The latter bootstraps through `tooling/bootstrap-browser-smoke-db.mjs` and adds the expenses payload column in its own disposable database; D3b must verify actual v20 catalog constraints and triggers rather than assume the fixture matches production.
- Current execution environment has Node 22 but **no native PostgreSQL server, `psql`, or Docker**; therefore new characterization tests and D3b native PG16 scenarios are **NOT RUN** here. Do not inherit the earlier D3a PASS result as D3b test evidence.
- Next executable milestone: implement isolated full-v20 D3b tests with explicit `pg_catalog` inventory, deterministic zero-row-final-DELETE reproduction, and two-session locking/participant/provenance cases; then run on owner-local Windows PostgreSQL 16. Keep the fixture fail-closed on connection/identity mismatch and do not connect to Neon/production.
- No D3b runtime change, migration, production DB action or deployment. Owner's linked-draft UX policy remains undecided.

### D3b-0 catalog gate follow-up (13 Oct 2026)

- Committed `tests/integration/v380-d3b-full-v20-catalog.test.ts` as a **fail-closed native PostgreSQL 16 catalog gate**. It requires explicit `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1`, localhost-only dedicated DB identity, real FK delete actions and protected provenance/void lifecycle triggers. It does not generate substitutes for missing schema objects.
- **NOT RUN:** this environment cannot execute the isolated native PostgreSQL instance. The catalog gate does **not** prove behavior or races; dedicated concurrent writer/Trash reproduction and fixture application fidelity remain open. Running this test without its flag SKIPS it; skip must never count as acceptance.
- Explicit blocker: existing browser-bootstrap-based D3a test fixture cannot be presumed equivalent to full applied v20 schema. Before D3b acceptance, source-backed, reproducible v20 fixture construction and exact catalog trigger identity must be demonstrated; then implement and run evidence-preserving race tests.
- No runtime/DB/migration/deploy change. Owner linked-draft policy remains pending evidence.

### D3b-0 SQL counterexample added (13 Oct 2026)

- Added `tests/integration/v380-d3b-zero-delete-counterexample.test.ts`: isolated, rollback-only PostgreSQL test deliberately makes the final conditional DELETE affect zero rows after a successful archive INSERT. This demonstrates *why transaction commit alone is insufficient to guarantee INSERT/DELETE row-count coupling*. It does NOT reproduce the exact production `moveFlightToTrash` source code nor prove that a specific concurrent interleaving is reachable.
- The counterexample has **NOT RUN**. It requires explicit `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1`, disposable localhost PostgreSQL16 identity and supporting fixture rows; missing/invalid schema must fail, and result cannot be promoted to complete D3b acceptance without the separate real-v20 catalog gate and full migration fixture.
- Next: independently verify the fixture actually represents applied v20, then implement deterministically synchronized two-session *actual Trash SQL* races and independently linked-child rollback assertions. No product behavior changes until owner decision.

### D3b-0 explicit native gate runner (13 Oct 2026)

- `tooling/run-v380-d3b-existing-full-v20.mjs` added. **Precondition:** independent, already applied full-v20 PostgreSQL16 disposable DB at `127.0.0.1:<nonstandard-port>/flytally_currency_test`, user `flytally`, no password; set `FLYTALLY_D3B_FULL_V20_DISPOSABLE=1` and `DATABASE_URL`. Runner creates/drops/migrates **nothing**, verifies live identity, runs exact catalog gate first and rollback-only SQL counterexample second; exits nonzero on any failure. Example: `node tooling/run-v380-d3b-existing-full-v20.mjs`. Do not run it against Neon or production.
- Catalog trigger assertions tightened to exact source-backed v20 trigger names: `trg_logbook_protect_source_provenance`, `trg_logbook_protect_locked_flight`, `trg_logbook_prevent_voided_flight_id_reuse`, `trg_logbook_protect_voided_certified_flights`.
- **NOT RUN** here; native full-v20 disposable fixture/bootstrap is still missing. This runner is a preliminary gate, not a D3b concurrency acceptance, and existing browser bootstrap is NOT sufficient to call it an applied-v20 fixture.
- Remaining: actual migration fidelity, deterministic 2-session source SQL concurrency tests, linked-child/cross-user preservation matrix. No runtime change, no migration, no merge/deploy.

### D3b-0 continuation

Catalog test now also requires a v20 migration registry row and enabled protective triggers. Native PG16 runs are NOT RUN. Registry presence alone does not prove actual full migration fidelity. No runtime, schema, or production change.

## D3b-0 targeted SQL runtime characterization handoff (13 Oct 2026)

**Authored, NOT RUN:** `tests/integration/postgres-v380-d3b-real-trash-races.test.ts`. This file reads the five tagged SQL statements in `moveFlightToTrash()` directly, rejecting unexpected parameter/query changes. It provisions its own random PostgreSQL schema, reconstructs only the bounded pre-v20 tables needed for this test, and executes the actual `if(version===20)return[` SQL blocks from `lib/db-optimization.ts`. Its v12/v13/v15 baseline FK contracts are hand-built; it **does NOT prove full applied-v20 migration fidelity**.

Expected current-state characterization (not yet actual results):
1. Ordinary draft: five original SQL statements commit archive + delete.
2. Draft with connected PIC and flight verification: existing `CASCADE` FKs remove independent child rows while ordinary archive does not snapshot them. This is an intentional characterization of a candidate safety gap, not an accepted product behavior.
3. Participant-owned draft with immutable v20 provenance: final deletion raises, and PostgreSQL rolls back all earlier archive/track mutations.
4. Certified source: ordinary Trash guards prohibit archive/deletion.
5. **Two real database sessions:** session A begins and commits the archive INSERT; session B certifies the still-present draft while A is paused; A resumes the original track/deletion SQL. If no source row lock exists, the last conditional DELETE can affect zero rows while the archive survives. This is the actual SQL race hypothesis; evidence exists only after local execution.

**Windows/Node24 owner-local command, from a clean checkout of this exact D3b branch:**

```powershell
powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-d3b-targeted-local.ps1
```

The PowerShell runner initializes a unique disposable loopback PG16 cluster/DB, validates identity, invokes typecheck, source characterization and targeted native SQL tests, then stops and deletes only its own temporary cluster. Test uses separate flag `FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE=1`, distinct from the stricter `FLYTALLY_D3B_FULL_V20_DISPOSABLE` catalog gate. It must not connect to Neon, existing PostgreSQL or production.

**Gate status:** code committed; Node24 typecheck **NOT RUN**, source tests **NOT RUN**, targeted native PG16 **NOT RUN**, full applied v20 fixture equivalence **NOT RUN**, deterministic participant-acceptance and no-source-FK writer race **NOT RUN**. Do not upgrade hypotheses to confirmed runtime bugs yet. No production/runtime DB write, merge or deploy.

**Next decision gate:** obtain owner-local test stdout and exact commit SHA; reconcile results against full-v20 catalog and actual migration, then seek owner approval for A+ fail-closed linked-draft rules before implementing D3b-1.

## Verified owner-local D3b-0 targeted PostgreSQL result — 13 October 2026 (supersedes previous NOT RUN status only for this exact candidate)

**Evidence owner submitted from Windows PowerShell:** branch `analysis/3.8.0-d3b-protected-trash-evidence`, **source SHA `dd0823af65866bd21de87240f304cb5ef4cf0b9e`**, runner `tooling/run-v380-d3b-targeted-local.ps1`, Node 24, native PostgreSQL16 at `127.0.0.1:54833`, identity expected/observed `flytally_currency_test|flytally|127.0.0.1|54833` MATCH. Native server stopped cleanly.

- `npm run typecheck`: **PASS**
- `v380-d3b-trash-source-characterization.test.ts`: **3 PASS, 0 FAIL, 0 SKIP**
- `postgres-v380-d3b-real-trash-races.test.ts`: **5 PASS, 0 FAIL, 0 SKIP**
- Combined targeted source/native tests: **8/8 PASS, 0 FAIL, 0 SKIP**.
- **Case 1:** unchanged actual five-statement Trash SQL archives and deletes a standalone uncertified draft.
- **Case 2:** linked uncertified draft deletion removes crew and verification children through configured `ON DELETE CASCADE`, without including them in Trash snapshot. This is a reproduced integrity hazard for the synthetic linked-draft state; canonical reachability and full-v20 behavior remain to be tested.
- **Case 3:** when participant flight has immutable v20 source provenance, the trigger rejects its deletion; the attempted preceding archive is rolled back, provenance and active flight persist.
- **Case 4:** certified draft source is not archived or deleted by ordinary Trash guards.
- **Case 5:** two PostgreSQL sessions are synchronized: A archives the original draft; B certifies it; A then executes the original final conditional DELETE (zero rows) and commits. Database contains both active certified flight and committed archive record. Source function's success calculation checks archive INSERT `results[1]` instead of deleted rows. **This is an actual SQL-concurrency counterexample in the targeted fixture**, not yet evidence that Next.js certification endpoint can reach exactly this interleaving under all deployed schema/application locks.

**Evidence boundary:** the test's pre-v20 FK tables are a deliberately reduced contract; it executes genuine v20 SQL functions/triggers extracted from `lib/db-optimization.ts`. It is **not** a complete v1–v20 applied migration fixture. Catalog parity, same-transaction application `@neondatabase/serverless` transaction behavior, canonical sharing/certification eligibility, actual PostgreSQL void + participant acceptance races and production/Neon incidence remain **NOT RUN / UNKNOWN**. Historical earlier `NOT RUN` entries refer to their earlier commits and remain preserved.

**Updated release posture:** D3b-0 scoped targeted PG16 proof obtained, **D3b-0 FULL acceptance still open**. Next read-only/draft milestone is actual full-v20 catalog/fixture and independent participant/provenance writer evidence; only then finalize A+ linked-draft lifecycle choice with owner and start minimal D3b-1 fix. Product code, migration, main, deployment and production DB untouched.

## D3b-0 v1→v20 migration-chain verification candidate (13 October 2026 — NOT RUN)

**New on Draft #332:**
- `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts`
- `tooling/run-v380-d3b-migration-chain-local.ps1`

The new fixture no longer substitutes arbitrary handcrafted v12/v13/v15 foreign-key definitions and then applies only v20. Instead it constructs **a deliberately minimal pre-optimization foundational schema** on a random local PostgreSQL16 schema and executes **the actual runtime SQL for all versions 1 through 20**, extracted verbatim from `lib/db-optimization.ts`; transactions include the original migration advisory key and exact version/name registry entries. Source contracts reject missing/moved statements, newly interpolated SQL and explicit `public` references.

The targeted migration-chain test validates the effective composite FK actions and enabled protection triggers, then runs actual `moveFlightToTrash()` SQL. Cases: (1) catalog/version registry, (2) plain draft archival, (3) connected crew + verification CASCADE, (4) certified ordinary Trash gate, (5) legacy pending source invitation CASCADE, (6) immutable accepted recipient provenance rollback across accounts, (7) two independent PG sessions with archive → certification → zero-row final DELETE.

**Run from a clean local checkout of `analysis/3.8.0-d3b-protected-trash-evidence`:**

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-d3b-migration-chain-local.ps1
```

The runner checks branch/clean tracked files/Node24, typechecks and runs source tests, then creates its **own** disposable loopback PG16 server, verifies its DB user/host/port/database identity, runs the previously established targeted PG suite and then this sequential-migration suite. It restores process environment and stops only the created cluster. Separate opt-in `FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE=1` is set only within the controlled runner.

**Limit:** executing real optimizer migration SQL v1–v20 on minimal prerequisite tables is not the same as replaying every historical database schema origin, independent feature migration, dataset/currency population, or production configuration. The separate full applied-v20 catalog parity and authenticated browser/Neon SDK writer tests remain release gates. This still constitutes materially stronger FK/trigger evidence than the earlier D3b synthetic pre-v20 fixture if execution succeeds.

**Execution evidence:** Node24 typecheck on the new candidate **NOT RUN**; newly authored PG16 migration-chain cases **NOT RUN**; earlier owner-local targeted **8/8 PASS** at `dd0823af65866bd21de87240f304cb5ef4cf0b9e` remains valid only for that source commit. No runtime fix, production migration, main merge or deployment.

## D3b-0 owner-local sequential migration-chain verification — VERIFIED 13 Oct 2026

**Tested source commit:** `7f87eb76caa2b90b2a2fdb64ed97a29a8e2b2ac1` in Draft PR #332. Owner's Windows/Node24 output for `tooling/run-v380-d3b-migration-chain-local.ps1`: fresh native PG16 instance on 127.0.0.1:65332; expected/observed identity matched, temporary server cleanly shut down. **Typecheck PASS; source 3/3 PASS; targeted native SQL 5/5 PASS; sequential genuine runtime optimizer migration SQL versions 1..20 and post-migration SQL scenarios 7/7 PASS; total 15/15 tests PASS, no failures/skips.**

Specific new post-migration cases: FK actions and enabled protection triggers pass; unlinked draft Trash succeeds; linked draft `flight_connected_crew` and `flight_verifications` are deleted through CASCADE without normal Trash snapshot; certified original flight excluded from Trash; legacy pending invitation cascades (canonical UI reachability not proven); accepted recipient provenance prevents destructive recipient Trash and rolls back attempted archive; deterministic two-session archive→certification→conditional DELETE commits both active certified flight and archived entry. This confirms SQL-level integrity hazards under the tested schema.

**Scope boundary unchanged:** the fixture applies actual optimizer v1..v20 migration code to a minimal prerequisite foundational schema, not to an exhaustive historical schema plus feature migrations and real production rows. No verified Next.js authenticated certification/participation/create/Edit/GPS flows, real Neon serverless SDK contention, production incidence, merge or deployment. **D3b-0 targeted and sequential PG16 verification is achieved; broader schema/application acceptance remains OPEN. D3b-1 requires approved lifecycle semantics before changing product behavior.** Earlier `NOT RUN` entries in this file refer to older code commits, not to the verified `7f87eb76` run.
