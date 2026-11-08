# M0-B V22 — invitation cancellation atomicity before shared provenance materialization

**UTC checkpoint:** 2026-11-08T10:49:40.081Z. **Repo:** `filipto861/flytally-logbook`. **Canonical main:** `c9c2f60303236113a223942072311f5e37f876f7`; **exact executable/test work SHA:** `e9082c7fa71148e3c166c3c782ee612f2390c4ef`, work branch `feat/logbook-m0b-v22-expand-candidate-20261104`, [Draft PR #469](https://github.com/filipto861/flytally-logbook/pull/469) unmerged stacked on Draft #468 base `0cbd7604da23feb65cc924f9ccf0ac7ab27db7a9`. A new documentation-only checkpoint SHA follows this tested commit.

## Scope and reason

In dormant `app/(protected)/flights/shared-actions.ts:materializeParticipation`, the participant invitation was checked in a pre-transaction read and linked at the end of a data-modifying CTE. If another request cancelled or withdrew the invitation after the pre-read, the earlier recipient flight, tracks and non-FK provenance inserts could be attempted while final link update affected zero rows. This was a **source-level concurrency risk, not a reported production exploit**.

The **V22-only** fixed SQL HTTP batch now has three ordered `READ COMMITTED` statements:
1. Existing `users.id=sourceOwnerId FOR UPDATE` source-owner account gate.
2. New `flight_participations.id=participationId FOR UPDATE` invitation gate, fresh status and exact recipient/source owner/flight/revision/hash/NULL linked-flight checks. Its guarded `1 / COUNT(*)::integer` fails atomically if the row disappeared, changed ownership or revision, was cancelled/declined, or became linked.
3. The **existing**, not rewritten `materializationQuery` with fresh certified-source checks and immutable provenance insert. The invitation row remains locked until the transaction ends, so a concurrent cancellation cannot commit between the gate and these writes.

The source-frozen `V22_OWNER_TRASH_RETENTION_MODE="off"` branch continues the original V21 one-shot query without invitation/owner gate modifications. No schema/DDL, migration, role, app UI or deployment change. This is NOT universal P1–P7 parity.

## Executable changed files

- `app/(protected)/flights/shared-actions.ts` — V22-only second lock and exact revalidation; source contract comments corrected to three ordered statements.
- `tooling/sql/m0b-v22-trash-lifecycle.test.mjs` — contract checks for owner → invitation → existing materialization, every bound ownership/identity/status field, OFF unchanged.
- `tests/integration/postgres-fi-materialization.test.ts` — tight extractor/source contract updated for the approved three-step V22 SQL while still extracting/running the **unchanged canonical V21 data-modifying CTE** for three real FI/PIC tests. Historical failure at earlier SHA due regex expecting two statements is retained, not reinterpreted as a database failure.
- `tooling/postgres-partition-registry.json` — strict normalized-LF SHA-256 pin updated for the FI integration test `85262e29b064f6257903a960de900f9e32c7297080c009c6e2692f1633817715` → `98764730f96614615c8164e6f68e052c765dbeeeac00959251563e5e6e83fd27`; **42 source files / 164 cases / 6 partitions unchanged**.
- `tooling/sql/m0b-v22-invitation-gate-race-setup.sql` — fresh disposable PG16-only synthetic user, invitation, receipt tables with strict local identity guard.
- `.github/workflows/m0b-v22-pg16-candidate.yml` — new owned GitHub PG16 service test with **two separate backends**, cancellation holds the invitation row lock, second first acquires source owner row then visibly waits on invitation row, after cancellation commits its guard must fail, no materialization receipt may persist; unrelated still-valid invitation must succeed.

## Exact SHA tests and evidence

**PASS:** [GitHub Actions #42472799680](https://github.com/filipto861/flytally-logbook/actions/runs/42472799680) at exact `e9082c7fa71148e3c166c3c782ee612f2390c4ef`, both candidate and PowerShell syntax jobs completed `success`. Node24 full **1790/1790 PASS**; TypeScript **PASS**; Next production build diagnostic **PASS (no deployment)**; selected real PG16 FI/PIC 3 + restore 7 **10/10 PASS**. Crucially CI log prints `PASS: two-backend cancellation blocks invitation gate, rolls back orphan insert, unaffected pending invitation succeeds.` The waiter was observed `wait_event_type='Lock'`; after cancellation it raised `division by zero` from the fail-closed guard, then receipts count stayed zero; valid second invitation created one synthetic receipt. Remaining V21/V22 source exact migrations, late-link source race checks, rollback, wrong-target and role gates passed as configured in the same run.

**Previous CI failures preserved:** Runs #42472321565 and #42472564325 failed before their source-exact FI execution because existing tests required a two-statement V22 batch; updated exact FI test contract resolves this without skipping/watering down the three real tests. Current exact SHA CI is PASS.

**NOT RERUN on exact new SHA:** Owner's separate full native Windows six-owned-PG16 acceptance **164/164 PASS** remains historical at `f21473d4d42574ac03722978d287eef03bed6a9f`; new targeted test is outside the 164-case registry. Real owner Neon HTTP **P0/P8 READ ONLY PASS** at `fe9ffbc67471c6268d63739b2b442fced0550aec` remains historical for unchanged transport. Actual HTTP *writing* cancellation race and P1–P7 remote privilege/rollback: **NOT RUN**. Independent external review explicitly waived by owner for this iteration; no private repository transfer.

## Release and risk

V22 is literal OFF, schema version source 21, M0-A full-account Restore remains blocked. This is a narrow V22 source-only correctness improvement, not a claim every invitation writer/source/recipient gate has been exhaustively mapped. Existing `lib/db.ts` shared SQL principal persists; P5 least privilege/grant isolation, broader lock-order graph, native audit/full-account Restore, +12-month UID marker privacy/legal decision and real Neon HTTP writer parity remain open.

**DO NOT:** merge, deploy, migrate/create or modify remote/production Neon DB, change SQL roles or grants, delete/restore production data, activate V22 or production flag, claim P1–P7 release, or touch Training. Vercel production M0-A `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY at `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; production DB/schema/flags UNKNOWN, prod auth smoke NOT RUN.

**ONE NEXT STEP:** isolate and implement the next small **OFF-only/local-PG16** P5 cross-owner SQL authorization test and a candidate fail-closed role/grant boundary; reconcile actual app vs cron DB identity without creating users/roles or running DML on remote Neon.